"use client";

import { useEffect, useState } from "react";
import { Callout } from "@/components/Callout";

const KEY = "bg-buddy:duell-reset-notice";

/** Vom DuellSessionGuard gesetzt, bevor er auf die Treffen-Seite umleitet. */
export function markDuellResetNotice() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage nicht verfügbar — Hinweis entfällt.
  }
}

/** Erklärt nach der Umleitung, warum die Duell-Seite verlassen wurde. */
export function DuellResetNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") {
        sessionStorage.removeItem(KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- bewusst: sessionStorage erst nach Hydration lesen, sonst Hydration-Mismatch
        setShow(true);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!show) return null;

  return (
    <Callout
      variant="warning"
      className="flex items-start justify-between gap-3"
    >
      <p className="text-sm">
        Das Duell wurde zurückgesetzt — deshalb bist du wieder auf der
        Treffen-Übersicht.
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-sm shrink-0"
        onClick={() => setShow(false)}
      >
        OK
      </button>
    </Callout>
  );
}
