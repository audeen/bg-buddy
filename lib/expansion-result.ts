import {
  buildExpansionConfigs,
  type ExpansionConfigGame,
} from "@/lib/expansion-duel";

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
