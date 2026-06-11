/**
 * Tests für die BGG-Hotness (Parsing, Tagesauswahl, Mapping).
 * Nutzung: npm run test:bgg-hotness
 */
import assert from "node:assert/strict";
import { parseHotXml, type BggHotItem, type ThingDetails } from "../lib/bgg";
import {
  pickHotnessItem,
  thingDetailsToGameDetailData,
} from "../lib/bgg/hotness";

const HOT_XML = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item id="350184" rank="2">
    <thumbnail value="https://cf.geekdo-images.com/earthborne_t.jpg" />
    <name value="Earthborne Rangers" />
    <yearpublished value="2023" />
  </item>
  <item id="429861" rank="1">
    <thumbnail value="https://cf.geekdo-images.com/vantage_t.jpg" />
    <name value="Vantage" />
  </item>
  <item id="999" rank="3">
    <name value="" />
  </item>
  <item id="447508" rank="4">
    <name value="The Old King&amp;#039;s Crown" />
    <yearpublished value="2025" />
  </item>
</items>`;

function testParseHotXml() {
  const items = parseHotXml(HOT_XML);
  // Eintrag ohne Namen wird verworfen, Rest nach Rang sortiert.
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    bggId: 429861,
    rank: 1,
    name: "Vantage",
    year: null,
    thumbnail: "https://cf.geekdo-images.com/vantage_t.jpg",
  });
  assert.equal(items[1].bggId, 350184);
  assert.equal(items[1].year, 2023);
  // BGG doppelt-kodiert Namen (&amp;#039;) → Entities werden dekodiert.
  assert.equal(items[2].name, "The Old King's Crown");
}

function testParseHotXmlEmpty() {
  assert.deepEqual(parseHotXml(`<items termsofuse="x"></items>`), []);
}

function makeHotItems(count: number): BggHotItem[] {
  return Array.from({ length: count }, (_, i) => ({
    bggId: 1000 + i,
    rank: i + 1,
    name: `Spiel ${i + 1}`,
    year: null,
    thumbnail: null,
  }));
}

function testPickHotnessItem() {
  assert.equal(pickHotnessItem([], "2026-06-11"), null);

  const items = makeHotItems(50);
  const picked = pickHotnessItem(items, "2026-06-11");
  assert.ok(picked != null);
  // Auswahl bleibt in den Top 10.
  assert.ok(picked.rank >= 1 && picked.rank <= 10);
  // Gleicher Tag → gleiche Auswahl.
  assert.equal(pickHotnessItem(items, "2026-06-11")?.bggId, picked.bggId);

  // Über viele Tage hinweg werden verschiedene Spiele gewählt.
  const seen = new Set<number>();
  for (let day = 1; day <= 30; day++) {
    const key = `2026-06-${String(day).padStart(2, "0")}`;
    const p = pickHotnessItem(items, key);
    if (p) seen.add(p.bggId);
  }
  assert.ok(seen.size > 1, "Date-Seed sollte über Tage variieren");
}

function testThingDetailsMapping() {
  const fallback: BggHotItem = {
    bggId: 429861,
    rank: 1,
    name: "Vantage",
    year: 2025,
    thumbnail: "https://cf.geekdo-images.com/vantage_t.jpg",
  };
  const details: ThingDetails = {
    id: 429861,
    description: "An open-world adventure.",
    descriptionDe: null,
    image: "https://cf.geekdo-images.com/vantage.jpg",
    thumbnail: null,
    categories: ["Adventure"],
    mechanics: ["Cooperative Game"],
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 90,
    weight: 2.5,
    bggRating: 8.1,
    bestPlayerCounts: [2, 3],
    recommendedPlayerCounts: [1, 2, 3, 4],
  };

  const game = thingDetailsToGameDetailData(details, fallback);
  assert.equal(game.id, 429861);
  // Fallbacks aus der Hot-Liste, wenn die Thing-Antwort Felder nicht liefert.
  assert.equal(game.name, "Vantage");
  assert.equal(game.year, 2025);
  assert.equal(game.thumbnail, "https://cf.geekdo-images.com/vantage_t.jpg");
  assert.equal(game.image, "https://cf.geekdo-images.com/vantage.jpg");
  assert.equal(game.description, "An open-world adventure.");
  assert.equal(game.isExpansion, false);
  assert.deepEqual(game.bestPlayerCounts, [2, 3]);
}

testParseHotXml();
testParseHotXmlEmpty();
testPickHotnessItem();
testThingDetailsMapping();

console.log("test-bgg-hotness: all passed");
