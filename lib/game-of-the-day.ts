import type { GameCardGame, GameDetailData } from "@/lib/types/game";
import {
  isPlayableWithOwnedExpansions,
  mergedBestPlayerCounts,
  type BestPlayerCountFields,
} from "@/lib/effective-player-count";

const BERLIN_TZ = "Europe/Berlin";

export type TodayMeetup = {
  id: string;
  title: string;
  scheduledAt: Date;
  expectedPlayerCount: number;
};

export type UpcomingMeetup = {
  id: string;
  title: string;
  scheduledAt: Date | null;
  expectedPlayerCount: number;
};

export type GameOfTheDayResult = {
  game: GameOfTheDayCandidate | null;
  playerCount: number | null;
};

export type GameOfTheDayCandidate = GameDetailData & {
  lentOut?: boolean;
};

export function berlinDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BERLIN_TZ }).format(d);
}

export function isScheduledToday(
  scheduledAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!scheduledAt) return false;
  return berlinDateKey(scheduledAt) === berlinDateKey(now);
}

export function findTodayMeetup(
  meetups: {
    id: string;
    title: string;
    scheduledAt: Date | null;
    expectedPlayerCount: number;
  }[],
  now: Date = new Date(),
): TodayMeetup | null {
  const today = meetups
    .filter(
      (m): m is typeof m & { scheduledAt: Date } =>
        isScheduledToday(m.scheduledAt, now),
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const first = today[0];
  if (!first) return null;

  return {
    id: first.id,
    title: first.title,
    scheduledAt: first.scheduledAt,
    expectedPlayerCount: first.expectedPlayerCount,
  };
}

/** First meetup in homepage order (scheduledAt asc, then createdAt desc). */
export function findUpcomingMeetup(
  meetups: {
    id: string;
    title: string;
    scheduledAt: Date | null;
    expectedPlayerCount: number;
  }[],
): UpcomingMeetup | null {
  const first = meetups[0];
  if (!first) return null;
  return {
    id: first.id,
    title: first.title,
    scheduledAt: first.scheduledAt,
    expectedPlayerCount: first.expectedPlayerCount,
  };
}

export function filterAvailableGames(
  games: GameOfTheDayCandidate[],
): GameOfTheDayCandidate[] {
  return games.filter((game) => !game.lentOut);
}

function isBestAtCount(
  game: GameOfTheDayCandidate,
  expansions: readonly BestPlayerCountFields[],
  playerCount: number,
): boolean {
  return mergedBestPlayerCounts(game, expansions).includes(playerCount);
}

export function filterPlayableGames(
  games: GameOfTheDayCandidate[],
  expansionsByBaseId: Map<number, GameCardGame[]>,
  playerCount: number,
): GameOfTheDayCandidate[] {
  return games.filter((game) => {
    if (game.lentOut) return false;
    const expansions = expansionsByBaseId.get(game.id) ?? [];
    return isPlayableWithOwnedExpansions(game, expansions, playerCount);
  });
}

export function deterministicIndex(seed: string, length: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % length;
}

export function pickGameOfTheDay(
  games: GameOfTheDayCandidate[],
  expansionsByBaseId: Map<number, GameCardGame[]>,
  playerCount: number,
  dateKey: string,
): GameOfTheDayCandidate | null {
  const playable = filterPlayableGames(games, expansionsByBaseId, playerCount);
  if (playable.length === 0) return null;

  const bestPool = playable.filter((game) => {
    const expansions = expansionsByBaseId.get(game.id) ?? [];
    return isBestAtCount(game, expansions, playerCount);
  });

  const pool = (bestPool.length > 0 ? bestPool : playable).sort(
    (a, b) => a.id - b.id,
  );

  const index = deterministicIndex(dateKey, pool.length);
  return pool[index] ?? null;
}

export function pickRandomGameOfTheDay(
  games: GameOfTheDayCandidate[],
  dateKey: string,
): GameOfTheDayCandidate | null {
  const pool = filterAvailableGames(games).sort((a, b) => a.id - b.id);
  if (pool.length === 0) return null;
  const index = deterministicIndex(dateKey, pool.length);
  return pool[index] ?? null;
}

export function resolveGameOfTheDay(
  games: GameOfTheDayCandidate[],
  expansionsByBaseId: Map<number, GameCardGame[]>,
  meetup: UpcomingMeetup | null,
  dateKey: string,
): GameOfTheDayResult {
  if (meetup) {
    const picked = pickGameOfTheDay(
      games,
      expansionsByBaseId,
      meetup.expectedPlayerCount,
      dateKey,
    );
    if (picked) {
      return { game: picked, playerCount: meetup.expectedPlayerCount };
    }
  }
  return { game: pickRandomGameOfTheDay(games, dateKey), playerCount: null };
}
