import type { PrismaClient } from "@prisma/client";
import {
  buildExpansionConfigs,
  expansionConfigsNeedDuel,
  expansionDuelProgress,
  parseExpansionDuelFrozenData,
  type ExpansionConfigGame,
} from "@/lib/expansion-duel";
import { getDuelProgressForCount, parseDuelFrozenData } from "@/lib/duel-pairs";
import { buildGameTieMetaMap } from "@/lib/duel-tiebreaker";
import { duelParticipantIds } from "@/lib/duel-pairs";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import { buildCombinedByCount } from "@/lib/vote-aggregation";
import { winnerFromCombined } from "@/lib/meetup-winner";
import { isExpansionDuelMode } from "@/lib/vote-mode";

export type ExpansionPhaseState = {
  mainDuelComplete: boolean;
  winnerGameId: number | null;
  winnerName: string | null;
  expansionDuelAvailable: boolean;
  expansionDuelStarted: boolean;
  expansionDuelComplete: boolean;
  optionalExpansionCount: number;
};

type VoteGameMeta = {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  bestPlayerCounts: number[];
  rank: number | null;
  bggRating: number | null;
};

export async function loadExpansionPhaseState(
  meetupId: string,
  expectedPlayerCount: number,
  db: PrismaClient,
  options?: {
    ownedExpansionsByBase?: Map<number, ExpansionConfigGame[]>;
    mandatoryByBase?: Map<number, number[]>;
  },
): Promise<ExpansionPhaseState> {
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    select: {
      duelFrozenData: true,
      expansionDuelStartedAt: true,
      expansionDuelFrozenData: true,
      mandatoryExpansions: {
        select: { baseGameId: true, expansionGameId: true },
      },
    },
  });
  if (!meetup) {
    return emptyExpansionPhase();
  }

  const [groupPicks, duelVotes, expansionVotes, allVotes] = await Promise.all([
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
    db.vote.findMany({
      where: {
        meetupId,
        mode: "EXPANSION_DUEL",
        playerCount: expectedPlayerCount,
      },
      select: {
        gameId: true,
        opponentGameId: true,
        userId: true,
      },
    }),
    db.vote.findMany({
      where: { meetupId },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            thumbnail: true,
            image: true,
            bestPlayerCounts: true,
            rank: true,
            bggRating: true,
          },
        },
      },
    }),
  ]);

  const pickCounts = buildPickCounts(groupPicks);
  const frozen = parseDuelFrozenData(meetup.duelFrozenData, expectedPlayerCount);
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

  const mainDuelComplete = duelComplete && poolIds.length > 0;

  const combinedByCount = buildCombinedByCount(
    allVotes.map((v) => ({
      playerCount: v.playerCount,
      gameId: v.gameId,
      opponentGameId: v.opponentGameId,
      userId: v.userId,
      points: v.points,
      mode: v.mode,
      game: v.game,
    })),
    meetupId,
  );

  const winner = winnerFromCombined(combinedByCount[expectedPlayerCount]);
  if (!mainDuelComplete || !winner) {
    return {
      mainDuelComplete,
      winnerGameId: winner?.id ?? null,
      winnerName: winner?.name ?? null,
      expansionDuelAvailable: false,
      expansionDuelStarted: !!meetup.expansionDuelStartedAt,
      expansionDuelComplete: false,
      optionalExpansionCount: 0,
    };
  }

  const mandatoryByBase =
    options?.mandatoryByBase ??
    buildMandatoryMap(meetup.mandatoryExpansions);

  const ownedByBase =
    options?.ownedExpansionsByBase ??
    (await loadOwnedExpansionsMap(db));

  const baseGame = await db.game.findUnique({
    where: { id: winner.id },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
      minPlayers: true,
      maxPlayers: true,
    },
  });

  if (!baseGame) {
    return {
      mainDuelComplete: true,
      winnerGameId: winner.id,
      winnerName: winner.name,
      expansionDuelAvailable: false,
      expansionDuelStarted: !!meetup.expansionDuelStartedAt,
      expansionDuelComplete: false,
      optionalExpansionCount: 0,
    };
  }

  const owned = ownedByBase.get(winner.id) ?? [];
  const mandatory = mandatoryByBase.get(winner.id) ?? [];
  const configs = buildExpansionConfigs(
    baseGame,
    owned,
    mandatory,
    expectedPlayerCount,
  );
  const optionalExpansionCount = configs.filter(
    (c) => c.optionalExpansionId != null,
  ).length;

  const expansionDuelAvailable =
    optionalExpansionCount > 0 && !meetup.expansionDuelStartedAt;

  const expansionDuelStarted = !!meetup.expansionDuelStartedAt;

  let expansionDuelComplete = false;
  if (expansionDuelStarted) {
    const frozenExp = parseExpansionDuelFrozenData(
      meetup.expansionDuelFrozenData,
      expectedPlayerCount,
    );
    const activeConfigs = frozenExp?.configs ?? configs;
    const participants = duelParticipantIds(groupPicks);
    const progress = expansionDuelProgress(
      activeConfigs,
      expansionVotes,
      participants,
    );
    expansionDuelComplete = progress.complete;
  } else if (!expansionConfigsNeedDuel(configs)) {
    expansionDuelComplete = true;
  }

  return {
    mainDuelComplete: true,
    winnerGameId: winner.id,
    winnerName: winner.name,
    expansionDuelAvailable,
    expansionDuelStarted,
    expansionDuelComplete,
    optionalExpansionCount,
  };
}

function emptyExpansionPhase(): ExpansionPhaseState {
  return {
    mainDuelComplete: false,
    winnerGameId: null,
    winnerName: null,
    expansionDuelAvailable: false,
    expansionDuelStarted: false,
    expansionDuelComplete: false,
    optionalExpansionCount: 0,
  };
}

function buildMandatoryMap(
  rows: { baseGameId: number; expansionGameId: number }[],
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.baseGameId) ?? [];
    list.push(row.expansionGameId);
    map.set(row.baseGameId, list);
  }
  return map;
}

async function loadOwnedExpansionsMap(
  db: PrismaClient,
): Promise<Map<number, ExpansionConfigGame[]>> {
  const expansions = await db.game.findMany({
    where: {
      isExpansion: true,
      listedInCollection: true,
      expandsGameIds: { isEmpty: false },
    },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
      minPlayers: true,
      maxPlayers: true,
      expandsGameIds: true,
    },
  });

  const map = new Map<number, ExpansionConfigGame[]>();
  for (const exp of expansions) {
    const { expandsGameIds, ...game } = exp;
    for (const baseId of expandsGameIds) {
      const list = map.get(baseId) ?? [];
      list.push(game);
      map.set(baseId, list);
    }
  }
  for (const [baseId, list] of map) {
    map.set(
      baseId,
      [...list].sort((a, b) => a.name.localeCompare(b.name, "de")),
    );
  }
  return map;
}

export function expansionVotesForMeetup(
  votes: { mode: string; playerCount: number }[],
  expected: number,
): number {
  return votes.filter(
    (v) => isExpansionDuelMode(v.mode) && v.playerCount === expected,
  ).length;
}
