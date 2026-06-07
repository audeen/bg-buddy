"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateGameMetadataAction } from "@/app/actions";
import { SYNC_FIELD_LABELS, type SyncFieldName } from "@/lib/game-sync";

export type GameEditData = {
  id: number;
  name: string;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  weight: number | null;
  bggRating: number | null;
  rank: number | null;
  ageRange: string | null;
  languageDependence: string | null;
  isExpansion: boolean;
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  categories: string[];
  mechanics: string[];
  expandsGameIds: number[];
  manuallyEditedFields: string[];
};

export type BaseGameOption = {
  id: number;
  name: string;
};

function intListToString(values: number[]): string {
  return values.join(", ");
}

function ManualBadge({ field, manual }: { field: SyncFieldName; manual: Set<string> }) {
  if (!manual.has(field)) return null;
  return (
    <span className="text-xs text-[var(--accent)] ml-1">(manuell bearbeitet)</span>
  );
}

function FieldLabel({
  htmlFor,
  field,
  manual,
  children,
}: {
  htmlFor: string;
  field: SyncFieldName;
  manual: Set<string>;
  children?: ReactNode;
}) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children ?? SYNC_FIELD_LABELS[field]}
      <ManualBadge field={field} manual={manual} />
    </label>
  );
}

export function GameEditClient({
  game,
  baseGames,
}: {
  game: GameEditData;
  baseGames: BaseGameOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpansion, setIsExpansion] = useState(game.isExpansion);
  const [selectedBaseIds, setSelectedBaseIds] = useState<number[]>(game.expandsGameIds);
  const [extraBaseId, setExtraBaseId] = useState("");

  const manual = new Set(game.manuallyEditedFields);

  function toggleBaseId(id: number) {
    setSelectedBaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].sort((a, b) => a - b),
    );
  }

  function addExtraBaseId() {
    const id = parseInt(extraBaseId.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelectedBaseIds((prev) =>
      prev.includes(id) ? prev : [...prev, id].sort((a, b) => a - b),
    );
    setExtraBaseId("");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    if (isExpansion) {
      formData.set("expandsGameIds", selectedBaseIds.join(", "));
    } else {
      formData.delete("expandsGameIds");
    }
    if (!isExpansion) {
      formData.delete("isExpansion");
    } else {
      formData.set("isExpansion", "on");
    }

    startTransition(async () => {
      const res = await updateGameMetadataAction(game.id, formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage("Änderungen gespeichert.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="card flex flex-col gap-3" style={{ padding: "var(--space-card)" }}>
        <h2 className="section-title">Stammdaten</h2>
        <div>
          <FieldLabel htmlFor="name" field="name" manual={manual} />
          <input
            id="name"
            name="name"
            className="input"
            defaultValue={game.name}
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="year" field="year" manual={manual} />
            <input
              id="year"
              name="year"
              type="number"
              className="input"
              defaultValue={game.year ?? ""}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isExpansion"
                checked={isExpansion}
                onChange={(e) => setIsExpansion(e.target.checked)}
              />
              Erweiterung
              <ManualBadge field="isExpansion" manual={manual} />
            </label>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="minPlayers" field="minPlayers" manual={manual} />
            <input
              id="minPlayers"
              name="minPlayers"
              type="number"
              min={1}
              className="input"
              defaultValue={game.minPlayers ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="maxPlayers" field="maxPlayers" manual={manual} />
            <input
              id="maxPlayers"
              name="maxPlayers"
              type="number"
              min={1}
              className="input"
              defaultValue={game.maxPlayers ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="playingTime" field="playingTime" manual={manual} />
            <input
              id="playingTime"
              name="playingTime"
              type="number"
              className="input"
              defaultValue={game.playingTime ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="minPlaytime" field="minPlaytime" manual={manual} />
            <input
              id="minPlaytime"
              name="minPlaytime"
              type="number"
              className="input"
              defaultValue={game.minPlaytime ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="maxPlaytime" field="maxPlaytime" manual={manual} />
            <input
              id="maxPlaytime"
              name="maxPlaytime"
              type="number"
              className="input"
              defaultValue={game.maxPlaytime ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="weight" field="weight" manual={manual} />
            <input
              id="weight"
              name="weight"
              type="number"
              step="0.01"
              className="input"
              defaultValue={game.weight ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="bggRating" field="bggRating" manual={manual} />
            <input
              id="bggRating"
              name="bggRating"
              type="number"
              step="0.01"
              className="input"
              defaultValue={game.bggRating ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="rank" field="rank" manual={manual} />
            <input
              id="rank"
              name="rank"
              type="number"
              className="input"
              defaultValue={game.rank ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="ageRange" field="ageRange" manual={manual} />
            <input
              id="ageRange"
              name="ageRange"
              className="input"
              defaultValue={game.ageRange ?? ""}
            />
          </div>
          <div>
            <FieldLabel htmlFor="languageDependence" field="languageDependence" manual={manual} />
            <input
              id="languageDependence"
              name="languageDependence"
              className="input"
              defaultValue={game.languageDependence ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="bestPlayerCounts" field="bestPlayerCounts" manual={manual}>
              Beste Spielerzahl (kommagetrennt)
            </FieldLabel>
            <input
              id="bestPlayerCounts"
              name="bestPlayerCounts"
              className="input"
              defaultValue={intListToString(game.bestPlayerCounts)}
              placeholder="z. B. 3, 4, 5"
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="recommendedPlayerCounts"
              field="recommendedPlayerCounts"
              manual={manual}
            >
              Empfohlene Spielerzahl (kommagetrennt)
            </FieldLabel>
            <input
              id="recommendedPlayerCounts"
              name="recommendedPlayerCounts"
              className="input"
              defaultValue={intListToString(game.recommendedPlayerCounts)}
              placeholder="z. B. 4"
            />
          </div>
        </div>
      </section>

      {isExpansion && (
        <section className="card flex flex-col gap-3" style={{ padding: "var(--space-card)" }}>
          <h2 className="section-title">
            Erweiterungszuordnung
            <ManualBadge field="expandsGameIds" manual={manual} />
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Wähle Basisspiele aus der Sammlung oder gib eine BGG-ID ein.
          </p>
          {baseGames.length > 0 ? (
            <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {baseGames.map((b) => (
                <li key={b.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedBaseIds.includes(b.id)}
                      onChange={() => toggleBaseId(b.id)}
                    />
                    {b.name}
                    <span className="text-[var(--muted)]">#{b.id}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Keine Basisspiele in der Sammlung — BGG-ID unten eingeben.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label" htmlFor="extraBaseId">
                Weitere BGG-ID
              </label>
              <input
                id="extraBaseId"
                type="number"
                className="input"
                value={extraBaseId}
                onChange={(e) => setExtraBaseId(e.target.value)}
                placeholder="z. B. 28"
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost sm:w-auto min-h-[44px]"
              onClick={addExtraBaseId}
            >
              Hinzufügen
            </button>
          </div>
          {selectedBaseIds.length > 0 && (
            <p className="text-sm text-[var(--muted)]">
              Zugeordnet: {selectedBaseIds.join(", ")}
            </p>
          )}
        </section>
      )}

      <section className="card flex flex-col gap-3" style={{ padding: "var(--space-card)" }}>
        <h2 className="section-title">Anreicherung</h2>
        <div>
          <FieldLabel htmlFor="description" field="description" manual={manual} />
          <textarea
            id="description"
            name="description"
            className="input min-h-[120px]"
            defaultValue={game.description ?? ""}
          />
        </div>
        <div>
          <FieldLabel htmlFor="image" field="image" manual={manual} />
          <input
            id="image"
            name="image"
            type="url"
            className="input"
            defaultValue={game.image ?? ""}
          />
        </div>
        <div>
          <FieldLabel htmlFor="thumbnail" field="thumbnail" manual={manual} />
          <input
            id="thumbnail"
            name="thumbnail"
            type="url"
            className="input"
            defaultValue={game.thumbnail ?? ""}
          />
        </div>
        <div>
          <FieldLabel htmlFor="categories" field="categories" manual={manual}>
            Kategorien (kommagetrennt)
          </FieldLabel>
          <input
            id="categories"
            name="categories"
            className="input"
            defaultValue={game.categories.join(", ")}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mechanics" field="mechanics" manual={manual}>
            Mechaniken (kommagetrennt)
          </FieldLabel>
          <input
            id="mechanics"
            name="mechanics"
            className="input"
            defaultValue={game.mechanics.join(", ")}
          />
        </div>
      </section>

      {message && <p className="text-sm text-[var(--accent)]">{message}</p>}
      {error && <p className="text-sm text-[var(--primary)]">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={pending}
        >
          {pending ? "Speichern…" : "Speichern"}
        </button>
        <Link href="/admin/collection" className="btn btn-ghost btn-lg">
          Zurück
        </Link>
        <Link href={`/games/${game.id}`} className="btn btn-ghost btn-lg">
          Spiel ansehen
        </Link>
      </div>
    </form>
  );
}
