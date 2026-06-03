import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "BG Buddy",
  description: "Brettspielsammlung verwalten und gemeinsam das nächste Spiel wählen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1 w-full py-6">{children}</main>
        <footer className="container-app py-6 text-sm text-[var(--muted)]">
          BG Buddy · Daten von BoardGameGeek
        </footer>
      </body>
    </html>
  );
}
