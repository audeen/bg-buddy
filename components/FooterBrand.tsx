"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminMenuSheet } from "@/components/AdminMenuSheet";
import { useSecretMenuReveal } from "@/lib/use-secret-menu-reveal";

/**
 * Marke im Footer. Für angemeldete Nutzer öffnet ein Dreifach-Tipp auf den
 * Schriftzug das versteckte Admin-Menü (ehemals im Header).
 */
export function FooterBrand({ userName }: { userName: string | null }) {
  const { revealed, registerClick } = useSecretMenuReveal();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={userName ? registerClick : undefined}
        className="flex items-center gap-2 font-extrabold tracking-tight text-[var(--foreground)] cursor-default select-none [font-family:var(--font-display),var(--font-sans),sans-serif]"
        aria-label="BG Buddy"
      >
        <span className="text-lg leading-none" aria-hidden>
          🎲
        </span>
        <span>BG Buddy</span>
      </button>

      {userName && revealed && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setSheetOpen(true)}
        >
          Menü
        </button>
      )}

      {!userName && (
        <Link href="/#login" className="btn btn-ghost btn-sm">
          Anmelden
        </Link>
      )}

      {userName && (
        <AdminMenuSheet
          userName={userName}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
