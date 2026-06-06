"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateExpectedCountAction } from "@/app/actions";

export function ExpectedCountControl({
  meetupId,
  value,
}: {
  meetupId: string;
  value: number;
}) {
  const router = useRouter();
  const [count, setCount] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: number) {
    const clamped = Math.max(1, Math.min(20, next));
    setCount(clamped);
    setError(null);
    startTransition(async () => {
      const res = await updateExpectedCountAction(meetupId, clamped);
      if (res && "error" in res && res.error) {
        setError(res.error);
        setCount(value);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex flex-wrap items-center gap-2 w-full">
        <span className="text-sm font-semibold">Erwartete Spieler festlegen:</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost min-w-[44px] min-h-[44px] px-3"
            onClick={() => save(count - 1)}
            disabled={pending || count <= 1}
            aria-label="weniger"
          >
            −
          </button>
          <span className="min-w-10 text-center font-bold text-lg tabular-nums">
            {count}
          </span>
          <button
            type="button"
            className="btn btn-ghost min-w-[44px] min-h-[44px] px-3"
            onClick={() => save(count + 1)}
            disabled={pending || count >= 20}
            aria-label="mehr"
          >
            +
          </button>
        </div>
        {pending && (
          <span className="text-xs text-[var(--muted)]">gespeichert…</span>
        )}
      </div>
      {error && (
        <p className="text-sm text-[var(--accent)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
