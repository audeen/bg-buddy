import {
  buildExpansionCopelandWins,
  buildExpansionConfigs,
  configByVoteGameId,
  parseExpansionDuelFrozenData,
  pickExpansionWinner,
  type ExpansionConfigGame,
} from "@/lib/expansion-duel";

export function resolveExpansionResultLabel(
  baseGame: ExpansionConfigGame,
  ownedExpansions: ExpansionConfigGame[],
  mandatoryIds: number[],
  playerCount: number,
  expansionVotes: {
    gameId: number;
    opponentGameId: number | null;
    userId: string;
  }[],
  frozenRaw: unknown,
): string | null {
  const frozen = parseExpansionDuelFrozenData(frozenRaw, playerCount);
  const configs =
    frozen?.configs ??
    buildExpansionConfigs(
      baseGame,
      ownedExpansions,
      mandatoryIds,
      playerCount,
    );

  if (configs.filter((c) => c.optionalExpansionId != null).length === 0) {
    const base = configs[0];
    return base?.label ?? baseGame.name;
  }

  if (expansionVotes.length === 0) {
    return configs[0]?.label ?? null;
  }

  const wins = buildExpansionCopelandWins(configs, expansionVotes);
  const winner = pickExpansionWinner(configs, wins);
  return winner?.label ?? null;
}

export function choicesFromConfigs(
  configs: ReturnType<typeof buildExpansionConfigs>,
  gamesById: Map<number, ExpansionConfigGame>,
  baseGame: ExpansionConfigGame,
): {
  voteGameId: number;
  label: string;
  thumbnail: string | null;
  image: string | null;
}[] {
  return configs.map((config) => {
    const coverGame =
      config.optionalExpansionId != null
        ? (gamesById.get(config.optionalExpansionId) ?? baseGame)
        : baseGame;
    return {
      voteGameId: config.voteGameId,
      label: config.label,
      thumbnail: coverGame.thumbnail,
      image: coverGame.image,
    };
  });
}

export function expansionWinnerConfigLabel(
  configs: ReturnType<typeof buildExpansionConfigs>,
  expansionVotes: {
    gameId: number;
    opponentGameId: number | null;
    userId: string;
  }[],
): string | null {
  const wins = buildExpansionCopelandWins(configs, expansionVotes);
  const winner = pickExpansionWinner(configs, wins);
  return winner?.label ?? configByVoteGameId(configs, configs[0]?.voteGameId ?? 0)?.label ?? null;
}
