"use client";

import { useEffect, useState } from "react";
import type { GameCardGame } from "@/components/GameCard";
import { expansionAvailableLabel } from "@/lib/expansion-label";

type ExpansionFamilyNavProps = {
  baseGame: Pick<GameCardGame, "id" | "name">;
  expansions: GameCardGame[];
  activeId: number | null;
  onSelectBase: () => void;
  onSelectExpansion: (id: number) => void;
  variant?: "card" | "detail";
};

function stopCardClick(e: React.MouseEvent) {
  e.stopPropagation();
}

function expansionChipLabel(name: string, variant: "card" | "detail"): string {
  if (variant === "detail") return name;
  return name.length > 28 ? `${name.slice(0, 26)}…` : name;
}

function SiblingNav({
  baseGame,
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
        className={`chip chip-meta chip-interactive ${activeId == null ? "chip-active" : ""}`}
        onClick={(e) => {
          stopCardClick(e);
          onSelectBase();
        }}
      >
        Basisspiel
      </button>
      {expansions.map((exp) => (
        <button
          key={exp.id}
          type="button"
          className={`chip chip-interactive ${activeId === exp.id ? "chip-active" : ""}`}
          title={exp.name}
          onClick={(e) => {
            stopCardClick(e);
            onSelectExpansion(exp.id);
          }}
        >
          {expansionChipLabel(exp.name, variant)}
        </button>
      ))}
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

  useEffect(() => {
    setExpanded(false);
  }, [baseGame.id, activeId]);

  if (expansions.length === 0) return null;

  if (activeId != null) {
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

  if (expansions.length === 1) {
    const exp = expansions[0];
    return (
      <button
        type="button"
        className="chip chip-meta chip-interactive w-fit text-left"
        onClick={(e) => {
          stopCardClick(e);
          onSelectExpansion(exp.id);
        }}
      >
        {expansionAvailableLabel(1)}
      </button>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${variant === "card" ? "w-full" : ""}`}>
      {variant === "detail" && (
        <span className="text-sm font-semibold">Erweiterungen in der Sammlung</span>
      )}
      <button
        type="button"
        className="chip chip-meta chip-interactive w-fit text-left"
        aria-expanded={expanded}
        onClick={(e) => {
          stopCardClick(e);
          setExpanded((v) => !v);
        }}
      >
        {expansionAvailableLabel(expansions.length)}
        <span className="ml-1 opacity-70" aria-hidden>
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded && (
        <div className={`chip-row ${expansions.length >= 4 ? "chip-row-scroll" : ""}`}>
          {expansions.map((exp) => (
            <button
              key={exp.id}
              type="button"
              className="chip chip-interactive"
              title={exp.name}
              onClick={(e) => {
                stopCardClick(e);
                onSelectExpansion(exp.id);
                setExpanded(false);
              }}
            >
              {expansionChipLabel(exp.name, variant)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
