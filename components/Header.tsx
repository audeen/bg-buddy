import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
      <div className="container-app flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg">
          <span aria-hidden>🎲</span>
          <span>BG Buddy</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/games" className="btn btn-ghost">
            Spiele
          </Link>
          <Link href="/" className="btn btn-ghost">
            Treffen
          </Link>
          <Link href="/admin/collection" className="btn btn-ghost">
            Sammlung
          </Link>
          <Link href="/admin/import" className="btn btn-ghost">
            Import
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <span className="hidden sm:inline text-[var(--muted)]">
                Angemeldet als
              </span>
              <span className="font-semibold">{user.name}</span>
              <form action={logoutAction}>
                <button type="submit" className="btn btn-ghost">
                  Abmelden
                </button>
              </form>
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
