import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SwipeBackHandler } from "@/components/SwipeBackHandler";
import { ChunkLoadRecovery } from "@/components/ChunkLoadRecovery";
import { prisma } from "@/lib/prisma";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
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
  const fallbackMeetup = await prisma.meetup.findFirst({
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  return (
    <html lang="de" className={`h-full antialiased ${inter.variable}`}>
      <body className={`min-h-full flex flex-col ${inter.className}`}>
        <Header />
        <main
          id="app-main"
          className="flex-1 w-full pb-nav"
          style={{
            paddingBlock: "var(--space-section)",
          }}
        >
          {children}
        </main>
        <footer className="container-app py-4 md:py-6 pb-nav md:pb-6 text-sm text-[var(--muted)]">
          BG Buddy · Daten von BoardGameGeek
        </footer>
        <BottomNav fallbackMeetupId={fallbackMeetup?.id ?? null} />
        <SwipeBackHandler />
        <ChunkLoadRecovery />
        <Analytics />
      </body>
    </html>
  );
}
