import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  parseCollectionCsv,
  fetchThingBatch,
  parseThingXml,
  BggBlockedError,
} from "../lib/bgg";

const THING_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="68448">
    <thumbnail>https://cf.geekdo-images.com/x_thumb.jpg</thumbnail>
    <image>https://cf.geekdo-images.com/x_full.jpg</image>
    <name type="primary" sortindex="1" value="7 Wonders"/>
    <description>Build a wonder &amp; lead your city.&#10;&#10;Draft cards each age.</description>
    <minplayers value="2"/>
    <maxplayers value="7"/>
    <link type="boardgamecategory" id="1021" value="Ancient"/>
    <link type="boardgamecategory" id="1002" value="Card Game"/>
    <link type="boardgamemechanic" id="2041" value="Card Drafting"/>
    <link type="boardgamemechanic" id="2004" value="Set Collection"/>
  </item>
</items>`;

const prisma = new PrismaClient();

async function main() {
  console.log("== 1. CSV parsen ==");
  const csv = readFileSync("sample-data/collection.csv", "utf8");
  const games = parseCollectionCsv(csv);
  const expansions = games.filter((g) => g.isExpansion).length;
  console.log(
    `geparst: ${games.length} (Standalone ${games.length - expansions}, Erweiterungen ${expansions})`,
  );
  const sample = games[0];
  console.log("Beispiel:", {
    id: sample.id,
    name: sample.name,
    players: [sample.minPlayers, sample.maxPlayers],
    best: sample.bestPlayerCounts,
    rec: sample.recommendedPlayerCounts,
  });

  console.log("\n== 2. Upsert in DB ==");
  for (const g of games) {
    const { id, ...base } = g;
    await prisma.game.upsert({
      where: { id },
      update: base,
      create: { id, enriched: false, ...base },
    });
  }
  console.log("Spiele in DB:", await prisma.game.count());
  if (games.length < 60) throw new Error("Zu wenige Spiele geparst!");

  console.log("\n== 3a. Enrichment-XML-Parser (Fixture) ==");
  const parsedDetails = parseThingXml(THING_FIXTURE);
  const d0 = parsedDetails[0];
  const parserOk =
    d0?.id === 68448 &&
    d0.image === "https://cf.geekdo-images.com/x_full.jpg" &&
    d0.description?.includes("Build a wonder & lead") === true &&
    !d0.description?.includes("&amp;") &&
    d0.categories.length === 2 &&
    d0.mechanics.length === 2;
  console.log("Parser-Ergebnis:", {
    id: d0?.id,
    hasImage: !!d0?.image,
    categories: d0?.categories,
    mechanics: d0?.mechanics,
    descPreview: d0?.description?.slice(0, 40),
  });
  if (!parserOk) throw new Error("parseThingXml liefert unerwartetes Ergebnis!");
  console.log("Parser OK ✓");
  // schreibe das Fixture-Ergebnis in die DB (simuliert Enrichment)
  await prisma.game.update({
    where: { id: d0.id },
    data: {
      description: d0.description,
      image: d0.image,
      thumbnail: d0.thumbnail,
      categories: d0.categories,
      mechanics: d0.mechanics,
      enriched: true,
    },
  });

  console.log("\n== 3b. Live-BGG-Abruf (optional) ==");
  try {
    const live = await fetchThingBatch([68448]);
    console.log("Live-Abruf OK, Cover:", live[0]?.image ? "ja" : "nein");
  } catch (err) {
    if (err instanceof BggBlockedError) {
      console.log("Live-Abruf blockiert (erwartet in dieser Umgebung):", err.message.split(".")[0]);
    } else {
      console.log("Live-Abruf fehlgeschlagen:", (err as Error).message);
    }
  }

  console.log("\n== 4. Voting-Flow ==");
  const user = await prisma.user.upsert({
    where: { name: "Testspieler" },
    update: {},
    create: { name: "Testspieler" },
  });
  const meetup = await prisma.meetup.create({
    data: { title: "Testabend", expectedPlayerCount: 4, createdById: user.id },
  });

  // Pick-Stimme + zwei Tinder-Siege fuer das erste Spiel bei 4 Spielern
  const eligible = games.filter(
    (g) =>
      !g.isExpansion &&
      (g.minPlayers ?? 1) <= 4 &&
      4 <= (g.maxPlayers ?? 99),
  );
  const top = eligible[0];
  const other = eligible[1];

  await prisma.vote.create({
    data: {
      meetupId: meetup.id,
      userId: user.id,
      gameId: top.id,
      playerCount: 4,
      mode: "PICK",
    },
  });
  await prisma.vote.create({
    data: {
      meetupId: meetup.id,
      userId: user.id,
      gameId: top.id,
      playerCount: 4,
      mode: "TINDER",
    },
  });
  await prisma.vote.create({
    data: {
      meetupId: meetup.id,
      userId: user.id,
      gameId: other.id,
      playerCount: 4,
      mode: "TINDER",
    },
  });

  const ranking = await prisma.vote.groupBy({
    by: ["gameId"],
    where: { meetupId: meetup.id, playerCount: 4 },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
  });
  console.log("Ranking @4 Spieler:");
  for (const r of ranking) {
    const g = games.find((x) => x.id === r.gameId);
    console.log(`  ${g?.name}: ${r._sum.points} Punkte`);
  }

  console.log("\n== Cleanup Testdaten ==");
  await prisma.meetup.delete({ where: { id: meetup.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("OK");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FEHLER:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
