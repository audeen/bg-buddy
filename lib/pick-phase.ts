import type { PrismaClient } from "@prisma/client";
import { getDuelProgressForCount, parseDuelFrozenData } from "@/lib/duel-pairs";
import { buildGameTieMetaMap } from "@/lib/duel-tiebreaker";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export type PickRow = { userId: string; gameId: number; points: number };

export type PickPhaseState = {
  poolSize: number;
  fullPickCount: number;
  expectedPlayerCount: number;
  readyForDuels: boolean;
  picksLocked: boolean;
  duelComplete: boolean;
  partialPickers: { userId: string; sum: number }[];
  missingCount: number;
  hostForced: boolean;
};

export function summarizePickSums(
  groupPicks: PickRow[],
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const p of groupPicks) {
    sums.set(p.userId, (sums.get(p.userId) ?? 0) + p.points);
  }
  return sums;
}

export function assessPickPhase(
  groupPicks: PickRow[],
  expectedPlayerCount: number,
  duelVoteCount: number,
  duelComplete = false,
  hostForced = false,
): PickPhaseState {
  if (hostForced) {
    return {
      poolSize: 0,
      fullPickCount: 0,
      expectedPlayerCount,
      readyForDuels: false,
      picksLocked: true,
      duelComplete: true,
      partialPickers: [],
      missingCount: 0,
      hostForced: true,
    };
  }

  const sums = summarizePickSums(groupPicks);
  const poolSize = poolGameIds(buildPickCounts(groupPicks)).length;

  let fullPickCount = 0;
  const partialPickers: { userId: string; sum: number }[] = [];

  for (const [userId, sum] of sums) {
    if (sum === MAX_PICK_POINTS) {
      fullPickCount += 1;
    } else if (sum > 0 && sum < MAX_PICK_POINTS) {
      partialPickers.push({ userId, sum });
    }
  }

  partialPickers.sort((a, b) => a.userId.localeCompare(b.userId));

  const missingCount = Math.max(0, expectedPlayerCount - fullPickCount);
  const picksLocked = duelVoteCount > 0 && !duelComplete;
  const readyForDuels =
    poolSize >= 2 &&
    fullPickCount >= expectedPlayerCount &&
    partialPickers.length === 0;

  return {
    poolSize,
    fullPickCount,
    expectedPlayerCount,
    readyForDuels,
    picksLocked,
    duelComplete,
    partialPickers,
    missingCount,
    hostForced: false,
  };
}

export function formatDuellNotReadyMessage(phase: PickPhaseState): string {
  if (phase.partialPickers.length > 0) {
    return `Duell-Modus startet erst, wenn alle ihre ${MAX_PICK_POINTS} Stimmen bei ★ gesetzt haben (${phase.fullPickCount}/${phase.expectedPlayerCount} fertig, ${phase.partialPickers.length} unvollständig).`;
  }
  if (phase.poolSize < 2) {
    return "Duell-Modus startet erst, wenn mindestens zwei Spiele nominiert sind.";
  }
  return `Duell-Modus startet erst, wenn ${phase.expectedPlayerCount} Spieler je ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★ haben (aktuell ${phase.fullPickCount}/${phase.expectedPlayerCount}).`;
}

export async function getPickPhaseState(
  meetupId: string,
  expectedPlayerCount: number,
  db: PrismaClient,
): Promise<PickPhaseState> {
  const [meetup, groupPicks, duelVotes] = await Promise.all([
    db.meetup.findUnique({
      where: { id: meetupId },
      select: { duelFrozenData: true, hostForcedGameId: true },
    }),
    db.vote.findMany({
      where: {
        meetupId,
        mode: "PICK",
        playerCount: expectedPlayerCount,
      },
      select: { userId: true, gameId: true, points: true },
    }),
    db.vote.findMany({
      where: {
        meetupId,
        mode: { in: ["DUEL", "TINDER"] },
        playerCount: expectedPlayerCount,
      },
      select: {
        gameId: true,
        opponentGameId: true,
        userId: true,
        playerCount: true,
      },
    }),
  ]);

  const pickCounts = buildPickCounts(groupPicks);
  const frozen = parseDuelFrozenData(
    meetup?.duelFrozenData,
    expectedPlayerCount,
  );
  const poolIds = frozen?.poolGameIds ?? poolGameIds(pickCounts);
  const tieBreak =
    poolIds.length >= 2
      ? {
          meetupId,
          expectedPlayerCount,
          pickCounts,
          games: buildGameTieMetaMap(
            await db.game.findMany({
              where: { id: { in: poolIds } },
              select: {
                id: true,
                bestPlayerCounts: true,
                rank: true,
                bggRating: true,
              },
            }),
          ),
        }
      : undefined;
  const { duelComplete } = getDuelProgressForCount(
    poolIds,
    duelVotes,
    expectedPlayerCount,
    {
      picks: groupPicks,
      meetupId,
      tieBreak,
      frozen,
    },
  );

  return assessPickPhase(
    groupPicks,
    expectedPlayerCount,
    duelVotes.length,
    duelComplete,
    meetup?.hostForcedGameId != null,
  );
}

export type PickPhaseSummary = {
  fullPickCount: number;
  expectedPlayerCount: number;
  partialPickerNames: string[];
  missingCount: number;
};

export async function loadPickPhaseSummary(
  meetupId: string,
  expectedPlayerCount: number,
  db: PrismaClient,
): Promise<{ phase: PickPhaseState; summary: PickPhaseSummary }> {
  const phase = await getPickPhaseState(meetupId, expectedPlayerCount, db);

  const partialIds = phase.partialPickers.map((p) => p.userId);
  const partialPickerNames =
    partialIds.length > 0
      ? (
          await db.user.findMany({
            where: { id: { in: partialIds } },
            select: { id: true, name: true },
          })
        )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((u) => u.name)
      : [];

  return {
    phase,
    summary: {
      fullPickCount: phase.fullPickCount,
      expectedPlayerCount: phase.expectedPlayerCount,
      partialPickerNames,
      missingCount: phase.missingCount,
    },
  };
}
