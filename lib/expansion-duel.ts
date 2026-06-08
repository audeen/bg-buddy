import type { Prisma } from "@prisma/client";
import { isPlayableAtCount } from "@/lib/effective-player-count";
import { pairKey, type DuelPair } from "@/lib/duel-pairs";

export type ExpansionConfigGame = {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
};

/** Canonical vote id: base game id for base setup, expansion id for +optional variant. */
export type ExpansionConfig = {
  voteGameId: number;
  label: string;
  baseGameId: number;
  optionalExpansionId: number | null;
  mandatoryExpansionIds: number[];
};

export function configLabel(
  baseName: string,
  mandatoryNames: string[],
  optionalName?: string,
): string {
  const parts = [baseName];
  if (mandatoryNames.length > 0) {
    parts.push(mandatoryNames.join(" + "));
  }
  if (optionalName) {
    parts.push(optionalName);
  }
  return parts.join(" · ");
}

export function buildExpansionConfigs(
  baseGame: ExpansionConfigGame,
  ownedExpansions: ExpansionConfigGame[],
  mandatoryIds: number[],
  playerCount: number,
): ExpansionConfig[] {
  const mandatorySet = new Set(mandatoryIds);
  const mandatoryPlayable = ownedExpansions.filter(
    (exp) =>
      mandatorySet.has(exp.id) &&
      isPlayableAtCount(exp.minPlayers, exp.maxPlayers, playerCount),
  );
  const mandatoryNames = mandatoryPlayable.map((e) => e.name);

  const baseConfig: ExpansionConfig = {
    voteGameId: baseGame.id,
    label: configLabel(baseGame.name, mandatoryNames),
    baseGameId: baseGame.id,
    optionalExpansionId: null,
    mandatoryExpansionIds: mandatoryPlayable.map((e) => e.id),
  };

  const optionalExpansions = ownedExpansions.filter(
    (exp) =>
      !mandatorySet.has(exp.id) &&
      isPlayableAtCount(exp.minPlayers, exp.maxPlayers, playerCount),
  );

  const variants: ExpansionConfig[] = optionalExpansions.map((exp) => ({
    voteGameId: exp.id,
    label: configLabel(baseGame.name, mandatoryNames, exp.name),
    baseGameId: baseGame.id,
    optionalExpansionId: exp.id,
    mandatoryExpansionIds: mandatoryPlayable.map((e) => e.id),
  }));

  return [baseConfig, ...variants];
}

/** Pairs: base setup vs each optional variant (plan: „Basis gegen Basis + Erweiterung“). */
export function buildExpansionDuelPairs(configs: ExpansionConfig[]): DuelPair[] {
  const base = configs.find((c) => c.optionalExpansionId == null);
  if (!base) return [];

  const pairs: DuelPair[] = [];
  for (const variant of configs) {
    if (variant.optionalExpansionId == null) continue;
    const a = base.voteGameId;
    const b = variant.voteGameId;
    pairs.push({
      a: Math.min(a, b),
      b: Math.max(a, b),
    });
  }
  return pairs;
}

export function expansionConfigsNeedDuel(configs: ExpansionConfig[]): boolean {
  return configs.filter((c) => c.optionalExpansionId != null).length > 0;
}

export type ExpansionDuelFrozenData = {
  baseGameId: number;
  playerCount: number;
  configs: ExpansionConfig[];
  poolVoteGameIds: number[];
};

export function expansionDuelFrozenToJson(
  data: ExpansionDuelFrozenData,
): Prisma.InputJsonValue {
  return data as unknown as Prisma.InputJsonValue;
}

export function parseExpansionDuelFrozenData(
  raw: unknown,
  playerCount: number,
): ExpansionDuelFrozenData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<ExpansionDuelFrozenData>;
  if (
    typeof data.baseGameId !== "number" ||
    data.playerCount !== playerCount ||
    !Array.isArray(data.configs) ||
    !Array.isArray(data.poolVoteGameIds)
  ) {
    return null;
  }
  return data as ExpansionDuelFrozenData;
}

export function configByVoteGameId(
  configs: ExpansionConfig[],
  voteGameId: number,
): ExpansionConfig | undefined {
  return configs.find((c) => c.voteGameId === voteGameId);
}

export type ExpansionDuelVoteRow = {
  gameId: number;
  opponentGameId: number | null;
  userId: string;
};

/** Copeland wins from base-vs-variant pairs only. */
export function buildExpansionCopelandWins(
  configs: ExpansionConfig[],
  votes: ExpansionDuelVoteRow[],
): Record<number, number> {
  const poolIds = new Set(configs.map((c) => c.voteGameId));
  const wins: Record<number, number> = {};
  for (const id of poolIds) wins[id] = 0;

  const pairs = buildExpansionDuelPairs(configs);
  for (const pair of pairs) {
    const pairVotes = votes.filter(
      (v) =>
        (v.gameId === pair.a && v.opponentGameId === pair.b) ||
        (v.gameId === pair.b && v.opponentGameId === pair.a),
    );
    if (pairVotes.length === 0) continue;

    const counts = new Map<number, number>();
    for (const v of pairVotes) {
      counts.set(v.gameId, (counts.get(v.gameId) ?? 0) + 1);
    }
    let bestId: number | null = null;
    let bestCount = 0;
    let tied = false;
    for (const [id, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
        tied = false;
      } else if (count === bestCount) {
        tied = true;
      }
    }
    if (!tied && bestId != null && poolIds.has(bestId)) {
      wins[bestId] = (wins[bestId] ?? 0) + 1;
    }
  }

  return wins;
}

export function pickExpansionWinner(
  configs: ExpansionConfig[],
  wins: Record<number, number>,
): ExpansionConfig | null {
  if (configs.length === 0) return null;
  if (configs.length === 1) return configs[0];

  let best: ExpansionConfig | null = null;
  let bestWins = -1;
  for (const config of configs) {
    const w = wins[config.voteGameId] ?? 0;
    if (w > bestWins) {
      bestWins = w;
      best = config;
    } else if (w === bestWins && best) {
      if (config.label.localeCompare(best.label, "de") < 0) {
        best = config;
      }
    }
  }
  return best;
}

export function expansionDuelProgress(
  configs: ExpansionConfig[],
  votes: ExpansionDuelVoteRow[],
  participantIds: string[],
): {
  totalPairs: number;
  decidedPairs: number;
  complete: boolean;
  finishedParticipants: number;
} {
  const pairs = buildExpansionDuelPairs(configs);
  const totalPairs = pairs.length;
  if (totalPairs === 0) {
    return {
      totalPairs: 0,
      decidedPairs: 0,
      complete: true,
      finishedParticipants: participantIds.length,
    };
  }

  let decidedPairs = 0;
  for (const pair of pairs) {
    const hasVote = votes.some(
      (v) =>
        (v.gameId === pair.a && v.opponentGameId === pair.b) ||
        (v.gameId === pair.b && v.opponentGameId === pair.a),
    );
    if (hasVote) decidedPairs += 1;
  }

  let finishedParticipants = 0;
  for (const userId of participantIds) {
    const userVotes = votes.filter((v) => v.userId === userId);
    const userPairKeys = new Set(
      userVotes.map((v) =>
        pairKey(
          Math.min(v.gameId, v.opponentGameId ?? v.gameId),
          Math.max(v.gameId, v.opponentGameId ?? v.gameId),
        ),
      ),
    );
    if (pairs.every((p) => userPairKeys.has(pairKey(p.a, p.b)))) {
      finishedParticipants += 1;
    }
  }

  const complete =
    decidedPairs >= totalPairs &&
    finishedParticipants >= participantIds.length;

  return {
    totalPairs,
    decidedPairs,
    complete,
    finishedParticipants,
  };
}
