"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { HostChoiceMode } from "@prisma/client";
import { GameCover } from "@/components/GameCover";
import { resolveCoverSrc } from "@/lib/cover-image";
import { AddGameModal } from "@/components/AddGameModal";
import { PlusIcon } from "@/components/icons";
import {
  addGuestGameToMeetupAction,
  addHostChoiceGameAction,
  clearForcedMeetupGameAction,
  clearHostChoiceGamesAction,
  forceMeetupGameAction,
  removeAllGuestGamesFromMeetupAction,
  removeHostChoiceGameAction,
  searchCollectionGamesAction,
  setHostChoiceModeAction,
} from "@/app/actions";

export type SpielsteuerungGameRow = {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  coverUrl?: string | null;
};

type SearchResult = { id: number; name: string; thumbnail: string | null };

function buildSummaryText({
  forcedGame,
  hostChoiceGames,
  hostChoiceMode,
  guestGames,
}: {
  forcedGame: SpielsteuerungGameRow | null;
  hostChoiceGames: SpielsteuerungGameRow[];
  hostChoiceMode: HostChoiceMode;
  guestGames: SpielsteuerungGameRow[];
}): string {
  const parts: string[] = [];
  if (forcedGame) {
    parts.push(`${forcedGame.name} festgelegt`);
  }
  if (hostChoiceGames.length > 0) {
    const modeLabel =
      hostChoiceMode === "RESTRICT" ? "Nur Vorauswahl" : "Hervorheben";
    parts.push(
      `${hostChoiceGames.length} in Vorauswahl (${modeLabel})`,
    );
  }
  if (guestGames.length > 0) {
    parts.push(
      `${guestGames.length} temporär${guestGames.length === 1 ? "" : "e"}`,
    );
  }
  if (parts.length === 0) return "Nichts festgelegt";
  return parts.join(" · ");
}

export function MeetupSpielsteuerungClient({
  meetupId,
  forcedGame,
  hostChoiceGames,
  hostChoiceMode,
  guestGames = [],
}: {
  meetupId: string;
  forcedGame: SpielsteuerungGameRow | null;
  hostChoiceGames: SpielsteuerungGameRow[];
  hostChoiceMode: HostChoiceMode;
  guestGames?: SpielsteuerungGameRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [guestRemovePending, setGuestRemovePending] = useState(false);
  const [clearChoicePending, setClearChoicePending] = useState(false);

  const [query, setQuery] = useState("");
  const [searchResponse, setSearchResponse] = useState<{
    query: string;
    games: SearchResult[];
  }>({ query: "", games: [] });
  const [searching, setSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null);
  const [forceConfirmGame, setForceConfirmGame] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const hasConfig =
    !!forcedGame || hostChoiceGames.length > 0 || guestGames.length > 0;

  const choiceIds = useMemo(
    () => new Set(hostChoiceGames.map((g) => g.id)),
    [hostChoiceGames],
  );

  const guestGameIds = useMemo(
    () => new Set(guestGames.map((g) => g.id)),
    [guestGames],
  );

  const summaryText = buildSummaryText({
    forcedGame,
    hostChoiceGames,
    hostChoiceMode,
    guestGames,
  });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || forcedGame) return;

    // Verhindert, dass eine überholte Antwort neuere Ergebnisse überschreibt.
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchCollectionGamesAction(q, meetupId);
      if (cancelled) return;
      setSearching(false);
      if (res && "games" in res && res.games) {
        setSearchResponse({ query: q, games: res.games });
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, forcedGame, meetupId]);

  // Ergebnisse nur zeigen, solange sie zur aktuellen Suche passen.
  const trimmedQuery = query.trim();
  const results =
    trimmedQuery.length >= 2 &&
    !forcedGame &&
    searchResponse.query === trimmedQuery
      ? searchResponse.games
      : [];

  function runAction(fn: () => Promise<{ error?: string } | { ok: true }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSelectedGame(null);
      setForceConfirmGame(null);
      setQuery("");
      setSearchResponse({ query: "", games: [] });
      router.refresh();
    });
  }

  function handleRemoveAllGuest() {
    if (guestGames.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await removeAllGuestGamesFromMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setGuestRemovePending(false);
      router.refresh();
    });
  }

  function handleClearHostChoice() {
    setError(null);
    startTransition(async () => {
      const res = await clearHostChoiceGamesAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setClearChoicePending(false);
      router.refresh();
    });
  }

  return (
    <details
      className="spielsteuerung-details"
      open={hasConfig || undefined}
    >
      <summary className="spielsteuerung-summary">
        <span className="text-sm font-semibold">Spielsteuerung</span>
        <span className="text-xs text-[var(--muted)] truncate min-w-0 flex-1">
          {summaryText}
        </span>
        <span className="spielsteuerung-chevron" aria-hidden>
          ▾
        </span>
      </summary>

      <div className="spielsteuerung-body">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--muted)]">
            Temporäre Spiele nur für dieses Treffen.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className="btn btn-primary gap-2"
              onClick={() => setAddGuestOpen(true)}
            >
              <PlusIcon />
              Temporäres Spiel
            </button>
            {guestGames.length > 0 && !guestRemovePending && (
              <button
                type="button"
                className="btn btn-ghost text-[var(--primary)]"
                disabled={pending}
                onClick={() => setGuestRemovePending(true)}
              >
                Alle temporären entfernen
              </button>
            )}
          </div>
          {guestRemovePending && (
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
              <p className="text-sm">
                Alle temporären Spiele und zugehörige Stimmen entfernen?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={pending}
                  onClick={handleRemoveAllGuest}
                >
                  Entfernen
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setGuestRemovePending(false)}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          {guestGames.length > 0 && (
            <ul className="flex flex-col gap-1">
              {guestGames.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
                >
                  <GameCover
                    src={g.thumbnail ?? g.image}
                    alt={g.name}
                    className="h-10 w-8 shrink-0 rounded"
                  />
                  <span className="truncate flex-1">{g.name}</span>
                  {!forcedGame && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending}
                        onClick={() => setForceConfirmGame(g)}
                      >
                        Festlegen
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending || choiceIds.has(g.id)}
                        title={
                          choiceIds.has(g.id)
                            ? "Bereits in der Vorauswahl"
                            : undefined
                        }
                        onClick={() =>
                          runAction(() =>
                            addHostChoiceGameAction(meetupId, g.id),
                          )
                        }
                      >
                        Zur Vorauswahl
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {forcedGame ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--accent)] bg-[var(--surface-elevated)] p-3">
            <GameCover
              src={resolveCoverSrc(forcedGame)}
              alt={forcedGame.name}
              className="h-16 w-12 shrink-0 rounded"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--accent)]">
                Festgelegt
              </span>
              <span className="text-sm font-semibold truncate">
                {forcedGame.name}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm shrink-0"
              disabled={pending}
              onClick={() =>
                runAction(() => clearForcedMeetupGameAction(meetupId))
              }
            >
              Aufheben
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[var(--muted)]">
              Spiel suchen…
            </label>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedGame(null);
                setForceConfirmGame(null);
              }}
              placeholder="Spiel suchen…"
              disabled={pending}
              className="input w-full"
              autoComplete="off"
            />
            {searching && (
              <p className="text-xs text-[var(--muted)]">Suche…</p>
            )}
            {results.length > 0 && !selectedGame && !forceConfirmGame && (
              <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] p-1">
                {results.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setSelectedGame(g)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-elevated)]"
                    >
                      <GameCover
                        src={g.thumbnail}
                        alt={g.name}
                        className="h-10 w-8 shrink-0 rounded"
                      />
                      <span className="truncate">{g.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedGame && !forceConfirmGame && (
              <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <p className="text-sm font-semibold">{selectedGame.name}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pending}
                    onClick={() => setForceConfirmGame(selectedGame)}
                  >
                    Festlegen
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending || choiceIds.has(selectedGame.id)}
                    title={
                      choiceIds.has(selectedGame.id)
                        ? "Bereits in der Vorauswahl"
                        : undefined
                    }
                    onClick={() =>
                      runAction(() =>
                        addHostChoiceGameAction(meetupId, selectedGame.id),
                      )
                    }
                  >
                    Zur Vorauswahl
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedGame(null)}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
            {forceConfirmGame && (
              <div className="flex flex-col gap-2 rounded-lg border border-[var(--accent)] bg-[var(--surface-elevated)] p-3">
                <p className="text-sm">
                  <strong>{forceConfirmGame.name}</strong> festlegen? Keine
                  Abstimmung mehr möglich.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pending}
                    onClick={() =>
                      runAction(() =>
                        forceMeetupGameAction(meetupId, forceConfirmGame.id),
                      )
                    }
                  >
                    Festlegen
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setForceConfirmGame(null)}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!forcedGame && hostChoiceGames.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-[var(--muted)] mb-1">
                Vorauswahl-Modus
              </legend>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="hostChoiceMode"
                  checked={hostChoiceMode === "HIGHLIGHT"}
                  disabled={pending}
                  onChange={() =>
                    runAction(() =>
                      setHostChoiceModeAction(meetupId, "HIGHLIGHT"),
                    )
                  }
                />
                Hervorheben — oben auf der Pick-Seite
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="hostChoiceMode"
                  checked={hostChoiceMode === "RESTRICT"}
                  disabled={pending}
                  onChange={() =>
                    runAction(() =>
                      setHostChoiceModeAction(meetupId, "RESTRICT"),
                    )
                  }
                />
                Nur Vorauswahl — Auswahl einschränken
              </label>
            </fieldset>

            <ul className="flex flex-col gap-2">
              {hostChoiceGames.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2"
                >
                  <GameCover
                    src={resolveCoverSrc(g)}
                    alt={g.name}
                    className="h-10 w-8 shrink-0 rounded"
                  />
                  <span className="flex-1 text-sm truncate">{g.name}</span>
                  {guestGameIds.has(g.id) && (
                    <span className="text-xs text-[var(--muted)] shrink-0">
                      Temporär
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending}
                    onClick={() =>
                      runAction(() =>
                        removeHostChoiceGameAction(meetupId, g.id),
                      )
                    }
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>

            {!clearChoicePending ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm self-start"
                disabled={pending}
                onClick={() => setClearChoicePending(true)}
              >
                Vorauswahl leeren
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm">Alle Spiele aus der Vorauswahl entfernen?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pending}
                    onClick={handleClearHostChoice}
                  >
                    Leeren
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setClearChoicePending(false)}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
      </div>

      <AddGameModal
        open={addGuestOpen}
        onOpenChange={setAddGuestOpen}
        title="Spiel zum Treffen hinzufügen"
        hint="Barcode scannen, Spielname suchen oder BGG-ID eingeben. Das Spiel gilt nur für dieses Treffen."
        variant="meetup"
        onAdd={(bggId, options) =>
          addGuestGameToMeetupAction(meetupId, bggId, options)
        }
        onSuccess={() => router.refresh()}
      />
    </details>
  );
}
