"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/" || pathname.startsWith("/meetups")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`btn btn-ghost ${active ? "bg-[var(--surface-2)]" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
