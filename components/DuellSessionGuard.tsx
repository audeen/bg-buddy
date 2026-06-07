"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_MS = 5000;

export function DuellSessionGuard({
  meetupId,
  initialDuelVoteCount,
  children,
}: {
  meetupId: string;
  initialDuelVoteCount: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (initialDuelVoteCount === 0) return;

    async function check() {
      if (redirected.current) return;
      try {
        const res = await fetch(`/api/meetups/${meetupId}/pick-phase`);
        if (!res.ok) return;
        const data = (await res.json()) as { duelVoteCount?: number };
        if (data.duelVoteCount === 0) {
          redirected.current = true;
          router.replace(`/meetups/${meetupId}`);
        }
      } catch {
        // ignore transient network errors
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void check();
    }

    void check();
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [meetupId, initialDuelVoteCount, router]);

  return <>{children}</>;
}
