import type { GameCardGame } from "@/components/GameCard";
import type { GameDetailData } from "@/components/GameDetailView";

export function resolveDetailGameView(
  baseGame: GameDetailData,
  displayed: GameCardGame,
  expansions: GameCardGame[],
): GameDetailData {
  if (displayed.id === baseGame.id) return baseGame;
  const expansion = expansions.find((e) => e.id === displayed.id);
  return (expansion as GameDetailData | undefined) ?? baseGame;
}
