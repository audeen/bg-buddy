"use client";

import { useTransition } from "react";
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

  function handleClick() {
    const lines = [`„${name}" wirklich aus dem Treffen entfernen?`];
    if (duelActive) {
      lines.push("", "Das laufende Duell wird abgebrochen.");
    }
    if (!window.confirm(lines.join("\n"))) return;

    startTransition(async () => {
      const res = await kickParticipantAction(meetupId, userId);
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
      className="btn btn-ghost min-w-[28px] min-h-[28px] px-1.5 text-[var(--muted)] hover:text-[var(--primary)] disabled:opacity-50"
      onClick={handleClick}
      disabled={pending}
      aria-label={`${name} entfernen`}
      title={`${name} entfernen`}
    >
      {pending ? "…" : "×"}
    </button>
  );
}
