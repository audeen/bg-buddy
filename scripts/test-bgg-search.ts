import { parseSearchXml } from "../lib/bgg";
import { parseBggSearchResponse } from "../lib/bgg-search";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<items total="3" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13">
    <name type="primary" value="CATAN"/>
    <yearpublished value="1995"/>
  </item>
  <item type="boardgameexpansion" id="2007">
    <name type="primary" value="CATAN: Seafarers"/>
    <yearpublished value="1997"/>
  </item>
  <item type="boardgame" id="148228">
    <name type="primary" value="Splendor"/>
    <yearpublished value="2014"/>
  </item>
</items>`;

const parsed = parseSearchXml(sampleXml);
assert(parsed.length === 3, "three items");
assert(parsed[0].bggId === 13, "catan id");
assert(parsed[0].name === "CATAN", "catan name");
assert(parsed[0].year === 1995, "catan year");
assert(parsed[0].isExpansion === false, "catan not expansion");
assert(parsed[1].isExpansion === true, "seafarers is expansion");
assert(parsed[1].year === 1997, "seafarers year");

const empty = parseSearchXml(`<?xml version="1.0"?><items total="0"/>`);
assert(empty.length === 0, "empty xml");

const single = parseBggSearchResponse(
  [{ bggId: 148228, name: "Splendor", year: 2014, isExpansion: false }],
  "splendor",
);
assert(single.status === "found", "single → found");
if (single.status === "found") {
  assert(single.bggId === 148228, "found id");
  assert(single.query === "splendor", "found query");
}

const multi = parseBggSearchResponse(
  [
    { bggId: 13, name: "CATAN", year: 1995, isExpansion: false },
    { bggId: 2007, name: "CATAN: Seafarers", year: 1997, isExpansion: true },
  ],
  "catan",
);
assert(multi.status === "candidates", "multi → candidates");
if (multi.status === "candidates") {
  assert(multi.items.length === 2, "two candidates");
}

const none = parseBggSearchResponse([], "xyz");
assert(none.status === "notFound", "empty → notFound");

const limited = parseBggSearchResponse(
  [
    { bggId: 1, name: "A", year: null, isExpansion: false },
    { bggId: 2, name: "B", year: null, isExpansion: false },
    { bggId: 3, name: "C", year: null, isExpansion: false },
  ],
  "abc",
  2,
);
assert(limited.status === "candidates", "limit still candidates when >1");
if (limited.status === "candidates") {
  assert(limited.items.length === 2, "limit applied");
}

console.log("test-bgg-search: all passed");
