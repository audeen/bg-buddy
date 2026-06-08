import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { HeaderChrome } from "@/components/HeaderChrome";
import { HeaderMenu } from "@/components/HeaderMenu";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <HeaderChrome>
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

        <div className="flex items-center gap-1 shrink-0">
          {user ? (
            <HeaderMenu userName={user.name} />
          ) : (
            <Link href="/#login" className="btn btn-primary">
              Anmelden
            </Link>
          )}
        </div>
      </div>
    </HeaderChrome>
  );
}
