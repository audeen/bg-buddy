import {
  buildGalleryUrl,
  parseGalleryResponse,
  GALLERY_PAGE_SIZE,
} from "../lib/bgg/gallery";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Fixture im Format der Geekdo-Bilder-API (gekürzt).
const fixture = {
  images: [
    {
      imageid: "133885",
      imageurl: "https://cf.geekdo-images.com/abc__small/pic133885.jpg",
      "imageurl@2x": "https://cf.geekdo-images.com/abc__small@2x/pic133885.jpg",
      imageurl_lg: "https://cf.geekdo-images.com/abc__large/pic133885.jpg",
      caption: "Dusk in Catan",
      href: "/image/133885/catan",
    },
    {
      imageid: 158865,
      imageurl: "https://cf.geekdo-images.com/def__small/pic158865.jpg",
      imageurl_lg: "https://cf.geekdo-images.com/def__large/pic158865.jpg",
      caption: "  ",
    },
    {
      // Ohne URLs → wird übersprungen.
      imageid: "999",
    },
  ],
  pagination: { perPage: 15, pageid: 1, total: 1395 },
};

const page = parseGalleryResponse(fixture, 1, 15);
assert(page.images.length === 2, "Bild ohne URLs wird übersprungen");
assert(page.total === 1395, "total aus pagination");
assert(page.hasMore === true, "Seite 1 von 1395 → hasMore");

const [first, second] = page.images;
assert(first.id === "133885", "imageid normalisiert");
assert(first.thumb.includes("__small@2x"), "Retina-Thumb bevorzugt");
assert(first.large.includes("__large"), "große Variante");
assert(first.caption === "Dusk in Catan", "caption übernommen");
assert(first.href === "/image/133885/catan", "href übernommen");

assert(second.id === "158865", "numerische imageid wird String");
assert(second.thumb.includes("__small"), "Fallback auf imageurl ohne @2x");
assert(second.caption === null, "leere caption wird null");
assert(second.href === null, "fehlender href wird null");

// Letzte Seite → hasMore false.
const lastPage = parseGalleryResponse(
  { images: fixture.images.slice(0, 1), pagination: { total: 16 } },
  2,
  15,
);
assert(lastPage.hasMore === false, "Seite 2 deckt total 16 ab");

// Kaputte/leere Antworten crashen nicht.
const empty = parseGalleryResponse(null, 1, 15);
assert(empty.images.length === 0 && empty.total === 0, "null-Antwort → leer");
const noImages = parseGalleryResponse({}, 1, 15);
assert(noImages.images.length === 0, "Antwort ohne images → leer");

// URL-Aufbau.
const url = buildGalleryUrl(13, { page: 2, tag: "BoxFront" });
assert(url.startsWith("https://api.geekdo.com/api/images?"), "API-Host");
assert(url.includes("objectid=13"), "objectid gesetzt");
assert(url.includes("pageid=2"), "Seite gesetzt");
assert(url.includes("tag=BoxFront"), "Tag-Filter gesetzt");
assert(
  url.includes(`showcount=${GALLERY_PAGE_SIZE}`),
  "Standard-Seitengröße gesetzt",
);
assert(
  decodeURIComponent(url).includes("galleries[]=game"),
  "Galerie auf game beschränkt",
);

console.log("test-bgg-gallery: all passed");
