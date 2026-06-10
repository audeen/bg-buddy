"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  activeFilterLabels,
  clearFilterKind,
  filtersToSearchParams,
  parseGameFilters,
  parseGameSort,
  ratingTierOptions,
  SORT_OPTIONS,
  TIME_BUCKET_OPTIONS,
  WEIGHT_LEVEL_OPTIONS,
  type GameFilterKind,
  type GameFilters,
  type GameSort,
  type RatingBlock,
} from "@/lib/game-filters";

function scrollToElement(id: string) {
  requestAnimationFrame(() => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

type GamesFilterBarProps = {
  genres: string[];
  ratingBlocks: RatingBlock[];
  basePath?: string;
  hideExpansions?: boolean;
  scrollToId?: string;
};

const EMPTY_FILTERS: GameFilters = {
  q: "",
  players: null,
  time: null,
  genre: "",
  mechanic: "",
  playerRange: null,
  playtime: null,
  weight: null,
  rating: null,
  best: null,
  includeExpansions: false,
};

export function GamesFilterBar({
  genres,
  ratingBlocks,
  basePath = "/games",
  hideExpansions = false,
  scrollToId,
}: GamesFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const sp = Object.fromEntries(searchParams.entries()) as Record<string, string>;
  const filters = parseGameFilters(sp);
  const sort = parseGameSort(sp);

  const navigate = (next: GameFilters, nextSort: GameSort = sort) => {
    const params = filtersToSearchParams(next, nextSort);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      if (scrollToId) scrollToElement(scrollToId);
    });
  };

  const updateField = (patch: Partial<GameFilters>) => {
    navigate({ ...filters, ...patch });
  };

  const removeFilter = (kind: GameFilterKind) => {
    navigate(clearFilterKind(filters, kind));
  };

  const resetFilters = () => {
    navigate(EMPTY_FILTERS, sort);
  };

  const activeLabels = activeFilterLabels(filters);
  const ratingOptions = ratingTierOptions(ratingBlocks);

  return (
    <div className="flex flex-col gap-3">
      <details className="filter-dropdown">
        <summary className="filter-dropdown-summary">
          <span className="font-semibold text-sm">Filter</span>
          {activeLabels.length > 0 && (
            <span className="filter-dropdown-badge">{activeLabels.length}</span>
          )}
          <span className="filter-dropdown-chevron" aria-hidden="true">
            ▼
          </span>
        </summary>

        <div className="filter-dropdown-body flex flex-col gap-3">
      <div className="filter-bar grid gap-3 sm:grid-cols-4 items-end">
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
      </div>

      <div className="filter-bar grid gap-3 sm:grid-cols-4 items-end">
        <div>
          <label className="label" htmlFor="games-weight">
            Komplexität
          </label>
          <select
            id="games-weight"
            value={filters.weight ?? ""}
            onChange={(e) =>
              updateField({
                weight: e.target.value
                  ? (e.target.value as GameFilters["weight"])
                  : null,
              })
            }
            className="input"
          >
            <option value="">egal</option>
            {WEIGHT_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="games-rating">
            Rating
          </label>
          <select
            id="games-rating"
            value={filters.rating ?? ""}
            onChange={(e) =>
              updateField({
                rating: e.target.value
                  ? (parseInt(e.target.value, 10) as RatingBlock)
                  : null,
              })
            }
            className="input"
          >
            <option value="">egal</option>
            {ratingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="games-sort">
            Sortierung
          </label>
          <select
            id="games-sort"
            value={sort}
            onChange={(e) => navigate(filters, e.target.value as GameSort)}
            className="input"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {!hideExpansions && (
          <label className="flex items-center gap-2 text-sm min-h-[2.75rem]">
            <input
              type="checkbox"
              checked={filters.includeExpansions}
              onChange={(e) => updateField({ includeExpansions: e.target.checked })}
            />
            Erweiterungen anzeigen
          </label>
        )}
      </div>
        </div>
      </details>

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
              onClick={resetFilters}
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
