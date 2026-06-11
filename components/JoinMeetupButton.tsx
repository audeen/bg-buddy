"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinMeetupAction, leaveMeetupAction } from "@/app/actions";

export function JoinMeetupButton({
  meetupId,
  isLoggedIn,
  isRegistered,
  canLeave,
}: {
  meetupId: string;
  isLoggedIn: boolean;
  isRegistered: boolean;
  canLeave: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) return null;

  if (isRegistered && !canLeave) {
    return (
      <p className="text-xs text-[var(--muted)]">Du nimmst teil</p>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = isRegistered
        ? await leaveMeetupAction(meetupId)
        : await joinMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={`btn ${isRegistered ? "btn-ghost" : "btn-primary"} btn-sm`}
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
      >
        {pending
          ? isRegistered
            ? "Melde ab…"
            : "Melde an…"
          : isRegistered
            ? "Abmelden"
            : "Teilnehmen"}
      </button>
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
