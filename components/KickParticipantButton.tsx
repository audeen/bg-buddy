"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kickParticipantAction } from "@/app/actions";

export function KickParticipantButton({
  meetupId,
  userId,
  name,
  duelActive = false,
}: {
  meetupId: string;
  userId: string;
  name: string;
  duelActive?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const lines = [`„${name}" wirklich aus dem Treffen entfernen?`];
    if (duelActive) {
      lines.push("", "Das laufende Duell wird abgebrochen.");
    }
    if (!window.confirm(lines.join("\n"))) return;

    setError(null);
    startTransition(async () => {
      const res = await kickParticipantAction(meetupId, userId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost min-w-[2.75rem] min-h-[2.75rem] px-1.5 text-[var(--muted)] hover:text-[var(--primary)] disabled:opacity-50"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        aria-label={`${name} entfernen`}
        title={`${name} entfernen`}
      >
        {pending ? "…" : "×"}
      </button>
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
