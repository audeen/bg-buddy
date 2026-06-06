import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
import { HeaderMenu } from "@/components/HeaderMenu";
import { HeaderNavLink } from "@/components/HeaderNavLink";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20 safe-top header-shadow">
      <div className="container-app flex items-center justify-between gap-3 py-3 min-h-[var(--header-height)]">
        <Link
          href="/"
          className="flex items-center gap-2 font-extrabold text-lg shrink-0 tracking-tight"
        >
          <span className="text-xl leading-none" aria-hidden>
            🎲
          </span>
          <span>BG Buddy</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <HeaderNavLink href="/games">Spiele</HeaderNavLink>
          <HeaderNavLink href="/">Treffen</HeaderNavLink>
          <HeaderNavLink href="/admin/collection">Sammlung</HeaderNavLink>
          <HeaderNavLink href="/admin/import">Import</HeaderNavLink>
        </nav>

        <div className="flex items-center gap-1 shrink-0">
          {user ? (
            <>
              <HeaderMenu userName={user.name} />
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">Angemeldet als</span>
                <span className="font-semibold">{user.name}</span>
                <form action={logoutAction}>
                  <button type="submit" className="btn btn-ghost">
                    Abmelden
                  </button>
                </form>
              </div>
            </>
          ) : (
            <Link href="/#login" className="btn btn-primary">
              Anmelden
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
