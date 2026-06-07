"use client";

import { useTransition } from "react";
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

  if (!isLoggedIn) return null;

  if (isRegistered && !canLeave) {
    return (
      <p className="text-xs text-[var(--muted)]">Du nimmst teil</p>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const res = isRegistered
        ? await leaveMeetupAction(meetupId)
        : await joinMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={`btn ${isRegistered ? "btn-ghost" : "btn-primary"} btn-sm`}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "…" : isRegistered ? "Abmelden" : "Teilnehmen"}
    </button>
  );
}
