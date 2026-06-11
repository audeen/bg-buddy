"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/ModalShell";
import type { FieldChoice, GameSyncConflict, SyncFieldName } from "@/lib/game-sync";
import {
  applyExpansionCascade,
  defaultChoicesFromConflicts,
  fieldChoiceKey,
  formatFieldValue,
  SYNC_FIELD_LABELS,
} from "@/lib/game-sync";

export function SyncConflictDialog({
  title,
  description,
  applyLabel,
  conflicts,
  pending,
  onApply,
  onCancel,
}: {
  title: string;
  description: string;
  applyLabel: string;
  conflicts: GameSyncConflict[];
  pending?: boolean;
  onApply: (choices: Record<string, FieldChoice>) => void;
  onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, FieldChoice>>(() =>
    defaultChoicesFromConflicts(conflicts),
  );

  const { visible, cascadedCount } = useMemo(
    () => applyExpansionCascade(conflicts, choices),
    [conflicts, choices],
  );

  const visibleFieldCount = visible.reduce((n, g) => n + g.conflicts.length, 0);

  function setChoice(gameId: number, field: SyncFieldName, choice: FieldChoice) {
    setChoices((prev) => ({
      ...prev,
      [fieldChoiceKey(gameId, field)]: choice,
    }));
  }

  function setAllVisible(choice: FieldChoice) {
    setChoices((prev) => {
      const next = { ...prev };
      for (const game of visible) {
        for (const c of game.conflicts) {
          next[fieldChoiceKey(game.gameId, c.field)] = choice;
        }
      }
      return next;
    });
  }

  return (
    <ModalShell
      labelledBy="sync-conflict-title"
      panelClassName="max-w-3xl w-full"
      dismissDisabled={pending}
      onDismiss={onCancel}
    >
      <div className="modal-body flex flex-col gap-4 safe-bottom">
          <div>
            <h2 id="sync-conflict-title" className="section-title">
              {title}
            </h2>
            <p className="text-sm text-[var(--muted)] mt-1">{description}</p>
            <p className="text-sm mt-2">
              {visible.length} {visible.length === 1 ? "Spiel" : "Spiele"} ·{" "}
              {visibleFieldCount} {visibleFieldCount === 1 ? "Feld" : "Felder"} zur
              Entscheidung
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="text-left text-[var(--muted)]">
                  <th className="p-2 font-medium">Spiel</th>
                  <th className="p-2 font-medium">Feld</th>
                  <th className="p-2 font-medium">Aktuell</th>
                  <th className="p-2 font-medium">Neu</th>
                  <th className="p-2 font-medium">Entscheidung</th>
                </tr>
              </thead>
              <tbody>
                {visible.flatMap((game) =>
                  game.conflicts.map((c) => {
                    const key = fieldChoiceKey(game.gameId, c.field);
                    const choice = choices[key] ?? "keep";
                    return (
                      <tr
                        key={key}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="p-2 align-top">
                          <span className="font-medium">{game.name}</span>
                          <span className="block text-xs text-[var(--muted)]">
                            #{game.gameId}
                          </span>
                        </td>
                        <td className="p-2 align-top">
                          {SYNC_FIELD_LABELS[c.field]}
                        </td>
                        <td className="p-2 align-top text-[var(--muted)] break-all max-w-[8rem]">
                          {formatFieldValue(c.current)}
                        </td>
                        <td className="p-2 align-top break-all max-w-[8rem]">
                          {formatFieldValue(c.incoming)}
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex flex-col gap-1 min-w-[7rem]">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={key}
                                checked={choice === "keep"}
                                disabled={pending}
                                onChange={() =>
                                  setChoice(game.gameId, c.field, "keep")
                                }
                              />
                              Behalten
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={key}
                                checked={choice === "overwrite"}
                                disabled={pending}
                                onChange={() =>
                                  setChoice(game.gameId, c.field, "overwrite")
                                }
                              />
                              Übernehmen
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>

          {cascadedCount > 0 && (
            <p className="text-sm text-[var(--accent)]">
              {cascadedCount}{" "}
              {cascadedCount === 1 ? "Feld entfällt" : "Felder entfallen"}, weil das
              Spiel als Basisspiel behalten wird.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost text-sm whitespace-normal"
                disabled={pending}
                onClick={() => setAllVisible("keep")}
              >
                Alle behalten
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm whitespace-normal"
                disabled={pending}
                onClick={() => setAllVisible("overwrite")}
              >
                Alle überschreiben
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="btn btn-primary btn-lg whitespace-normal"
                disabled={pending || visibleFieldCount === 0}
                onClick={() => onApply(choices)}
              >
                {pending ? "Wende an…" : applyLabel}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-lg whitespace-normal"
                disabled={pending}
                onClick={onCancel}
              >
                Abbrechen
              </button>
            </div>
          </div>
      </div>
    </ModalShell>
  );
}
