# BGG-Anreicherung ohne API-Token

Cover, Beschreibung, Genre und Mechaniken einmalig holen → `data/bgg-enrichment.json`.
BG Buddy merged die Datei beim CSV-Import oder per `npm run apply-cache`.

**Kein `BGG_TOKEN` nötig.**

## Empfohlen: ein Tab, eine API (Geekdo `geekitems`)

Das alte HTML-Parsing (Schritt 2b unten) trifft das neue BGG-Layout oft nicht —
dann bleiben `description`, `categories`, `mechanics` leer. Stattdessen die
**gleiche JSON-API**, die die BGG-Seite nutzt (funktioniert von `boardgamegeek.com`
ohne CORS-Probleme).

### Vorbereitung

1. Tab: **https://boardgamegeek.com**
2. F12 → Konsole
3. Firefox: `allow pasting` + Enter
4. `collection.csv` komplett kopiert

### Schritt 1 — IDs

Funktioniert mit **BGG-CSV** (Komma + Anführungszeichen) und **Tab-getrennt** (Excel/LibreOffice).

Seite neu laden, wenn du es erneut ausführst (sonst `redeclaration of const CSV`).

```javascript
(function () {
  const CSV = `
…CSV hier einfügen (komplett, inkl. Kopfzeile)…
`;

  const lines = CSV.trim().split(/\r?\n/).filter(Boolean);
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(delim).map((h) =>
    h.trim().replace(/^"|"$/g, "").toLowerCase(),
  );
  const idIdx = header.indexOf("objectid");
  const fallbackIdx = idIdx >= 0 ? idIdx : 1;

  const IDS = [
    ...new Set(
      lines.slice(1).map((line) => {
        if (delim === "\t") {
          const id = Number(line.split("\t")[fallbackIdx]?.trim());
          return Number.isFinite(id) ? id : null;
        }
        const quoted = line.match(/^"[^"]*","(\d+)"/);
        if (quoted) return Number(quoted[1]);
        const cols = line.split(",");
        const id = Number(cols[fallbackIdx]?.trim().replace(/^"|"$/g, ""));
        return Number.isFinite(id) ? id : null;
      }).filter(Boolean),
    ),
  ];

  window.IDS = IDS;
  console.log(IDS.length, "Spiele", IDS);
})();
```

### Schritt 2 — Alles (Cover + Text + Tags + Erweiterungs-Verknüpfung)

Ein Block, Enter (~30–60 s). Nutzt `window.IDS` aus Schritt 1:

```javascript
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function stripHtml(html) {
    if (!html) return null;
    return String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null;
  }

  function linkNames(links, key) {
    const arr = links?.[key];
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map((x) => x.name?.trim()).filter(Boolean))];
  }

  function expandIds(links) {
    const arr = links?.expandsboardgame;
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map((x) => Number(x.objectid)).filter(Number.isFinite))];
  }

  const cache = {};

  for (const id of window.IDS) {
    const url =
      `https://api.geekdo.com/api/geekitems?ajax=1&action=thing` +
      `&objectid=${id}&objecttype=thing&nosession=1`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(id, res.status);
      await sleep(450);
      continue;
    }
    const { item } = await res.json();
    if (!item) continue;

    const links = item.links;
    cache[id] = {
      id,
      description: stripHtml(item.description) || stripHtml(item.short_description),
      image: item.topimageurl || item.imageurl || null,
      thumbnail: item.imageurl || item.topimageurl || null,
      categories: linkNames(links, "boardgamecategory"),
      mechanics: linkNames(links, "boardgamemechanic"),
      expandsGameIds: expandIds(links),
    };
    console.log(
      id,
      cache[id].categories.length,
      cache[id].mechanics.length,
      cache[id].expandsGameIds.length ? `→ Basis ${cache[id].expandsGameIds}` : "",
    );
    await sleep(450);
  }

  window.__bggCache = cache;
  console.log("fertig", Object.keys(cache).length);
})();
```

Erwartung für **325** (Catan: Seafarers): Kategorien > 0, Beschreibung mit „Catan“ / „ocean“.

### Schritt 3 — JSON downloaden

```javascript
const out = Object.fromEntries(
  Object.values(window.__bggCache).map((d) => [String(d.id), d]),
);
const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "bgg-enrichment.json";
a.click();
```

→ `data/bgg-enrichment.json` im Projekt (englische Felder `description`, `categories`, `mechanics`).

### Schritt 4 — Deutsch ergänzen (Anzeige in BG Buddy)

Die App nutzt deutsche Beschreibungen, Genre und Mechaniken. Nach dem Export:

```bash
npm run translate-enrichment
```

- `categoriesDe` / `mechanicsDe` aus `lib/bgg-taxonomy-de.ts`
- `descriptionDe` aus `data/bgg-descriptions-de.json` (bei neuen Spielen dort ergänzen und Skript erneut ausführen)

Englisch bleibt in `bgg-enrichment.json` erhalten. Danach Import / `npm run apply-cache` / git push.

---

## Alternative: Terminal (kein Browser)

```bash
npm run prefetch-geekdo collection.csv
```

Schreibt dieselbe Datei (Cover + Beschreibung + Genre + Mechanik, Englisch).
Anschließend: `npm run translate-enrichment` für die deutschen Felder.

`npm run prefetch-covers` nur Cover (älterer Weg).

---

## Veraltet: HTML-Scraping (Schritt 2b)

Nur falls die geekitems-API ausfällt — Selektoren passen oft nicht mehr:

<details>
<summary>Altes DOM-Skript (ausklappen)</summary>

Auf boardgamegeek.com, nach Schritt 1 und optional Cover-2a:

```javascript
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cache = window.__bggCache ?? {};
  function parsePage(html, id) { /* … siehe Git-Historie … */ }
  for (const id of IDS) {
    const res = await fetch(`/boardgame/${id}`, { credentials: "include" });
    if (res.ok) cache[id] = parsePage(await res.text(), id);
    await sleep(800);
  }
  window.__bggCache = cache;
})();
```

</details>

---

## Später mit BGG-API-Token

`npm run prefetch-bgg` oder `npm run enrich` — optional.
