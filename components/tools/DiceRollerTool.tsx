"use client";

import { useEffect, useState } from "react";
import type { RegisteredPlayer } from "@/lib/meetup-participants";
import { prefersReducedMotion } from "@/lib/motion";

const DICE_VALUES = [1, 2, 3, 4, 5, 6] as const;
type DiceValue = (typeof DICE_VALUES)[number];

const DIE_TYPES = [
  { sides: 6, label: "d6" },
  { sides: 20, label: "d20" },
] as const;
type Sides = (typeof DIE_TYPES)[number]["sides"];

// Rotation des Würfels, damit die jeweilige Augenzahl zum Betrachter (Front)
// zeigt. Korrespondiert mit den .die-face-N Transforms in globals.css.
const FACE_ROTATION: Record<DiceValue, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: 180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
};

// Pip-Positionen je Augenzahl (Klassen-Suffixe der .die-pip-* Zellen).
const PIP_LAYOUT: Record<DiceValue, string[]> = {
  1: ["c"],
  2: ["tl", "br"],
  3: ["tl", "c", "br"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "c", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};

type DieState = { value: number; turns: number; duration: number };

function rollValue(sides: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

function CubeDie({ value, turns, duration }: DieState) {
  const { x, y } = FACE_ROTATION[value as DiceValue];
  const transform = `rotateX(${x + 360 * turns}deg) rotateY(${y + 360 * turns}deg)`;

  return (
    <div
      className="die"
      style={{ transform, transitionDuration: `${duration}s` }}
      aria-hidden
    >
      {DICE_VALUES.map((face) => (
        <div key={face} className={`die-face die-face-${face}`}>
          {PIP_LAYOUT[face].map((pos, i) => (
            <span key={i} className={`die-pip die-pip-${pos}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PolyDie({
  value,
  sides,
  duration,
  rolling,
}: {
  value: number;
  sides: number;
  duration: number;
  rolling: boolean;
}) {
  const [flicker, setFlicker] = useState(value);
  const reduced = prefersReducedMotion();
  const cycling = rolling && !reduced;

  useEffect(() => {
    if (!cycling) return;
    let cancelled = false;
    let timeoutId = 0;
    const start = performance.now();
    const total = duration * 1000;

    const tick = () => {
      if (cancelled) return;
      const t = Math.min((performance.now() - start) / total, 1);
      if (t >= 1) {
        // Auf dem echten Ergebnis landen und stoppen.
        setFlicker(value);
        return;
      }
      setFlicker(rollValue(sides));
      // Abstand zwischen den Zahlen wächst (ease-out), passend zum Spin.
      const delay = 55 + t * t * 320;
      timeoutId = window.setTimeout(tick, delay);
    };
    timeoutId = window.setTimeout(tick, 55);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [cycling, sides, value, duration]);

  const shown = cycling ? flicker : value;

  return (
    <div
      className={`d20${rolling ? " d20-rolling" : ""}`}
      style={{ animationDuration: `${duration}s` }}
      aria-hidden
    >
      <span className="d20-num">{shown}</span>
    </div>
  );
}

function Die({
  die,
  sides,
  rolling,
}: {
  die: DieState;
  sides: number;
  rolling: boolean;
}) {
  return (
    <div className="dice-scene">
      <div
        className={`die-throw${rolling ? " die-throw-rolling" : ""}`}
        style={{ animationDuration: `${die.duration}s` }}
      >
        {sides === 6 ? (
          <CubeDie {...die} />
        ) : (
          <PolyDie
            value={die.value}
            sides={sides}
            duration={die.duration}
            rolling={rolling}
          />
        )}
      </div>
    </div>
  );
}

export function DiceRollerTool({ players }: { players: RegisteredPlayer[] }) {
  const [sides, setSides] = useState<Sides>(6);
  const [dice, setDice] = useState<Record<string, DieState>>({});
  const [rollingIds, setRollingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rolling = rollingIds.size > 0;
  const hasRolled = Object.keys(dice).length > 0;

  function changeSides(next: Sides) {
    if (rolling || next === sides) return;
    setSides(next);
    setDice({});
    setSelected(new Set());
  }

  function toggleSelect(userId: string) {
    if (rolling) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selectTied() {
    if (rolling) return;
    const values = players
      .map((p) => dice[p.userId]?.value)
      .filter((v): v is number => v != null);
    if (values.length === 0) return;
    const max = Math.max(...values);
    const tiedIds = players
      .filter((p) => dice[p.userId]?.value === max)
      .map((p) => p.userId);
    setSelected(new Set(tiedIds));
  }

  function handleRoll() {
    // Ausgewählte würfeln; ist nichts ausgewählt, würfeln alle.
    const targets =
      selected.size > 0
        ? players.filter((p) => selected.has(p.userId))
        : players;
    if (targets.length === 0) return;

    const ids = new Set(targets.map((p) => p.userId));
    setRollingIds(ids);
    setDice((prev) => {
      const next = { ...prev };
      for (const p of targets) {
        const prevTurns = prev[p.userId]?.turns ?? 0;
        next[p.userId] = {
          value: rollValue(sides),
          turns: prevTurns + 2 + Math.floor(Math.random() * 2),
          duration: 1 + Math.random() * 0.5,
        };
      }
      return next;
    });
    setSelected(new Set());
    window.setTimeout(() => setRollingIds(new Set()), 1600);
  }

  const rolledValues = players
    .map((p) => dice[p.userId]?.value)
    .filter((v): v is number => v != null);
  const maxValue = rolledValues.length > 0 ? Math.max(...rolledValues) : 0;
  const winnerCount = rolledValues.filter((v) => v === maxValue).length;
  const isTie = hasRolled && !rolling && maxValue > 0 && winnerCount > 1;

  if (players.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Noch keine Teilnehmer – sobald jemand dabei ist, kann gewürfelt werden.
      </p>
    );
  }

  const rollLabel = !hasRolled
    ? "Würfeln"
    : selected.size > 0
      ? `Auswahl würfeln (${selected.size})`
      : "Alle neu würfeln";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="segment-control self-start">
          {DIE_TYPES.map((t) => (
            <button
              key={t.sides}
              type="button"
              className={`btn btn-tab btn-sm ${
                sides === t.sides ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => changeSides(t.sides)}
              disabled={rolling}
              aria-pressed={sides === t.sides}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRoll}
          disabled={rolling}
        >
          {rolling ? "Würfelt …" : rollLabel}
        </button>
        {isTie && (
          <button
            type="button"
            className="chip chip-accent chip-interactive"
            onClick={selectTied}
          >
            Gleichstand bei {maxValue} – Betroffene auswählen
          </button>
        )}
      </div>

      {hasRolled && (
        <p className="text-xs text-[var(--muted)]">
          Tippe Spieler an, um nur sie neu zu würfeln. Ohne Auswahl würfeln
          alle.
        </p>
      )}

      <div className="dice-arena">
        {players.map((p) => {
          const die = dice[p.userId] ?? {
            value: 1,
            turns: 0,
            duration: 1.2,
          };
          const dieRolling = rollingIds.has(p.userId);
          const isWinner =
            hasRolled &&
            !rolling &&
            !isTie &&
            maxValue > 0 &&
            die.value === maxValue;
          const isSelected = selected.has(p.userId);
          return (
            <button
              type="button"
              key={p.userId}
              onClick={() => toggleSelect(p.userId)}
              disabled={rolling}
              aria-pressed={isSelected}
              className={`dice-player${isWinner ? " dice-player-winner" : ""}${
                isSelected ? " dice-player-selected" : ""
              }`}
            >
              <Die die={die} sides={sides} rolling={dieRolling} />
              <span className="dice-player-name" title={p.name}>
                {p.name}
              </span>
              <span className="dice-value">
                {hasRolled && !dieRolling && (
                  <span
                    className={`chip ${isWinner ? "chip-rating" : "chip-meta"}`}
                  >
                    {die.value}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
