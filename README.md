# 🎲 BG Buddy

Verwalte deine Brettspielsammlung und stimmt gemeinsam ab, was beim nächsten
Treffen gespielt wird – per Direkt-Pick oder „Brettspiel-Tinder".

Die Spieledaten kommen aus deinem **BoardGameGeek (BGG) Collection-Export** und
werden optional mit Cover, Beschreibung, Genre und Mechaniken angereichert.

## Features

- **CSV-Import** der BGG-Collection (Spieleranzahl, Spielzeit, Komplexität,
  Rating, „beste Spieleranzahl" u. a. kommen direkt aus dem Export)
- **Anreicherung** über die BGG-XML-API: Cover, Beschreibung, Genre, Mechaniken
- **Spielebrowser** mit Suche und Filter (Spieleranzahl, Genre)
- **Niederschwellige Anmeldung** – nur ein Name, kein Passwort
- **Treffen** anlegen mit jederzeit änderbarer erwarteter Spieleranzahl
- **Direkt-Pick** – Spiele nach Spieleranzahl, „beste Wahl" hervorgehoben
- **Tinder-Modus** – Duell zweier Spiele, startet bei der erwarteten Anzahl und
  geht dann ab 3 Spielern aufwärts
- **Ranking pro Spieleranzahl** – Pick- und Tinder-Stimmen fließen zusammen

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
2. In der App anmelden, **Import** öffnen, CSV hochladen.
3. **„Cover & Details laden"** klicken, um Beschreibung/Genre/Cover von BGG
   nachzuladen.

### Wichtig: BGG verlangt einen API-Token

Die BGG-XML-API benötigt **seit 2025 einen API-Token**. Ohne Token antwortet sie
mit `401 Unauthorized` – unabhängig von der IP. Ohne Token funktioniert die App
trotzdem voll, nur ohne Cover/Beschreibung/Genre (Platzhalter statt Cover).

So bekommst du einen Token:

1. Auf https://boardgamegeek.com/applications einloggen und eine **Application**
   registrieren (die Freigabe kann laut BGG „a week or more" dauern).
2. Dort einen **Token** erzeugen.
3. Den Token als Umgebungsvariable `BGG_TOKEN` setzen:
   - **Lokal:** in `.env` (`BGG_TOKEN="..."`)
   - **Auf Vercel:** als Environment Variable `BGG_TOKEN`

Danach klappt das Anreichern entweder über den Button **„Cover & Details laden"**
in der App oder lokal per CLI:

```bash
# .env mit DATABASE_URL (Ziel-DB) und BGG_TOKEN befüllen, dann:
npm run enrich
```

Da die Sammlung statisch ist, reicht das einmalig (bzw. nach jedem Import).

## Deployment (Vercel + Neon, kostenlos)

1. **Neon** (https://neon.tech) Projekt anlegen, Connection-String kopieren.
2. Repo zu **Vercel** importieren.
3. Environment-Variablen in Vercel setzen:
   - `DATABASE_URL` = Neon-Connection-String
   - `SESSION_SECRET` = zufälliger String (≥ 32 Zeichen)
   - `BGG_TOKEN` = BGG-API-Token (optional; nur für Cover & Details nötig)
4. Migration gegen Neon ausführen (lokal mit gesetzter `DATABASE_URL`):
   ```bash
   npx prisma migrate deploy
   ```
5. Deployen. Danach `npm run enrich` lokal gegen die Neon-`DATABASE_URL` laufen
   lassen, um Cover & Details zu befüllen.

Der `build`-Schritt ruft automatisch `prisma generate` auf.

## Projektstruktur

```
app/                 Routen (App Router) + Server Actions (actions.ts)
  api/enrich/        Batch-Enrichment-Endpoint
  games/             Sammlung + Detailseite
  meetups/           Treffen, Pick- und Tinder-Modus
components/          UI-Komponenten (Client & Server)
lib/                 prisma, session, auth, bgg (CSV/XML), format
prisma/schema.prisma Datenmodell
scripts/enrich.ts    Lokales Enrichment-CLI (npm run enrich)
sample-data/         Beispiel-Collection-CSV
```
