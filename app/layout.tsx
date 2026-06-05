import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main
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
        <BottomNav />
      </body>
    </html>
  );
}
