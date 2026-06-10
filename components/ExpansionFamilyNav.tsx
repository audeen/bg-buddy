"use client";

import { useState } from "react";
import type { GameCardGame } from "@/lib/types/game";
import { expansionAvailableLabel } from "@/lib/expansion-label";

type ExpansionFamilyNavProps = {
  baseGame: Pick<GameCardGame, "id" | "name">;
  expansions: GameCardGame[];
  activeId: number | null;
  onSelectBase: () => void;
  onSelectExpansion: (id: number) => void;
  variant?: "card" | "detail";
};

function stopCardActivation(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation();
}

const chipPointerGuard = {
  onPointerDown: stopCardActivation,
  onPointerUp: stopCardActivation,
};

function expansionChipLabel(name: string, variant: "card" | "detail"): string {
  if (variant === "detail") return name;
  return name.length > 28 ? `${name.slice(0, 26)}…` : name;
}

function SiblingNav({
  expansions,
  activeId,
  onSelectBase,
  onSelectExpansion,
  variant,
}: Omit<ExpansionFamilyNavProps, "variant"> & { variant: "card" | "detail" }) {
  const scrollable = expansions.length >= 4;

  return (
    <div
      className={`chip-row ${scrollable ? "chip-row-scroll" : ""} ${variant === "card" ? "w-full" : ""}`}
    >
      <button
        type="button"
        {...chipPointerGuard}
        className={`chip chip-meta chip-interactive ${activeId == null ? "chip-active" : ""}`}
        onClick={(e) => {
          stopCardActivation(e);
          onSelectBase();
        }}
      >
        Basisspiel
      </button>
      {expansions.map((exp) => (
        <button
          key={exp.id}
          type="button"
          {...chipPointerGuard}
          className={`chip chip-interactive ${activeId === exp.id ? "chip-active" : ""}`}
          title={exp.name}
          onClick={(e) => {
            stopCardActivation(e);
            onSelectExpansion(exp.id);
          }}
        >
          {expansionChipLabel(exp.name, variant)}
        </button>
      ))}
    </div>
  );
}

function ExpansionFamilyMenu({
  expansions,
  activeId,
  onSelectBase,
  onSelectExpansion,
  onPick,
  variant,
}: {
  expansions: GameCardGame[];
  activeId: number | null;
  onSelectBase: () => void;
  onSelectExpansion: (id: number) => void;
  onPick: () => void;
  variant: "card" | "detail";
}) {
  const scrollable = expansions.length >= 4;

  return (
    <div
      className={`expansion-family-menu flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1.5 ${
        variant === "card" ? "w-full" : ""
      }`}
    >
      <button
        type="button"
        {...chipPointerGuard}
        className={`chip chip-meta chip-interactive w-full text-left ${activeId == null ? "chip-active" : ""}`}
        onClick={(e) => {
          stopCardActivation(e);
          onSelectBase();
          onPick();
        }}
      >
        Basisspiel
      </button>
      <div className={`chip-row ${scrollable ? "chip-row-scroll" : ""} ${variant === "card" ? "flex-col" : ""}`}>
        {expansions.map((exp) => (
          <button
            key={exp.id}
            type="button"
            {...chipPointerGuard}
            className={`chip chip-interactive ${variant === "card" ? "w-full text-left" : ""} ${activeId === exp.id ? "chip-active" : ""}`}
            title={exp.name}
            onClick={(e) => {
              stopCardActivation(e);
              onSelectExpansion(exp.id);
              onPick();
            }}
          >
            {expansionChipLabel(exp.name, variant)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExpansionFamilyNav({
  baseGame,
  expansions,
  activeId,
  onSelectBase,
  onSelectExpansion,
  variant = "card",
}: ExpansionFamilyNavProps) {
  const [expanded, setExpanded] = useState(false);

  // Klappt die Liste wieder ein, wenn Spiel oder Auswahl wechseln (derived state).
  const resetKey = `${baseGame.id}:${activeId ?? ""}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setExpanded(false);
  }

  if (expansions.length === 0) return null;

  const activeExpansion =
    activeId != null
      ? expansions.find((e) => e.id === activeId)
      : null;

  const useSiblingNav = variant === "detail" && activeId != null;

  if (useSiblingNav) {
    return (
      <SiblingNav
        baseGame={baseGame}
        expansions={expansions}
        activeId={activeId}
        onSelectBase={onSelectBase}
        onSelectExpansion={onSelectExpansion}
        variant={variant}
      />
    );
  }

  const toggleLabel = activeExpansion
    ? expansionChipLabel(activeExpansion.name, variant)
    : expansionAvailableLabel(expansions.length);

  return (
    <div className={`flex flex-col gap-1.5 ${variant === "card" ? "w-full" : ""}`}>
      {variant === "detail" && (
        <span className="text-sm font-semibold">Erweiterungen in der Sammlung</span>
      )}
      <button
        type="button"
        {...chipPointerGuard}
        className={`chip chip-meta chip-interactive w-full text-left flex items-center justify-between gap-2 ${
          activeExpansion ? "chip-active" : ""
        }`}
        aria-expanded={expanded}
        onClick={(e) => {
          stopCardActivation(e);
          setExpanded((v) => !v);
        }}
      >
        <span className="truncate min-w-0">{toggleLabel}</span>
        <span className="shrink-0 opacity-70" aria-hidden>
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded && (
        <ExpansionFamilyMenu
          expansions={expansions}
          activeId={activeId}
          onSelectBase={onSelectBase}
          onSelectExpansion={onSelectExpansion}
          onPick={() => setExpanded(false)}
          variant={variant}
        />
      )}
    </div>
  );
}
