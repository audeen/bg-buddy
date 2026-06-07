import {
  normalizeBarcode,
  parseGameUpcResponse,
} from "../lib/barcode-lookup";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// normalizeBarcode
assert(normalizeBarcode(" 019962194719 ") === "019962194719", "trim spaces");
assert(normalizeBarcode("019-9621-94719") === "019962194719", "strip dashes");
assert(normalizeBarcode("123") === null, "too short");
assert(normalizeBarcode("") === null, "empty");

// verified single result
const verified = parseGameUpcResponse(
  {
    upc: "111111111111",
    bgg_info_status: "verified",
    bgg_info: [{ id: 148228, name: "Splendor" }],
    status: "ok",
  },
  "111111111111",
);
assert(verified.status === "found", "verified → found");
if (verified.status === "found") {
  assert(verified.bggId === 148228, "bgg id");
  assert(verified.verified === true, "verified flag");
}

// single unverified candidate
const single = parseGameUpcResponse(
  {
    upc: "222222222222",
    bgg_info_status: "choose_from_bgg_info_or_search",
    bgg_info: [{ id: 265736, name: "Tiny Towns", confidence: 91 }],
    status: "ok",
  },
  "222222222222",
);
assert(single.status === "found", "one candidate → found");
if (single.status === "found") {
  assert(single.verified === false, "unverified");
}

// multiple candidates
const multi = parseGameUpcResponse(
  {
    bgg_info_status: "choose_from_bgg_info_or_search",
    bgg_info: [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ],
    status: "ok",
  },
  "999",
);
assert(multi.status === "candidates", "multi → candidates");
if (multi.status === "candidates") {
  assert(multi.items.length === 2, "two items");
}

// not found
const none = parseGameUpcResponse(
  {
    bgg_info_status: "choose_from_bgg_info_or_search",
    bgg_info: [],
    status: "ok",
  },
  "333333333333",
);
assert(none.status === "notFound", "empty → notFound");

console.log("test-barcode-lookup: all passed");
