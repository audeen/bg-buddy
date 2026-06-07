import Link from "next/link";
import { FilterChipButton } from "@/components/FilterChipButton";
import { GameCover } from "@/components/GameCover";
import type { GameCardGame } from "@/components/GameCard";
import { playerRange, playtime, weightLabel } from "@/lib/format";
import { bggBoardgameUrl } from "@/lib/bgg-url";
import type { GameFilters } from "@/lib/game-filters";
import { buildGameTags, categoryTag, mechanicTag } from "@/lib/game-tags";

export interface GameDetailData {
  id: number;
  name: string;
  year: number | null;
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  playingTime: number | null;
  weight: number | null;
  bggRating: number | null;
  ageRange: string | null;
  isExpansion: boolean;
  categories: string[];
  mechanics: string[];
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
}

type GameDetailViewProps = {
  game: GameDetailData;
  titleId?: string;
  compact?: boolean;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  onFilterNavigate?: () => void;
  ownedExpansions?: GameCardGame[];
  onSelectExpansion?: (id: number) => void;
  onSelectBase?: () => void;
  baseGameName?: string;
};

export function GameDetailView({
  game,
  titleId,
  compact = false,
  playerCount,
  activeFilters,
  filterMode,
  onFilterNavigate,
  ownedExpansions,
  onSelectExpansion,
  onSelectBase,
  baseGameName,
}: GameDetailViewProps) {
  const time = playtime(game.minPlaytime, game.maxPlaytime, game.playingTime);
  const weight = weightLabel(game.weight);
  const filterTags = buildGameTags(game, { playerCount });
  const detailMetaTags = filterTags.filter((t) => t.variant !== "default");

  const showPlayerCountHint =
    playerCount != null &&
    (game.bestPlayerCounts.includes(playerCount) ||
      game.recommendedPlayerCounts.includes(playerCount));

  const showExpansionList =
    ownedExpansions &&
    ownedExpansions.length > 0 &&
    onSelectExpansion &&
    !game.isExpansion;

  const showBackToBase =
    game.isExpansion && baseGameName && onSelectBase;

  return (
    <div className="flex flex-col gap-6">
      <div className={`grid gap-6 ${compact ? "grid-cols-1" : "md:grid-cols-[260px_1fr]"}`}>
        <div className="card overflow-hidden flex flex-col" style={{ boxShadow: "var(--shadow-md)" }}>
          <GameCover
            src={game.image ?? game.thumbnail}
            alt={game.name}
            className={`w-full aspect-square ${compact ? "" : "md:aspect-auto"}`}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="page-title" id={titleId}>
              {game.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {game.year ? (
                <p className="text-[var(--muted)]">{game.year}</p>
              ) : null}
              <a
                href={bggBoardgameUrl(game.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Auf BoardGameGeek ansehen ↗
              </a>
            </div>
          </div>

          <div className="chip-row">
            {filterMode ? (
              detailMetaTags.map((tag) => (
                <FilterChipButton
                  key={tag.label}
                  tag={tag}
                  activeFilters={activeFilters}
                  filterMode={filterMode}
                  onNavigate={onFilterNavigate}
                />
              ))
            ) : (
              <>
                <span className="chip chip-meta">
                  {playerRange(game.minPlayers, game.maxPlayers)}
                </span>
                {time && <span className="chip chip-meta">{time}</span>}
                {weight && <span className="chip chip-meta">{weight}</span>}
                {game.bggRating ? (
                  <span className="chip chip-rating">
                    ★ {game.bggRating.toFixed(1)}
                  </span>
                ) : null}
              </>
            )}
            {game.ageRange && (
              <span className="chip chip-meta">ab {game.ageRange}</span>
            )}
            {game.isExpansion && <span className="chip">Erweiterung</span>}
          </div>

          {showBackToBase && (
            <button
              type="button"
              className="text-sm text-[var(--accent)] hover:underline w-fit text-left"
              onClick={onSelectBase}
            >
              ← Zurück zu {baseGameName}
            </button>
          )}

          {showExpansionList && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Erweiterungen in der Sammlung
              </span>
              <div className="chip-row">
                {ownedExpansions.map((exp) => (
                  <button
                    key={exp.id}
                    type="button"
                    className="chip hover:bg-[var(--surface-2)]"
                    onClick={() => onSelectExpansion(exp.id)}
                  >
                    {exp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showPlayerCountHint && (
            <p className="text-sm text-[var(--accent)]">
              {game.bestPlayerCounts.includes(playerCount!) ? (
                <>
                  <span className="font-semibold">Best · {playerCount}P</span> — beste
                  Spieleranzahl laut BGG-Community
                </>
              ) : (
                <>
                  <span className="font-semibold">Empf. · {playerCount}P</span> —
                  empfohlene Spieleranzahl laut BGG-Community
                </>
              )}
            </p>
          )}

          {game.bestPlayerCounts.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold">Beste Spieleranzahl: </span>
              {game.bestPlayerCounts.join(", ")}
              {game.recommendedPlayerCounts.length > 0 && (
                <span className="text-[var(--muted)]">
                  {" "}
                  (empfohlen: {game.recommendedPlayerCounts.join(", ")})
                </span>
              )}
            </p>
          )}

          {game.categories.length > 0 && (
            <div className="chip-row">
              {game.categories.map((c) =>
                filterMode ? (
                  <FilterChipButton
                    key={c}
                    tag={categoryTag(c)}
                    activeFilters={activeFilters}
                    filterMode={filterMode}
                    onNavigate={onFilterNavigate}
                  />
                ) : (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {game.description ? (
        <section
          className="card whitespace-pre-line leading-relaxed"
          style={{ padding: "var(--space-card)" }}
        >
          {game.description}
        </section>
      ) : (
        <p className="text-[var(--muted)] text-sm">
          Noch keine Beschreibung geladen. Starte das Anreichern im{" "}
          <Link href="/admin/import" className="underline">
            Import
          </Link>
          .
        </p>
      )}

      {game.mechanics.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">Mechaniken</h2>
          <div className="chip-row">
            {game.mechanics.map((m) =>
              filterMode ? (
                <FilterChipButton
                  key={m}
                  tag={mechanicTag(m)}
                  activeFilters={activeFilters}
                  filterMode={filterMode}
                  onNavigate={onFilterNavigate}
                />
              ) : (
                <span key={m} className="chip">
                  {m}
                </span>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
