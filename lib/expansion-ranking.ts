import type { RankEntry } from "@/lib/types/ranking";
import {
  buildExpansionCopelandWins,
  type ExpansionConfig,
  type ExpansionConfigGame,
  type ExpansionDuelVoteRow,
} from "@/lib/expansion-duel";

export type CoverMeta = {
  thumbnail: string | null;
  image: string | null;
};

export function coverByVoteGameIdForConfigs(
  configs: ExpansionConfig[],
  gamesById: Map<number, ExpansionConfigGame>,
  baseGame: ExpansionConfigGame,
): Map<number, CoverMeta> {
  const map = new Map<number, CoverMeta>();
  for (const config of configs) {
    const coverGame =
      config.optionalExpansionId != null
        ? (gamesById.get(config.optionalExpansionId) ?? baseGame)
        : baseGame;
    map.set(config.voteGameId, {
      thumbnail: coverGame.thumbnail,
      image: coverGame.image,
    });
  }
  return map;
}

export function buildExpansionRankingEntries(
  configs: ExpansionConfig[],
  expansionVotes: ExpansionDuelVoteRow[],
  coverByVoteGameId: Map<number, CoverMeta>,
): RankEntry[] {
  if (configs.length === 0) return [];

  const wins = buildExpansionCopelandWins(configs, expansionVotes);

  const entries: RankEntry[] = configs.map((config) => {
    const cover = coverByVoteGameId.get(config.voteGameId);
    const duelWins = wins[config.voteGameId] ?? 0;
    return {
      id: config.voteGameId,
      name: config.label,
      thumbnail: cover?.thumbnail ?? cover?.image ?? null,
      points: duelWins,
      voters: 0,
      duelWins,
    };
  });

  return entries.sort(
    (a, b) =>
      b.points - a.points ||
      a.name.localeCompare(b.name, "de"),
  );
}
