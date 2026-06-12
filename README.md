# 🎲 BG Buddy

Verwalte deine Brettspielsammlung und stimmt gemeinsam ab, was beim nächsten
Treffen gespielt wird – per gewichteten Stimmen und optionalem Duell-Modus unter den Nominierungen.

Die Spieledaten kommen aus deinem **BoardGameGeek (BGG) Collection-Export** und
werden über die offizielle BGG-XML-API mit Cover, Beschreibung, Genre und
Mechaniken angereichert (benötigt einen `BGG_TOKEN`, siehe unten).

## Features

- **CSV-Import** der BGG-Collection (Spieleranzahl, Spielzeit, Komplexität,
  Rating, „beste Spieleranzahl" u. a. kommen direkt aus dem Export)
- **Anreicherung** über die offizielle BGG-XML-API (Cover, Beschreibung,
  Kategorien, Mechaniken) — serverseitig gedrosselt, ein App-Token für alle Nutzer
- **Spielebrowser** mit Suche und Filter (Spieleranzahl, Genre)
- **Niederschwellige Anmeldung** – nur ein Name, kein Passwort
- **Treffen** anlegen; der **Host** legt die erwartete Spieleranzahl (★) fest
- **Stimmen** – 3 Stimmen pro Spieler und Spieleranzahl, frei verteilbar (auch
  alle auf ein Spiel). Beim Öffnen startet die ★-Auswahl; andere Spielerzahlen
  sind als Vorbereitung wählbar (z. B. falls jemand dazukommt)
- **Duell-Modus** – Paarvergleiche nur für ★: bei ≤6 nominierten Spielen
  vollständig (jedes gegen jedes), bei mehr Spielen Gruppen-Matrix mit fairer
  Verteilung. Nach abgeschlossenen Duellen kann der Host ★ erhöhen (z. B. 4→5)
  und eine neue Duell-Runde starten — Voraus-Stimmen bleiben erhalten
- **Ergebnisse pro Treffen** – Stimmen (pro Spieler), Copeland-Siege, Gesamt
  (Stimmen + Siege); abgeschlossene Runden pro Spieleranzahl archiviert

## Tech-Stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- [Prisma 6](https://www.prisma.io/) + PostgreSQL
- [iron-session](https://github.com/vvo/iron-session) für die Session

## Lokale Entwicklung

Voraussetzung: Node 22+ und ein erreichbares PostgreSQL.

```bash
# 1. Abhängigkeiten
npm install

# 2. Environment einrichten
cp .env.example .env
#   DATABASE_URL, SESSION_SECRET und BGG_TOKEN in .env setzen
#   (SESSION_SECRET: mind. 32 Zeichen, z. B. `openssl rand -base64 32`)
#   (BGG_TOKEN: Application unter https://boardgamegeek.com/applications
#    registrieren und dort einen Token erzeugen)

# Schnell ein lokales Postgres via Docker/Podman:
docker run -d --name bgbuddy-pg \
  -e POSTGRES_USER=bgbuddy -e POSTGRES_PASSWORD=bgbuddy -e POSTGRES_DB=bgbuddy \
  -p 5433:5432 postgres:16-alpine
#   -> DATABASE_URL="postgresql://bgbuddy:bgbuddy@localhost:5433/bgbuddy?schema=public"

# 3. Datenbank migrieren
npx prisma migrate dev

# 4. Dev-Server
npm run dev
```

App läuft auf http://localhost:3000.

## Vercel / Produktion

Der Build auf Vercel führt `prisma migrate deploy` aus (`npm run vercel-build` via
[`vercel.json`](vercel.json)). Die Migration `drop_tinder_vote_mode` migriert
verbliebene `TINDER`-Votes zu `DUEL` und entfernt den alten Enum-Wert.

Nach Deploy einmalig prüfen (mit Produktions-`DATABASE_URL`):

```bash
npm run db:migrate
```

## BGG-API-Token (Pflicht)

Die BGG-XML-API verlangt einen registrierten App-Token:

1. Application unter https://boardgamegeek.com/applications registrieren
   (Freigabe kann etwas dauern).
2. Auf der Application-Seite einen Token erzeugen.
3. Als `BGG_TOKEN` in `.env` (lokal) bzw. in den Vercel Environment Variables setzen.

Der Token identifiziert die **Anwendung**, nicht einzelne Nutzer — alle
BGG-Anfragen laufen serverseitig über diesen einen Token und werden global
gedrosselt (Mindestabstand zwischen Requests), damit parallele Nutzeraktionen
das gemeinsame Rate-Limit nicht sprengen. Der Token darf nie im Client landen.

Als öffentliche Anwendung zeigt BG Buddy das verpflichtende
[„Powered by BGG"-Logo](https://boardgamegeek.com/wiki/page/Powered_by_BGG_Logos)
im Footer (verlinkt auf BoardGameGeek).

## Daten befüllen

1. Auf BGG unter **Profile → Collection → Export Collection** die CSV
   herunterladen (eine Beispieldatei liegt unter `sample-data/collection.csv`).
2. In der App anmelden, **Import** öffnen, CSV hochladen — Pick/Duell/Ranking
   funktionieren sofort (Spieleranzahl, Rating, … kommen aus der CSV).
3. Cover, Beschreibung, Genre und Mechaniken laden: Button
   **„Von BGG laden"** im Import, oder per CLI:
   ```bash
   npm run enrich   # schreibt direkt in DATABASE_URL
   ```

## Deployment (Vercel + Neon, kostenlos)

1. **Neon** (https://neon.tech) Projekt anlegen, Connection-String kopieren.
2. Repo zu **Vercel** importieren.
3. Environment-Variablen in Vercel setzen:
   - `DATABASE_URL` = Neon-Connection-String
   - `SESSION_SECRET` = zufälliger String (≥ 32 Zeichen)
   - `BGG_TOKEN` = App-Token (siehe „BGG-API-Token" oben)
   - `ADMIN_USERS` = optional, kommagetrennte Nutzernamen mit Admin-Rechten
     (dürfen z. B. jedes Treffen löschen, nicht nur eigene)
4. Migration gegen Neon ausführen (lokal mit gesetzter `DATABASE_URL`):
   ```bash
   npx prisma migrate deploy
   ```
5. Deployen.

Der `build`-Schritt ruft automatisch `prisma generate` auf.

## Projektstruktur

```
app/                 Routen (App Router) + Server Actions (actions.ts)
  api/enrich/        Batch-Enrichment-Endpoint
  games/             Sammlung + Detailseite
  meetups/           Treffen, Pick- und Duell-Modus
components/          UI-Komponenten (Client & Server)
lib/                 prisma, session, auth, bgg (CSV/XML-API, Drosselung), bgg-taxonomy-de
prisma/schema.prisma Datenmodell
scripts/             enrich, Unit-Test-Skripte
sample-data/         Beispiel-Collection-CSV
```
