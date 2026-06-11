"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  purgeCollectionAction,
  removeGameFromCollectionAction,
  setGameLentOutAction,
} from "@/app/actions";
import { PlusIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type CollectionGameRow = {
  id: number;
  name: string;
  year: number | null;
  isExpansion: boolean;
  manuallyEditedFields: string[];
  lentOut: boolean;
};

/** Welche Aktion gerade läuft — pro Zeile statt global. */
type PendingAction =
  | { type: "lent"; id: number }
  | { type: "remove"; id: number }
  | { type: "purge" }
  | null;

type ConfirmState =
  | { type: "remove"; game: CollectionGameRow }
  | { type: "purge" }
  | null;

export function CollectionManagerClient({
  games,
  onAddGame,
}: {
  games: CollectionGameRow[];
  onAddGame?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [query, setQuery] = useState("");
  const [onlyBase, setOnlyBase] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const manualCount = useMemo(
    () => games.filter((g) => g.manuallyEditedFields.length > 0).length,
    [games],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (onlyBase && g.isExpansion) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q);
    });
  }, [games, query, onlyBase]);

  function runPurge() {
    setMessage(null);
    setError(null);
    setPendingAction({ type: "purge" });
    startTransition(async () => {
      const res = await purgeCollectionAction();
      setPendingAction(null);
      setConfirm(null);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const deleted = res && "deleted" in res ? res.deleted : games.length;
      setMessage(
        deleted === 0
          ? "Sammlung ist bereits leer."
          : `${deleted} ${deleted === 1 ? "Spiel" : "Spiele"} aus der Datenbank gelöscht.`,
      );
      router.refresh();
    });
  }

  function toggleLentOut(game: CollectionGameRow) {
    const nextLent = !game.lentOut;
    const label = game.name;

    setMessage(null);
    setError(null);
    setPendingAction({ type: "lent", id: game.id });
    startTransition(async () => {
      const res = await setGameLentOutAction(game.id, nextLent);
      setPendingAction(null);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage(
        nextLent
          ? `„${label}" als verliehen markiert.`
          : `„${label}" wieder verfügbar.`,
      );
      router.refresh();
    });
  }

  function runRemove(game: CollectionGameRow) {
    const label = game.name;
    setMessage(null);
    setError(null);
    setPendingAction({ type: "remove", id: game.id });
    startTransition(async () => {
      const res = await removeGameFromCollectionAction(game.id);
      setPendingAction(null);
      setConfirm(null);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage(`„${label}" wurde gelöscht.`);
      router.refresh();
    });
  }

  const isPending = (check: (a: NonNullable<PendingAction>) => boolean) =>
    pendingAction != null && check(pendingAction);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted)]">
        Bearbeite Metadaten und Erweiterungszuordnungen pro Spiel. Gespeicherte
        Änderungen werden beim CSV-Import als Konflikt erkannt —
        du kannst sie behalten oder überschreiben.
      </p>
      {manualCount > 0 && (
        <p className="text-sm text-[var(--accent)]">
          {manualCount} {manualCount === 1 ? "Spiel hat" : "Spiele haben"} manuell
          bearbeitete Felder.
        </p>
      )}

      <div className="filter-bar flex flex-wrap gap-2 items-center">
        {onAddGame && (
          <button
            type="button"
            className="btn btn-ghost shrink-0 w-[2.75rem] h-[2.75rem] p-0"
            aria-label="Spiel hinzufügen"
            title="Spiel hinzufügen"
            onClick={onAddGame}
          >
            <PlusIcon />
          </button>
        )}
        <div className="flex-1 min-w-[10rem]">
          <label className="sr-only" htmlFor="collection-search">
            Suche
          </label>
          <input
            id="collection-search"
            type="search"
            className="input w-full"
            placeholder="Spielname…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0">
          <input
            type="checkbox"
            checked={onlyBase}
            onChange={(e) => setOnlyBase(e.target.checked)}
          />
          Nur Basisspiele
        </label>
      </div>

      {message && (
        <p className="text-sm text-[var(--accent)]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <p className="text-sm text-[var(--muted)]">
        {filtered.length} von {games.length}{" "}
        {games.length === 1 ? "Spiel" : "Spielen"}
      </p>

      {games.length === 0 ? (
        <div
          className="card card-pad flex flex-col items-start gap-3"
        >
          <h2 className="section-title">Noch keine Spiele in der Sammlung</h2>
          <p className="text-sm text-[var(--muted)]">
            Importiere deine BGG-Sammlung oder füge ein Spiel manuell hinzu.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/import" className="btn btn-primary">
              Sammlung importieren
            </Link>
            {onAddGame && (
              <button type="button" className="btn btn-ghost" onClick={onAddGame}>
                Spiel hinzufügen
              </button>
            )}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--muted)]">Keine Spiele passen zum Filter.</p>
      ) : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">
          {filtered.map((g) => (
            <li
              key={g.id}
              className="ranking-row flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <Link
                  href={`/games/${g.id}`}
                  className="font-semibold hover:underline truncate"
                >
                  {g.name}
                </Link>
                <span className="text-xs text-[var(--muted)]">
                  BGG #{g.id}
                  {g.year ? ` · ${g.year}` : ""}
                  {g.isExpansion ? " · Erweiterung" : ""}
                  {g.lentOut ? " · Verliehen" : ""}
                  {g.manuallyEditedFields.length > 0 &&
                    ` · ${g.manuallyEditedFields.length} manuell`}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Link
                  href={`/admin/collection/${g.id}`}
                  className="btn btn-ghost w-full sm:w-auto min-h-[2.75rem] text-center"
                >
                  Bearbeiten
                </Link>
                <button
                  type="button"
                  className={`btn w-full sm:w-auto min-h-[2.75rem] ${
                    g.lentOut ? "btn-primary" : "btn-ghost"
                  }`}
                  disabled={isPending((a) => "id" in a && a.id === g.id)}
                  aria-busy={isPending((a) => a.type === "lent" && a.id === g.id)}
                  onClick={() => toggleLentOut(g)}
                >
                  {isPending((a) => a.type === "lent" && a.id === g.id)
                    ? "Speichere…"
                    : g.lentOut
                      ? "Zurückgegeben"
                      : "Spiel verliehen"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-[var(--danger)] w-full sm:w-auto min-h-[2.75rem]"
                  disabled={isPending((a) => "id" in a && a.id === g.id)}
                  onClick={() => setConfirm({ type: "remove", game: g })}
                >
                  Entfernen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section
        className="card card-pad flex flex-col gap-3 border-dashed"
      >
        <h2 className="font-bold text-sm text-[var(--danger)]">Gefahrenbereich</h2>
        <p className="text-sm text-[var(--muted)]">
          Löscht <strong>alle</strong> Spiele aus der Datenbank. Stimmen in Treffen
          werden mitgelöscht, Duell-Snapshots in Meetups zurückgesetzt. Danach kannst
          du auf der Import-Seite mit einer frischen CSV neu starten.
        </p>
        <button
          type="button"
          className="btn btn-ghost text-[var(--danger)] w-full sm:w-fit min-h-[2.75rem]"
          disabled={isPending((a) => a.type === "purge") || games.length === 0}
          onClick={() => setConfirm({ type: "purge" })}
        >
          Sammlung leeren
        </button>
      </section>

      <ConfirmDialog
        open={confirm?.type === "remove"}
        title={
          confirm?.type === "remove"
            ? `„${confirm.game.name}" löschen?`
            : ""
        }
        description="Das Spiel wird endgültig aus der Datenbank gelöscht. Stimmen in Treffen für dieses Spiel werden ebenfalls gelöscht."
        confirmLabel="Endgültig löschen"
        pendingLabel="Lösche…"
        pending={isPending((a) => a.type === "remove")}
        onConfirm={() => {
          if (confirm?.type === "remove") runRemove(confirm.game);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.type === "purge"}
        title={`Alle ${games.length} Spiele löschen?`}
        description={
          "Alle Spiele werden endgültig aus der Datenbank gelöscht.\nStimmen in Treffen werden mitgelöscht, Treffen bleiben bestehen."
        }
        confirmLabel="Alles endgültig löschen"
        pendingLabel="Lösche…"
        pending={isPending((a) => a.type === "purge")}
        onConfirm={runPurge}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
