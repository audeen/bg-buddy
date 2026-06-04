"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMeetupAction } from "@/app/actions";

export function MeetupDeleteButton({
  meetupId,
  title,
}: {
  meetupId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        `Treffen „${title}" wirklich löschen?\n\nAlle Stimmen (Pick & Tinder) gehen verloren.`,
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await deleteMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-ghost text-[var(--primary)]"
        disabled={pending}
        onClick={handleDelete}
      >
        {pending ? "Wird gelöscht…" : "Treffen löschen"}
      </button>
      {error && <p className="text-sm text-[var(--primary)]">{error}</p>}
    </div>
  );
}
