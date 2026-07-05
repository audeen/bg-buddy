import {
  dedupeAndSortBggNameOptions,
  parseBggNameOptionsFromItem,
  parseBggNameOptionsXml,
} from "../lib/bgg";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13">
    <name type="primary" sortindex="1" value="CATAN"/>
    <name type="alternate" sortindex="5" value="Die Siedler von Catan"/>
    <name type="alternate" sortindex="1" value="The Settlers of Catan"/>
    <versions>
      <item id="26269">
        <name value="CATAN"/>
        <link type="boardgamepublisher" id="13" value="Mayfair Games"/>
        <link type="language" id="2184" value="English" inbound="true"/>
        <yearpublished value="2015"/>
      </item>
      <item id="3076">
        <name value="Die Siedler von Catan"/>
        <link type="boardgamepublisher" id="37" value="Kosmos"/>
        <link type="language" id="2188" value="German" inbound="true"/>
        <yearpublished value="2019"/>
      </item>
    </versions>
  </item>
</items>`;

const parsed = parseBggNameOptionsXml(sampleXml);
assert(parsed.length >= 5, "primary + alternates + versions");

const primary = parsed.find((o) => o.kind === "primary");
assert(primary?.name === "CATAN", "primary name");

const germanVersion = parsed.find(
  (o) => o.kind === "version" && o.language === "German",
);
assert(germanVersion?.name === "Die Siedler von Catan", "german version name");
assert(germanVersion?.publisher === "Kosmos", "german version publisher");
assert(germanVersion?.year === 2019, "german version year");

const alternateDe = parsed.find(
  (o) => o.kind === "alternate" && o.name === "Die Siedler von Catan",
);
assert(!!alternateDe, "german alternate");

const sorted = dedupeAndSortBggNameOptions([
  germanVersion!,
  primary!,
  alternateDe!,
  germanVersion!,
]);
assert(sorted[0].kind === "primary", "primary sorted first");
assert(sorted.length === 3, "duplicate version removed");

const empty = parseBggNameOptionsXml(`<?xml version="1.0"?><items total="0"/>`);
assert(empty.length === 0, "empty xml");

const fromItem = parseBggNameOptionsFromItem({
  name: [{ type: "primary", value: "Splendor" }],
});
assert(fromItem.length === 1 && fromItem[0].name === "Splendor", "item parser");

console.log("test-bgg-names: all passed");
