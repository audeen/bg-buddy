import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { FooterBrand } from "@/components/FooterBrand";
import { SwipeBackHandler } from "@/components/SwipeBackHandler";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "BG Buddy",
  description: "Brettspielsammlung verwalten und gemeinsam das nächste Spiel wählen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [fallbackMeetup, user] = await Promise.all([
    prisma.meetup.findFirst({
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
    getCurrentUser(),
  ]);

  return (
    <html
      lang="de"
      className={`h-full antialiased ${inter.variable} ${bricolage.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <main
          id="app-main"
          className="flex-1 w-full pb-nav"
          style={{
            paddingBlock:
              "calc(env(safe-area-inset-top, 0px) + var(--space-section)) var(--space-section)",
          }}
        >
          {children}
        </main>
        <footer className="container-app pt-4 md:pt-6 pb-nav">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
            <FooterBrand userName={user?.name ?? null} />
            <a
              href="https://boardgamegeek.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="BoardGameGeek"
              className="shrink-0"
            >
              <Image
                src="/powered-by-bgg.svg"
                alt="Powered by BGG"
                width={180}
                height={40}
              />
            </a>
          </div>
        </footer>
        <BottomNav fallbackMeetupId={fallbackMeetup?.id ?? null} />
        <SwipeBackHandler />
        <Analytics />
      </body>
    </html>
  );
}
