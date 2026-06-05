import { playerRange, playtime } from "@/lib/format";

export type GameTagVariant = "accent" | "default" | "meta";

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

const MAX_TAGS = 5;

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

  if (playerCount != null) {
    if (game.bestPlayerCounts.includes(playerCount)) {
      add("Beste Wahl", "accent");
    } else if (game.recommendedPlayerCounts.includes(playerCount)) {
      add("Empfohlen", "default");
    }
  }

  const players = playerRange(game.minPlayers, game.maxPlayers);
  if (players !== "? Spieler") add(players, "meta");

  const time = playtime(game.minPlaytime, game.maxPlaytime, game.playingTime);
  if (time) add(time, "meta");

  if (game.weight != null && game.weight > 0) {
    add(`${game.weight.toFixed(1)}/5`, "meta");
  }

  if (game.bggRating != null && game.bggRating > 0) {
    add(`★ ${game.bggRating.toFixed(1)}`, "meta");
  }

  for (const c of game.categories.slice(0, 2)) {
    if (c.trim()) add(c.trim(), "default");
  }

  const mechanic = game.mechanics[0]?.trim();
  if (mechanic) add(mechanic, "default");

  return tags;
}

export function chipClassForVariant(variant: GameTagVariant): string {
  switch (variant) {
    case "accent":
      return "chip chip-accent";
    case "meta":
      return "chip chip-meta";
    default:
      return "chip";
  }
}
