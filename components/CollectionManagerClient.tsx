"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeGameFromCollectionAction } from "@/app/actions";

export type CollectionGameRow = {
  id: number;
  name: string;
  year: number | null;
  isExpansion: boolean;
};

export function CollectionManagerClient({ games }: { games: CollectionGameRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyBase, setOnlyBase] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (onlyBase && g.isExpansion) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q);
    });
  }, [games, query, onlyBase]);

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
        Entfernte Spiele verschwinden aus Sammlung, Pick und Duell. Beim nächsten
        CSV-Import werden Einträge aus der Datei wieder angelegt — exportiere auf
        BGG nur Spiele, die du wirklich besitzt.
      </p>

      <div className="filter-bar flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="collection-search">Suche</label>
          <input
            id="collection-search"
            type="search"
            className="input"
            placeholder="Spielname…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm pb-2 sm:pb-3">
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
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-[var(--primary)] w-full sm:w-auto min-h-[44px]"
                disabled={pending}
                onClick={() => removeGame(g)}
              >
                {pending ? "…" : "Entfernen"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
