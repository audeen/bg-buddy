import { resolveCoverSrc } from "../lib/cover-image";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Manuelles Override gewinnt immer.
assert(
  resolveCoverSrc({
    coverUrl: "/api/games/13/cover?v=1",
    image: "https://cf.geekdo-images.com/full.jpg",
    thumbnail: "https://cf.geekdo-images.com/thumb.jpg",
  }) === "/api/games/13/cover?v=1",
  "coverUrl hat höchste Priorität",
);

// Ohne Override: hochauflösendes Bild vor Thumbnail.
assert(
  resolveCoverSrc({
    image: "https://cf.geekdo-images.com/full.jpg",
    thumbnail: "https://cf.geekdo-images.com/thumb.jpg",
  }) === "https://cf.geekdo-images.com/full.jpg",
  "image vor thumbnail",
);

// Fallback auf Thumbnail, wenn kein großes Bild existiert.
assert(
  resolveCoverSrc({
    image: null,
    thumbnail: "https://cf.geekdo-images.com/thumb.jpg",
  }) === "https://cf.geekdo-images.com/thumb.jpg",
  "thumbnail als Fallback",
);

// coverUrl null verhält sich wie nicht gesetzt.
assert(
  resolveCoverSrc({
    coverUrl: null,
    image: "https://cf.geekdo-images.com/full.jpg",
    thumbnail: null,
  }) === "https://cf.geekdo-images.com/full.jpg",
  "coverUrl null wird übersprungen",
);

// Nichts vorhanden → null (Platzhalter-Würfel).
assert(
  resolveCoverSrc({ image: null, thumbnail: null }) === null,
  "ohne Bilder null",
);

console.log("test-cover-image: all passed");
