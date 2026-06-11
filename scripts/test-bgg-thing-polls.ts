import { parseThingXml } from "../lib/bgg";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Nachbau der xmlapi2/thing?stats=1-Antwort inkl. Polls und ranks-Struktur.
const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="209418">
    <thumbnail>https://example.com/thumb.jpg</thumbnail>
    <image>https://example.com/image.jpg</image>
    <name type="primary" sortindex="1" value="Dominion (Second Edition)"/>
    <description>You are a monarch.</description>
    <yearpublished value="2016"/>
    <minplayers value="2"/>
    <maxplayers value="4"/>
    <poll name="suggested_numplayers" title="User Suggested Number of Players" totalvotes="120">
      <results numplayers="1">
        <result value="Best" numvotes="2"/>
        <result value="Recommended" numvotes="10"/>
        <result value="Not Recommended" numvotes="60"/>
      </results>
      <results numplayers="2">
        <result value="Best" numvotes="70"/>
        <result value="Recommended" numvotes="40"/>
        <result value="Not Recommended" numvotes="5"/>
      </results>
      <results numplayers="3">
        <result value="Best" numvotes="30"/>
        <result value="Recommended" numvotes="65"/>
        <result value="Not Recommended" numvotes="4"/>
      </results>
      <results numplayers="4">
        <result value="Best" numvotes="20"/>
        <result value="Recommended" numvotes="50"/>
        <result value="Not Recommended" numvotes="15"/>
      </results>
      <results numplayers="4+">
        <result value="Best" numvotes="0"/>
        <result value="Recommended" numvotes="1"/>
        <result value="Not Recommended" numvotes="80"/>
      </results>
    </poll>
    <poll name="suggested_playerage" title="User Suggested Player Age" totalvotes="30">
      <results>
        <result value="6" numvotes="1"/>
        <result value="10" numvotes="18"/>
        <result value="12" numvotes="9"/>
        <result value="21 and up" numvotes="2"/>
      </results>
    </poll>
    <poll name="language_dependence" title="Language Dependence" totalvotes="48">
      <results>
        <result level="1" value="No necessary in-game text" numvotes="3"/>
        <result level="2" value="Some necessary text - easily memorized or small crib sheet" numvotes="8"/>
        <result level="3" value="Moderate in-game text - needs crib sheet or paste ups" numvotes="35"/>
        <result level="4" value="Extensive use of text - massive conversion needed to be playable" numvotes="2"/>
        <result level="5" value="Unplayable in another language" numvotes="0"/>
      </results>
    </poll>
    <playingtime value="30"/>
    <minplaytime value="30"/>
    <maxplaytime value="30"/>
    <minage value="13"/>
    <link type="boardgamecategory" id="1002" value="Card Game"/>
    <link type="boardgamecategory" id="1035" value="Medieval"/>
    <link type="boardgamemechanic" id="2664" value="Deck, Bag, and Pool Building"/>
    <statistics page="1">
      <ratings>
        <usersrated value="20000"/>
        <average value="7.82255"/>
        <bayesaverage value="7.6"/>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="104" bayesaverage="7.6"/>
          <rank type="family" id="5497" name="strategygames" friendlyname="Strategy Game Rank" value="80" bayesaverage="7.6"/>
        </ranks>
        <averageweight value="2.1673"/>
      </ratings>
    </statistics>
  </item>
</items>`;

const [game] = parseThingXml(sampleXml);
assert(!!game, "item parsed");
assert(game.id === 209418, "id");
assert(game.name === "Dominion (Second Edition)", "name");

// Rang kommt aus statistics > ratings > ranks > rank (Subtype "boardgame").
assert(game.rank === 104, `rank 104, got ${game.rank}`);

// Spielerzahl-Polls: 2 ist Best (und damit auch Recommended), 3 und 4
// Recommended, 1 wird von "Not Recommended" dominiert, "4+" wird übersprungen.
assert(
  JSON.stringify(game.bestPlayerCounts) === "[2]",
  `best [2], got ${JSON.stringify(game.bestPlayerCounts)}`,
);
assert(
  JSON.stringify(game.recommendedPlayerCounts) === "[2,3,4]",
  `recommended [2,3,4], got ${JSON.stringify(game.recommendedPlayerCounts)}`,
);

// Alter: Gewinner des suggested_playerage-Polls (10 mit 18 Stimmen) als "10+".
assert(game.ageRange === "10+", `ageRange 10+, got ${game.ageRange}`);

// Sprachabhängigkeit: Option mit den meisten Stimmen (Level 3).
assert(
  game.languageDependence ===
    "Moderate in-game text - needs crib sheet or paste ups",
  `languageDependence, got ${game.languageDependence}`,
);

// Übrige Stammdaten weiterhin korrekt.
assert(game.weight === 2.1673, "weight");
assert(game.bggRating === 7.82255, "bggRating");
assert(game.minPlayers === 2 && game.maxPlayers === 4, "players");

// Ohne Polls: Alter fällt auf minage zurück, Arrays bleiben leer, Rang null
// bei "Not Ranked".
const minimalXml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="42">
    <name type="primary" value="Minimal"/>
    <minage value="8"/>
    <poll name="suggested_playerage" totalvotes="0">
      <results/>
    </poll>
    <statistics page="1">
      <ratings>
        <average value="6.5"/>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="Not Ranked" bayesaverage="Not Ranked"/>
        </ranks>
        <averageweight value="0"/>
      </ratings>
    </statistics>
  </item>
</items>`;

const [minimal] = parseThingXml(minimalXml);
assert(minimal.ageRange === "8+", `minage fallback 8+, got ${minimal.ageRange}`);
assert(minimal.languageDependence === null, "no language poll → null");
assert(minimal.bestPlayerCounts?.length === 0, "no numplayers poll → empty best");
assert(
  minimal.recommendedPlayerCounts?.length === 0,
  "no numplayers poll → empty recommended",
);
assert(minimal.rank === null, `"Not Ranked" → null, got ${minimal.rank}`);

console.log("test-bgg-thing-polls: all passed");
