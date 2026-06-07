import { playerRange, playtime, weightChipLabel } from "@/lib/format";
import type { GameFilter } from "@/lib/game-filters";
import {
  playerRangeFilterValue,
  playtimeFilterValue,
  ratingBlockFromValue,
  weightLevelFromValue,
} from "@/lib/game-filters";

export type GameTagVariant = "accent" | "default" | "meta" | "rating";

export interface GameTag {
  label: string;
  variant: GameTagVariant;
  filter?: GameFilter;
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

  function add(label: string, variant: GameTagVariant, filter?: GameFilter) {
    const key = label.toLowerCase();
    if (seen.has(key) || tags.length >= MAX_TAGS) return;
    seen.add(key);
    tags.push({ label, variant, filter });
  }

  const players = playerRange(game.minPlayers, game.maxPlayers);
  if (players !== "? Spieler") {
    const rangeValue = playerRangeFilterValue(game.minPlayers, game.maxPlayers);
    add(players, "meta", rangeValue ? { kind: "playerRange", value: rangeValue } : undefined);
  }

  const time = playtime(game.minPlaytime, game.maxPlaytime, game.playingTime);
  if (time) {
    const timeValue = playtimeFilterValue(
      game.minPlaytime,
      game.maxPlaytime,
      game.playingTime,
    );
    add(time, "meta", timeValue ? { kind: "playtime", value: timeValue } : undefined);
  }

  const weight = weightChipLabel(game.weight);
  if (weight && game.weight != null && game.weight > 0) {
    add(weight, "meta", {
      kind: "weight",
      value: weightLevelFromValue(game.weight),
    });
  }

  if (game.bggRating != null && game.bggRating > 0) {
    add(`★ ${game.bggRating.toFixed(1)}`, "rating", {
      kind: "rating",
      value: String(ratingBlockFromValue(game.bggRating)),
    });
  }

  if (playerCount != null && game.bestPlayerCounts.includes(playerCount)) {
    add(`Best · ${playerCount}P`, "accent", {
      kind: "best",
      value: String(playerCount),
    });
  }

  for (const c of game.categories.slice(0, 3)) {
    if (c.trim()) add(c.trim(), "default", { kind: "genre", value: c.trim() });
  }

  for (const m of game.mechanics.slice(0, 3)) {
    if (m.trim()) add(m.trim(), "default", { kind: "mechanic", value: m.trim() });
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

export function categoryTag(category: string): GameTag {
  return {
    label: category,
    variant: "default",
    filter: { kind: "genre", value: category },
  };
}

export function mechanicTag(mechanic: string): GameTag {
  return {
    label: mechanic,
    variant: "default",
    filter: { kind: "mechanic", value: mechanic },
  };
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
