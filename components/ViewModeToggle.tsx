"use client";

import { CardDeckIcon, GridViewIcon } from "@/components/icons";
import type { GamesViewMode } from "@/lib/use-view-mode";

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex min-h-[2.75rem] min-w-[2.25rem] items-center justify-center"
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
          active
            ? "bg-[var(--surface-2)] text-[var(--foreground)] border-[var(--border)]"
            : "bg-transparent text-[var(--muted)] border-transparent hover:text-[var(--foreground)]"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

/** Dezenter Umschalter zwischen Deck- (Swipe) und Grid-Ansicht. */
export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: GamesViewMode | null;
  onChange: (mode: GamesViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Ansicht der Spieleliste"
      className="inline-flex items-center self-end -my-1"
    >
      <ToggleButton
        active={viewMode === "deck"}
        label="Karten-Ansicht (wischen)"
        onClick={() => onChange("deck")}
      >
        <CardDeckIcon size={15} />
      </ToggleButton>
      <ToggleButton
        active={viewMode === "grid"}
        label="Raster-Ansicht"
        onClick={() => onChange("grid")}
      >
        <GridViewIcon size={15} />
      </ToggleButton>
    </div>
  );
}
