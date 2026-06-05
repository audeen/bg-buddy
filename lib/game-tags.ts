import { playerRange, playtime, weightChipLabel } from "@/lib/format";

export type GameTagVariant = "accent" | "default" | "meta" | "rating";

export interface GameTag {
  label: string;
  variant: GameTagVariant;
}

export interface GameTagSource {
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  playingTime: number | null;
  weight: number | null;
  bggRating: number | null;
  categories: string[];
  mechanics: string[];
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
}

const MAX_TAGS = 8;

export function buildGameTags(
  game: GameTagSource,
  options?: { playerCount?: number },
): GameTag[] {
  const tags: GameTag[] = [];
  const seen = new Set<string>();
  const playerCount = options?.playerCount;

  function add(label: string, variant: GameTagVariant) {
    const key = label.toLowerCase();
    if (seen.has(key) || tags.length >= MAX_TAGS) return;
    seen.add(key);
    tags.push({ label, variant });
  }

  const players = playerRange(game.minPlayers, game.maxPlayers);
  if (players !== "? Spieler") add(players, "meta");

  const time = playtime(game.minPlaytime, game.maxPlaytime, game.playingTime);
  if (time) add(time, "meta");

  const weight = weightChipLabel(game.weight);
  if (weight) add(weight, "meta");

  if (game.bggRating != null && game.bggRating > 0) {
    add(`★ ${game.bggRating.toFixed(1)}`, "rating");
  }

  if (
    playerCount != null &&
    game.recommendedPlayerCounts.includes(playerCount) &&
    !game.bestPlayerCounts.includes(playerCount)
  ) {
    add("Empfohlen", "accent");
  }

  for (const c of game.categories.slice(0, 3)) {
    if (c.trim()) add(c.trim(), "default");
  }

  for (const m of game.mechanics.slice(0, 3)) {
    if (m.trim()) add(m.trim(), "default");
  }

  return tags;
}

export function chipClassForVariant(variant: GameTagVariant): string {
  switch (variant) {
    case "accent":
      return "chip chip-accent";
    case "meta":
      return "chip chip-meta";
    case "rating":
      return "chip chip-rating";
    default:
      return "chip";
  }
}

export function groupGameTags(tags: GameTag[]): {
  meta: GameTag[];
  content: GameTag[];
} {
  const meta: GameTag[] = [];
  const content: GameTag[] = [];
  for (const tag of tags) {
    if (tag.variant === "meta" || tag.variant === "rating") {
      meta.push(tag);
    } else {
      content.push(tag);
    }
  }
  return { meta, content };
}
