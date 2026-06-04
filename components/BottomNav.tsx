"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Treffen", icon: "📅", match: (p: string) => p === "/" || p.startsWith("/meetups") },
  { href: "/games", label: "Spiele", icon: "🎲", match: (p: string) => p.startsWith("/games") },
  {
    href: "/admin/collection",
    label: "Sammlung",
    icon: "📚",
    match: (p: string) => p.startsWith("/admin"),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] safe-bottom"
      aria-label="Hauptnavigation"
    >
      <ul className="flex items-stretch justify-around h-[var(--bottom-nav-height)]">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 h-full text-xs font-semibold transition-colors ${
                  active
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
