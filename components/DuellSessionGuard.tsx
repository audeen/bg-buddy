"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markDuellResetNotice } from "@/components/DuellResetNotice";

const POLL_MS = 5000;

export function DuellSessionGuard({
  meetupId,
  roundId,
  initialDuelVoteCount,
  children,
}: {
  meetupId: string;
  roundId?: string;
  initialDuelVoteCount: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const redirected = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (initialDuelVoteCount === 0) return;

    const query = roundId ? `?runde=${roundId}` : "";
    const backHref = roundId
      ? `/meetups/${meetupId}?runde=${roundId}`
      : `/meetups/${meetupId}`;

    async function check() {
      if (redirected.current || inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch(`/api/meetups/${meetupId}/pick-phase${query}`);
        if (!res.ok) return;
        const data = (await res.json()) as { duelVoteCount?: number };
        if (data.duelVoteCount === 0) {
          redirected.current = true;
          markDuellResetNotice();
          router.replace(backHref);
        }
      } catch {
        // ignore transient network errors
      } finally {
        inFlight.current = false;
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
  }, [meetupId, roundId, initialDuelVoteCount, router]);

  return <>{children}</>;
}
