"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  purgeCollectionAction,
  removeGameFromCollectionAction,
  setGameLentOutAction,
} from "@/app/actions";
import { CameraIcon } from "@/components/icons";

export type CollectionGameRow = {
  id: number;
  name: string;
  year: number | null;
  isExpansion: boolean;
  manuallyEditedFields: string[];
  lentOut: boolean;
};

export function CollectionManagerClient({
  games,
  onAddGame,
}: {
  games: CollectionGameRow[];
  onAddGame?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  function purgeCollection() {
    if (games.length === 0) return;

    if (
      !window.confirm(
        `Wirklich alle ${games.length} Spiele aus der Sammlung löschen?\n\nStimmen in Treffen werden ebenfalls gelöscht. Meetups bleiben bestehen.`,
      )
    ) {
      return;
    }

    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await purgeCollectionAction();
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const deleted = res && "deleted" in res ? res.deleted : games.length;
      setMessage(
        deleted === 0
          ? "Sammlung ist bereits leer."
          : `${deleted} ${deleted === 1 ? "Spiel" : "Spiele"} aus der Sammlung entfernt.`,
      );
      router.refresh();
    });
  }

  function toggleLentOut(game: CollectionGameRow) {
    const nextLent = !game.lentOut;
    const label = game.name;

    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await setGameLentOutAction(game.id, nextLent);
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

  function removeGame(game: CollectionGameRow) {
    const label = game.name;
    if (
      !window.confirm(
        `„${label}" wirklich aus der Sammlung entfernen?\n\nStimmen in Treffen für dieses Spiel werden ebenfalls gelöscht.`,
      )
    ) {
      return;
    }

    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await removeGameFromCollectionAction(game.id);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage(`„${label}" wurde entfernt.`);
      router.refresh();
    });
  }

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
            className="btn btn-ghost shrink-0"
            style={{ width: "2.75rem", height: "2.75rem", padding: 0 }}
            aria-label="Spiel hinzufügen"
            title="Spiel hinzufügen"
            onClick={onAddGame}
          >
            <CameraIcon />
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

      {message && <p className="text-sm text-[var(--accent)]">{message}</p>}
      {error && <p className="text-sm text-[var(--primary)]">{error}</p>}

      <p className="text-sm text-[var(--muted)]">
        {filtered.length} von {games.length}{" "}
        {games.length === 1 ? "Spiel" : "Spielen"}
      </p>

      {filtered.length === 0 ? (
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
                  className="btn btn-ghost w-full sm:w-auto min-h-[44px] text-center"
                >
                  Bearbeiten
                </Link>
                <button
                  type="button"
                  className={`btn w-full sm:w-auto min-h-[44px] ${
                    g.lentOut ? "btn-primary" : "btn-ghost"
                  }`}
                  disabled={pending}
                  onClick={() => toggleLentOut(g)}
                >
                  {pending ? "…" : g.lentOut ? "Zurückgegeben" : "Spiel verliehen"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-[var(--primary)] w-full sm:w-auto min-h-[44px]"
                  disabled={pending}
                  onClick={() => removeGame(g)}
                >
                  {pending ? "…" : "Entfernen"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section
        className="card flex flex-col gap-3 border-dashed"
        style={{ padding: "var(--space-card)" }}
      >
        <h2 className="font-bold text-sm text-[var(--primary)]">Danger Zone</h2>
        <p className="text-sm text-[var(--muted)]">
          Löscht <strong>alle</strong> Spiele aus der Datenbank. Stimmen in Treffen
          werden mitgelöscht, Duell-Snapshots in Meetups zurückgesetzt. Danach kannst
          du auf der Import-Seite mit einer frischen CSV neu starten.
        </p>
        <button
          type="button"
          className="btn btn-ghost text-[var(--primary)] w-full sm:w-fit min-h-[44px]"
          disabled={pending || games.length === 0}
          onClick={purgeCollection}
        >
          {pending ? "…" : "Sammlung leeren"}
        </button>
      </section>
    </div>
  );
}
