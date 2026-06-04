# 🎲 BG Buddy

Verwalte deine Brettspielsammlung und stimmt gemeinsam ab, was beim nächsten
Treffen gespielt wird – per Direkt-Pick oder „Brettspiel-Tinder".

Die Spieledaten kommen aus deinem **BoardGameGeek (BGG) Collection-Export** und
werden optional mit Cover, Beschreibung, Genre und Mechaniken angereichert.

## Features

- **CSV-Import** der BGG-Collection (Spieleranzahl, Spielzeit, Komplexität,
  Rating, „beste Spieleranzahl" u. a. kommen direkt aus dem Export)
- **Anreicherung** per Offline-Cache (`data/bgg-enrichment.json`, EN + DE) oder optional BGG-XML-API
- **Spielebrowser** mit Suche und Filter (Spieleranzahl, Genre)
- **Niederschwellige Anmeldung** – nur ein Name, kein Passwort
- **Treffen** anlegen mit jederzeit änderbarer erwarteter Spieleranzahl
- **Direkt-Pick** – bis zu 3 Spiele pro Spieler und Spieleranzahl, „beste Wahl"
  hervorgehoben
- **Tinder-Modus (Lite)** – 8 kurze Duelle nur für die erwartete Spieleranzahl (★),
  max. 1 Sieg pro Spiel; danach Direkt-Picks setzen
- **Ergebnisse pro Treffen** – getrennt: Tinder-Siege, Direkt-Picks (pro Spieler
  aufgelistet) und optionales Gesamt-Ranking

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
#   DATABASE_URL und SESSION_SECRET in .env setzen
#   (SESSION_SECRET: mind. 32 Zeichen, z. B. `openssl rand -base64 32`)

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

## Daten befüllen

1. Auf BGG unter **Profile → Collection → Export Collection** die CSV
   herunterladen (eine Beispieldatei liegt unter `sample-data/collection.csv`).
2. In der App anmelden, **Import** öffnen, CSV hochladen — Pick/Tinder/Ranking
   funktionieren sofort (Spieleranzahl, Rating, … kommen aus der CSV).

### Anreicherung ohne API-Token (empfohlen)

Cover, Beschreibung, Genre und Mechaniken einmalig im Browser holen — **kein
`BGG_TOKEN` nötig**:

1. Anleitung: [`docs/browser-prefetch-bgg.md`](docs/browser-prefetch-bgg.md) (Konsole auf boardgamegeek.com)
   oder einmalig: `npm run prefetch-geekdo collection.csv`
2. Ergebnis als `data/bgg-enrichment.json` ins Projekt legen (oder committen für Vercel).
3. Deutsche Texte ergänzen (einmalig nach Prefetch):
   ```bash
   npm run translate-enrichment
   ```
   Nutzt `lib/bgg-taxonomy-de.ts` für Genre/Mechaniken und `data/bgg-descriptions-de.json` für Beschreibungen. Die App zeigt **Deutsch** (Englisch bleibt in der JSON).
4. CSV erneut importieren **oder**:
   ```bash
   npm run apply-cache
   ```

### Optional: BGG-XML-API (wenn Application freigegeben)

Die API verlangt seit 2025 einen Token (`401` ohne Token). Wenn du einen hast:

1. `BGG_TOKEN` in `.env` (lokal) bzw. Vercel Environment Variables
2. Cache-Datei füllen: `npm run prefetch-bgg collection.csv`
3. Oder direkt in die DB: `npm run enrich`, oder Button „Live von BGG laden" im Import

```bash
npm run prefetch-bgg   # schreibt data/bgg-enrichment.json
npm run enrich         # schreibt direkt in DATABASE_URL
```

## Deployment (Vercel + Neon, kostenlos)

1. **Neon** (https://neon.tech) Projekt anlegen, Connection-String kopieren.
2. Repo zu **Vercel** importieren.
3. Environment-Variablen in Vercel setzen:
   - `DATABASE_URL` = Neon-Connection-String
   - `SESSION_SECRET` = zufälliger String (≥ 32 Zeichen)
   - `BGG_TOKEN` = optional (nur für Live-API; nicht nötig mit `data/bgg-enrichment.json`)
4. Migration gegen Neon ausführen (lokal mit gesetzter `DATABASE_URL`):
   ```bash
   npx prisma migrate deploy
   ```
5. Deployen. `data/bgg-enrichment.json` mit committen oder nach Deploy `npm run apply-cache` gegen Neon.

Der `build`-Schritt ruft automatisch `prisma generate` auf.

## Projektstruktur

```
app/                 Routen (App Router) + Server Actions (actions.ts)
  api/enrich/        Batch-Enrichment-Endpoint
  games/             Sammlung + Detailseite
  meetups/           Treffen, Pick- und Tinder-Modus
components/          UI-Komponenten (Client & Server)
lib/                 prisma, session, auth, bgg (CSV/XML), enrichment-cache, bgg-taxonomy-de
prisma/schema.prisma Datenmodell
data/                bgg-enrichment.json (zweisprachig), bgg-descriptions-de.json
docs/                browser-prefetch-bgg.md (Konsole ohne Token)
scripts/             apply-cache, prefetch-geekdo, translate-enrichment, enrich
sample-data/         Beispiel-Collection-CSV
```
