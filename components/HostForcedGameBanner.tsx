import type { ReactNode } from "react";
import { Callout } from "@/components/Callout";
import { GameCover } from "@/components/GameCover";

/** Banner für ein vom Host festgelegtes Spiel (keine Abstimmung). */
export function HostForcedGameBanner({
  gameName,
  description,
  coverSrc,
  children,
}: {
  gameName: string;
  description: string;
  coverSrc?: string | null;
  children?: ReactNode;
}) {
  return (
    <Callout
      variant="success"
      className="flex flex-col items-center gap-3 text-center"
    >
      <span className="text-xs font-semibold text-[var(--accent)]">
        Vom Host festgelegt
      </span>
      {coverSrc !== undefined && (
        <GameCover src={coverSrc} alt={gameName} className="h-32 w-24 rounded-lg" />
      )}
      <p className="text-lg font-bold">{gameName}</p>
      <p className="text-sm text-[var(--muted)]">{description}</p>
      {children}
    </Callout>
  );
}
