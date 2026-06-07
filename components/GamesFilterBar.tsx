"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import {
  activeFilterLabels,
  clearFilterKind,
  filtersToSearchParams,
  parseGameFilters,
  TIME_BUCKET_OPTIONS,
  type GameFilterKind,
  type GameFilters,
} from "@/lib/game-filters";

type GamesFilterBarProps = {
  genres: string[];
};

export function GamesFilterBar({ genres }: GamesFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const filters = parseGameFilters(
    Object.fromEntries(searchParams.entries()) as Record<string, string>,
  );

  const navigate = useCallback(
    (next: GameFilters) => {
      const params = filtersToSearchParams(next);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/games?${qs}` : "/games", { scroll: false });
      });
    },
    [router, startTransition],
  );

  const updateField = (patch: Partial<GameFilters>) => {
    navigate({ ...filters, ...patch });
  };

  const removeFilter = (kind: GameFilterKind) => {
    navigate(clearFilterKind(filters, kind));
  };

  const activeLabels = activeFilterLabels(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="filter-bar grid gap-3 sm:grid-cols-6 items-end">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="games-q">
            Suche
          </label>
          <input
            id="games-q"
            value={filters.q}
            onChange={(e) => updateField({ q: e.target.value })}
            className="input"
            placeholder="Spielname…"
          />
        </div>
        <div>
          <label className="label" htmlFor="games-players">
            Spieleranzahl
          </label>
          <select
            id="games-players"
            value={filters.players ?? ""}
            onChange={(e) =>
              updateField({
                players: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
            className="input"
          >
            <option value="">egal</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} Spieler
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="games-time">
            Spielzeit
          </label>
          <select
            id="games-time"
            value={filters.time ?? ""}
            onChange={(e) =>
              updateField({
                time: e.target.value
                  ? (e.target.value as GameFilters["time"])
                  : null,
              })
            }
            className="input"
          >
            <option value="">egal</option>
            {TIME_BUCKET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="games-genre">
            Genre
          </label>
          <select
            id="games-genre"
            value={filters.genre}
            onChange={(e) => updateField({ genre: e.target.value })}
            className="input"
          >
            <option value="">alle</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={filters.includeExpansions}
            onChange={(e) => updateField({ includeExpansions: e.target.checked })}
          />
          Erweiterungen anzeigen
        </label>
      </div>

      {activeLabels.length > 0 && (
        <div className="active-filters">
          <span className="text-sm text-[var(--muted)] shrink-0">Aktive Filter:</span>
          <div className="flex flex-wrap gap-2 items-center">
            {activeLabels.map((item) => (
              <button
                key={item.kind}
                type="button"
                className="chip chip-active chip-interactive"
                onClick={() => removeFilter(item.kind)}
                aria-label={`Filter „${item.label}" entfernen`}
              >
                {item.label}
                <span aria-hidden="true" className="ml-0.5 opacity-70">
                  ×
                </span>
              </button>
            ))}
            <button
              type="button"
              className="text-sm text-[var(--accent)] hover:underline shrink-0"
              onClick={() => router.push("/games", { scroll: false })}
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
