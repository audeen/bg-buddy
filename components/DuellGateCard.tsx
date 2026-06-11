import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Zentrierte Status-Karte vor dem Duell (zu wenige Stimmen, warten auf
 * Mitspieler, …) mit CTA. Server-kompatibel.
 */
export function DuellGateCard({
  title,
  ctaHref,
  ctaLabel = "Stimmen setzen",
  children,
}: {
  title: string;
  ctaHref: string;
  ctaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="card card-pad flex flex-col items-center gap-3 text-center"
    >
      <p className="section-title">{title}</p>
      {children}
      <Link href={ctaHref} className="btn btn-primary btn-lg">
        {ctaLabel}
      </Link>
    </div>
  );
}
