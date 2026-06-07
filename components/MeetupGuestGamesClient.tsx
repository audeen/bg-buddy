"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GameCover } from "@/components/GameCover";
import { AddGameModal } from "@/components/BarcodeScanClient";
import {
  addGuestGameToMeetupAction,
  removeAllGuestGamesFromMeetupAction,
} from "@/app/actions";

export type MeetupGuestGameRow = {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
};

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MeetupGuestGamesClient({
  meetupId,
  guestGames,
}: {
  meetupId: string;
  guestGames: MeetupGuestGameRow[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemoveAll() {
    if (guestGames.length === 0) return;
    if (
      !window.confirm(
        "Alle temporären Spiele und zugehörige Stimmen für dieses Treffen entfernen?",
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await removeAllGuestGamesFromMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Temporäre Spiele</h3>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Nur für dieses Treffen — erscheinen auf der Pick-Seite, nicht in der
          Sammlung.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          className="btn btn-primary gap-2"
          onClick={() => setAddOpen(true)}
        >
          <PlusIcon />
          Spiel zu diesem Treffen hinzufügen
        </button>
        <button
          type="button"
          className="btn btn-ghost text-[var(--primary)]"
          disabled={pending || guestGames.length === 0}
          onClick={handleRemoveAll}
        >
          {pending ? "Wird entfernt …" : "Alle temporären Spiele entfernen"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--primary)]" role="alert">
          {error}
        </p>
      )}

      {guestGames.length > 0 && (
        <ul className="flex flex-col gap-2">
          {guestGames.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <GameCover
                src={g.thumbnail ?? g.image}
                alt={g.name}
                className="h-12 w-9 shrink-0 rounded"
              />
              <span className="text-sm font-medium">{g.name}</span>
            </li>
          ))}
        </ul>
      )}

      <AddGameModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Spiel zum Treffen hinzufügen"
        hint="Barcode scannen oder BGG-ID eingeben. Das Spiel gilt nur für dieses Treffen."
        variant="meetup"
        onAdd={(bggId, options) => addGuestGameToMeetupAction(meetupId, bggId, options)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
