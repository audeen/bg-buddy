/** Minimale Bildfelder, aus denen ein Cover aufgelöst wird. */
export type CoverSource = {
  /** Manuelles Override (Upload-Pfad, eigener Link oder Galerie-Auswahl). */
  coverUrl?: string | null;
  image: string | null;
  thumbnail: string | null;
};

/**
 * Liefert die beste Cover-URL für ein Spiel:
 * manuelles Override → hochauflösendes BGG-Bild → kleines BGG-Thumbnail.
 */
export function resolveCoverSrc(game: CoverSource): string | null {
  return game.coverUrl ?? game.image ?? game.thumbnail;
}
