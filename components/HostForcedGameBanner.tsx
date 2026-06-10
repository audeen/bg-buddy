import type { ReactNode } from "react";
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
    <div
      className="card flex flex-col items-center gap-3 text-center border border-[var(--accent)]"
      style={{ padding: "var(--space-card)" }}
      role="status"
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
    </div>
  );
}
