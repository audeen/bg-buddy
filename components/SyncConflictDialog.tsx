"use client";

import type { GameSyncConflict } from "@/lib/game-sync";
import {
  formatFieldValue,
  SYNC_FIELD_LABELS,
} from "@/lib/game-sync";

export function SyncConflictDialog({
  title,
  description,
  conflicts,
  pending,
  onKeepManual,
  onOverwrite,
  onCancel,
}: {
  title: string;
  description: string;
  conflicts: GameSyncConflict[];
  pending?: boolean;
  onKeepManual: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}) {
  const fieldCount = conflicts.reduce((n, g) => n + g.conflicts.length, 0);

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
        className="modal-panel max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-body flex flex-col gap-4 safe-bottom">
          <div>
            <h2 id="sync-conflict-title" className="section-title">
              {title}
            </h2>
            <p className="text-sm text-[var(--muted)] mt-1">{description}</p>
            <p className="text-sm mt-2">
              {conflicts.length} {conflicts.length === 1 ? "Spiel" : "Spiele"} mit{" "}
              {fieldCount} manuell bearbeiteten{" "}
              {fieldCount === 1 ? "Feld" : "Feldern"} betroffen.
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--card)]">
                <tr className="text-left text-[var(--muted)]">
                  <th className="p-2 font-medium">Spiel</th>
                  <th className="p-2 font-medium">Feld</th>
                  <th className="p-2 font-medium">Aktuell</th>
                  <th className="p-2 font-medium">Neu</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.flatMap((game) =>
                  game.conflicts.map((c) => (
                    <tr key={`${game.gameId}-${c.field}`} className="border-t border-[var(--border)]">
                      <td className="p-2 align-top">
                        <span className="font-medium">{game.name}</span>
                        <span className="block text-xs text-[var(--muted)]">
                          #{game.gameId}
                        </span>
                      </td>
                      <td className="p-2 align-top">
                        {SYNC_FIELD_LABELS[c.field]}
                      </td>
                      <td className="p-2 align-top text-[var(--muted)] break-all">
                        {formatFieldValue(c.current)}
                      </td>
                      <td className="p-2 align-top break-all">
                        {formatFieldValue(c.incoming)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="btn btn-primary btn-lg sm:flex-1"
              disabled={pending}
              onClick={onKeepManual}
            >
              {pending ? "…" : "Manuelle Änderungen behalten"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-lg sm:flex-1 text-[var(--primary)]"
              disabled={pending}
              onClick={onOverwrite}
            >
              {pending ? "…" : "Trotzdem überschreiben"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-lg sm:w-auto"
              disabled={pending}
              onClick={onCancel}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
