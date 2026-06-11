# UI/UX-Audit — BG Buddy

Stand: 2026-06-12 · Methode: Vollständiges Code-Review aller relevanten Flächen gegen das
Designsystem in `app/globals.css`. Kritische Befunde (P0/P1) wurden per Grep/Read direkt im
Code verifiziert. Befunde ohne direkte Verifikation sind als *Annahme* markiert.

**Severity:** P0 = broken · P1 = hoch · P2 = mittel · P3 = polish
**Aufwand:** S = klein (≤30 min) · M = mittel · L = groß
**Kategorien:** 1 Designsystem-Drift · 2 Duplikate · 3 Layout/Spacing · 4 Mobile/Touch ·
5 Zustände · 6 Feedback/Mikrointeraktionen · 7 Accessibility · 8 Microcopy · 9 Dark Mode ·
10 Responsiveness

ID-Präfixe: **A** = Globale Chrome/Home/Login · **B** = Sammlung (`/games`) ·
**C** = Meetups (Form/Übersicht) · **D** = Voting-Modi (Duell/Pick/Erweiterung) ·
**E** = Admin · **SYS** = systemisch (mehrere Flächen)

---

## 0. Systemische Befunde (mehrere Flächen betroffen)

| ID | Fundstellen | Kat. | Sev. | Aufw. | Problem | Empfehlung |
|----|-------------|------|------|-------|---------|------------|
| SYS-01 | `HeaderMenu.tsx:147`, `MeetupActionsMenu.tsx:60` | 1 | P1 | S | `rounded-[var(--radius)]` referenziert das Token `--radius`, das in `globals.css` **nicht definiert** ist — Dropdown-Ecken haben Radius 0. | `--radius: 0.6rem` in `:root` definieren (Button-Konvention) und behalten; alternativ `rounded-[0.6rem]`. |
| SYS-02 | `MeetupSpielsteuerungClient.tsx:302,356,370,409` | 1/9 | P1 | S | `bg-[var(--surface-elevated)]` — Token existiert nicht; Hintergründe fallen transparent aus (Light + Dark). | `--surface-elevated: var(--surface-2)` in `:root` ergänzen oder direkt `var(--surface-2)` verwenden. |
| SYS-03 | `SyncConflictDialog.tsx:90` | 1/9 | P1 | S | Sticky-Tabellen-Header nutzt `bg-[var(--card)]` — Token existiert nicht; Zeilen scheinen beim Scrollen durch den Header. | `bg-[var(--surface)]`. |
| SYS-04 | `JoinMeetupButton.tsx:45`, `CoverPickerDialog.tsx:315`, `MeetupSpielsteuerungClient.tsx` (14×) | 1 | P1 | S | Klasse `btn-sm` wird 16× verwendet, ist aber in `globals.css` **nicht definiert** — Buttons fallen auf `.btn`-Default zurück, gewollte Kompaktgröße fehlt. | `.btn-sm` im Designsystem definieren (z. B. `min-height: 2.25rem; padding: 0.35rem 0.75rem; font-size: 0.82rem;`) — unter `pointer: coarse` aber 2.75rem halten. |
| SYS-05 | global (`globals.css:125-163`) | 7 | P1 | M | Im gesamten Projekt existiert **kein** `:focus-visible`-Style (nur `.input:focus`). Tastatur-Fokus ist auf `.btn`, `.card-game`, Chips, Nav-Items, Duell-Karten unsichtbar. | Global ergänzen: `.btn:focus-visible, .card-game:focus-visible, .chip-interactive:focus-visible { outline: 2px solid color-mix(in srgb, var(--primary) 55%, transparent); outline-offset: 2px; }`. |
| SYS-06 | `app/page.tsx:198,254`, `GameCard.tsx:199`, `GameDetailView.tsx:212`, `MeetupForm.tsx:15`, `GameEditClient.tsx:156,334,381,440`, `ImportClient.tsx:155,190`, u. v. m. | 1/2 | P2 | S | `style={{ padding: "var(--space-card)" }}` ist projektweit (>15×) per Inline-Style copy-pastet, weil `.card` kein Default-Padding hat. | Utility `.card-pad { padding: var(--space-card); }` in `globals.css`; Inline-Styles ersetzen. |
| SYS-07 | `LoginForm.tsx:42`, `HeaderMenu.tsx:218`, `MeetupForm.tsx:70` (Fehler = `--primary`) vs. `DuellClient.tsx:122`, `ExpansionDuellClient.tsx:100`, `PickClient.tsx:459`, `ExpectedCountControl.tsx:74`, `MeetupExpansionActions.tsx:120` (Fehler = `--accent` = **Grün**) | 6/7 | P1 | M | Es gibt keine semantische Fehlerfarbe. Teile der App zeigen Fehler in Brand-Rot (`--primary`), andere in **Grün** (`--accent`) — Grün signalisiert Erfolg, nicht Fehler. | Token `--danger` (oder `.text-error`-Utility) einführen; alle `role="alert"`-Texte darauf vereinheitlichen. `--accent` nur für Erfolg/Status. |
| SYS-08 | `GameDetailModal.tsx` (Sheet, Drag, Fokus-Trap) vs. `CoverPickerDialog.tsx` (kein Trap, kein Initial-Fokus) vs. `MeetupShareQr.tsx` (Escape, kein Trap) vs. `AddGameModal.tsx` (Drag, Escape) vs. `SyncConflictDialog.tsx` (weder Escape noch Trap) | 2/7 | P1 | L | **Fünf Modal-Implementierungen** mit unterschiedlichem Verhalten (Escape, Fokus-Trap, Initial-Fokus, Drag-Dismiss, Scroll-Lock). Nutzer und Screenreader erleben je Modal anderes Verhalten. | Gemeinsame `ModalShell`-Primitive (Overlay, Escape, Scroll-Lock, Fokus-Trap, optional Drag-Zone) mit Varianten `sheet`/`dialog`; bestehende `.modal-*`-Klassen weiterverwenden. |
| SYS-09 | `ScrollToTopButton.tsx:38`, `BottomNav.tsx:108`, `GamesFilterBar.tsx:21-27`, `FilterChipButton.tsx:14-20` | 6 | P2 | S | `scrollIntoView({ behavior: "smooth" })` ignoriert `prefers-reduced-motion`; zudem ist `scrollToElement` in zwei Dateien identisch dupliziert. | Helper `lib/scroll.ts` mit reduced-motion-Check (`matchMedia("(prefers-reduced-motion: reduce)")` → `behavior: "auto"`); überall importieren. |
| SYS-10 | `MeetupSpielsteuerungClient.tsx:230,258,349,480`, `AddGameModal.tsx:316,467`, `GameEditClient.tsx:345`, `CoverPickerDialog.tsx:57-61,144,309`, `GameOfTheDayCard.tsx:117`, `PickClient.tsx:367`, `app/games/page.tsx:109` | 1 | P2 | M | Verbreitete Radius-Drift: `rounded-lg` (0.5rem) / `rounded-xl` (0.75rem) statt System-Radii (0.9rem Cards, 0.6rem Buttons/Inputs). | Pro Stelle auf `rounded-[0.9rem]` bzw. `rounded-[0.6rem]` normalisieren; optional Tailwind-Theme-Tokens `--radius-card`/`--radius-control` definieren. |
| SYS-11 | `HeaderMenu.tsx:147`, `MeetupActionsMenu.tsx:60`, `GameCard.tsx:404` | 1 | P2 | S | Tailwind-Default-Schatten (`shadow-lg`, `hover:shadow-md`) statt Token-Schatten `var(--shadow-*)`. | Auf `var(--shadow-lg)`/`.card-game`-Hover (kommt bereits aus Component-Layer) umstellen. |
| SYS-12 | Pending-Labels: `LoginForm.tsx:37` („...“), `HeaderMenu.tsx:178` („Bitte warten…“), `JoinMeetupButton.tsx:45`/`KickParticipantButton.tsx:47` („…“), `ExpectedCountControl.tsx:69-70` („gespeichert…“ während des Speicherns!) | 5/6/8 | P2 | M | Pending-Feedback ist uneinheitlich und teils irreführend („gespeichert…“ obwohl noch gespeichert wird). | Konvention: Verb + „…“ („Speichere…“, „Melde an…“, „Lösche…“) + `aria-busy`; kleine Helper-Komponente oder zumindest Copy-Konvention. |
| SYS-13 | `HomeSpotlightCarousel.tsx:64-71,261-272` (28px-Pfeile, 8px-Dots), `GameDetailCover.tsx:26-32` (36px), `KickParticipantButton.tsx:41` (28px), `MeetupShareQr.tsx:152` (32px), `GameCard.tsx:276-287` (28px), `ExpansionFamilyNav.tsx` (Chip-Buttons ~24px) | 4 | P1 | M | Diverse Touch-Targets liegen deutlich unter 44px (2.75rem) — auf Mobile schwer treffbar. | Einheitlich `min-h-[2.75rem] min-w-[2.75rem]` (visuell klein darf bleiben: kleines Icon, große Hitbox via Padding/`::after`). |

---

## 1. Globale Chrome, Home, Login (A)

| ID | Datei:Zeile | Kat. | Sev. | Aufw. | Problem | Empfehlung |
|----|-------------|------|------|-------|---------|------------|
| A-01 | `LoginForm.tsx:17` / `Header.tsx:26` | 7/4 | P1 | S | `/#login`-Anker springt zum Formular, aber der sticky Header überdeckt Label + Eingabefeld (kein `scroll-mt`). | `scroll-mt-[var(--header-height)]` am `<form id="login">` (Pattern aus `PageHeader.tsx:17`). |
| A-02 | `app/page.tsx:215,234` | 7 | P1 | S | Eingeloggte Startseite hat kein `<h1>` (nur `section-title`-`<h2>`); Gäste haben `page-title`. Dokument-Outline inkonsistent. | `<h1 className="sr-only">Startseite</h1>` oder sichtbarer `PageHeader` im eingeloggten Zweig. |
| A-03 | `HomeSpotlightCarousel.tsx:64-71` | 4 | P1 | S | Carousel-Pfeile `h-7 w-7` (28px) — weit unter 44px-Touch-Target. | `min-h-[2.75rem] min-w-[2.75rem]`, Icon zentriert. |
| A-04 | `HomeSpotlightCarousel.tsx:261-272` | 4 | P1 | S | Paginierungs-Dots `h-2 w-2` (8px) — als Tap-Ziel unbrauchbar. | Hitbox vergrößern: Button mit `p-3`/`min-w-[2.75rem]`, sichtbarer Dot als inneres `<span>`. |
| A-05 | `HomeSpotlightCarousel.tsx:223-276` | 7 | P1 | M | Karussell ohne Tastatur-Bedienung (Pfeiltasten) und ohne `aria-live` beim Slide-Wechsel. | `onKeyDown` (ArrowLeft/Right) am Container, `aria-live="polite"` für Slide-Label. |
| A-06 | `HeaderMenu.tsx:144-213` | 7 | P1 | M | Dropdown ohne Escape-Handling, ohne Fokus-Management (nur Click-Outside). | `Escape` → schließen, Fokus aufs erste `menuitem` beim Öffnen, Fokus-Rückgabe beim Schließen. |
| A-07 | `BottomNav.tsx:141,143` | 8 | P1 | S | Sichtbares Label „Vote“ (Englisch) vs. `aria-label` „Stimmen vergeben“ (Deutsch) — inkonsistent, problematisch für Voice Control. | Label „Stimmen“ oder „Abstimmen“; aria-label angleichen. |
| A-08 | `GameOfTheDayCard.tsx:164` | 8 | P1 | S | „Keine verfügbaren Spiele in der Collection.“ — sonst heißt es überall „Sammlung“. | „… in der Sammlung.“ |
| A-09 | `GameOfTheDayCard.tsx:105-108` | 7 | P1 | S | Spotlight-Karte ist `<button class="card">` ohne Fokus-Stil (siehe SYS-05) und ohne `.card-game`-Hover-Feedback. | Von SYS-05 abgedeckt; optional `.card-game`-Klasse prüfen. |
| A-10 | `HomeSpotlightCarousel.tsx:200-204` | 6 | P2 | S | Auto-Advance (10s) läuft auch bei `prefers-reduced-motion: reduce` weiter. | Timer nur ohne reduced-motion starten. |
| A-11 | `app/layout.tsx:44-51` | 3 | P2 | S | `<main>` und `<footer>` tragen beide `.pb-nav` — doppelter Abstand über der BottomNav am Seitenende. | `.pb-nav` nur auf einem der beiden (footer). |
| A-12 | `app/page.tsx:36-52` | 2 | P2 | S | `NewMeetupIconButton` dupliziert ein Plus-SVG, obwohl `PlusIcon` in `icons.tsx` existiert. | `PlusIcon` importieren. |
| A-13 | `app/page.tsx:198-199` | 3 | P2 | S | Import-Banner-Überschrift `font-bold mb-1` statt `.section-title` — Typo-Hierarchie-Bruch. | `<h2 className="section-title">`. |
| A-14 | `app/page.tsx:184,219,235` | 3/10 | P2 | M | Magic-Width `sm:max-w-[calc(50%-0.375rem)]` ist an `gap-3` gekoppelt — fragil. | Echtes Grid `grid-cols-1 sm:grid-cols-2`. |
| A-15 | `BottomNav.tsx:168-174` | 5/7 | P2 | S | Disabled-Nav-Items (`<span aria-disabled>`) erklären nicht, warum sie inaktiv sind. | `aria-label`/`title` mit Begründung („Erst Treffen wählen“). |
| A-16 | `HeaderMenu.tsx:216-222` | 5/3 | P2 | S | Status-/Fehlertext `max-w-[12rem] text-right` unterm Menü — leicht übersehbar, schneidet ab. | `role="alert"`, volle Breite, `text-left`. |
| A-17 | `BottomNav.tsx:162` vs. Header | 10 | P2 | M | BottomNav ab `md` auf 72rem begrenzt, Header full-bleed — Breiten-Divergenz auf Desktop. | Vereinheitlichen (beides full-bleed mit `container-app`-Inhalt). |
| A-18 | `app/page.tsx:138` | 5 | P2 | S | BGG-Hotness-Fetch `.catch(() => null)` — stiller Ausfall ohne Hinweis. | Akzeptabel; optional dezenter Fallback-Text. *Annahme: bewusster Trade-off.* |
| A-19 | `GameOfTheDayCard.tsx:117` | 1 | P3 | S | Cover `rounded-lg` statt System-Radius. | Siehe SYS-10. |
| A-20 | `Header.tsx:16-17`, `BottomNav.tsx:125-151` | 2/8 | P3 | M | Emoji-Icons (🎲 📅 🗳️) neben SVG-Icons (`icons.tsx`) — plattformabhängiges Rendering, Stilbruch. | Mittelfristig SVG-Icons mit `aria-hidden`. |
| A-21 | `HomeSpotlightCarousel.tsx:159` | 8 | P3 | S | „BGG Hotness“ — Fachjargon ohne Erklärung. | „Beliebt auf BGG“ o. ä. |
| A-22 | `app/page.tsx:245-257` | 2 | P3 | S | `PageHeader`-Komponente existiert, wird auf der Startseite aber nicht genutzt (manuelles Markup). | Hero auf `PageHeader` umstellen. |

---

## 2. Sammlung `/games` + Detail (B)

| ID | Datei:Zeile | Kat. | Sev. | Aufw. | Problem | Empfehlung |
|----|-------------|------|------|-------|---------|------------|
| B-01 | `GameCard.tsx:449-460` (Button-Variante), `GameCard.tsx:402-409` (Link-Variante) | 7 | **P0** | L | Die Karte ist ein `<button>` bzw. `<Link>`, enthält aber selbst Buttons (`FilterChipButton` in `TagRows` Z.204-214, `ExpansionFamilyNav` Z.216-223). **Verschachtelte interaktive Elemente = invalides HTML**, Screenreader-/Tastatur-Verhalten undefiniert. (Verifiziert.) | Karten-Hülle als `<div className="card card-game">`; Aktivierung nur auf Cover+Titel (Button/Link), Chips/Nav als Geschwister außerhalb. Der bestehende `.chip-interactive`-Pointer-Guard (Z.418) kann dann entfallen. |
| B-02 | `GamesFilterBar.tsx:92-261` | 4 | P1 | M | Suche + alle Filter stecken in einem zugeklappten `<details>` — die primäre Suche braucht immer einen Extra-Tap. | Suchfeld permanent über dem Accordion rendern; nur Filter einklappen. |
| B-03 | `GamesFilterBar.tsx:112` | 6 | P1 | S | Jeder Tastendruck triggert sofort `router.push` (Server-Roundtrip, `force-dynamic`) — kein Debounce. | Lokaler Input-State + ~300ms-Debounce für URL-Update. |
| B-04 | `GamesFilterBar.tsx:60,69` | 5 | P1 | S | `useTransition` vorhanden, aber `isPending` wird ignoriert — kein Feedback während Filter-/Sortier-Navigation. | `isPending` nutzen: Grid mit `opacity-60`/`aria-busy`. |
| B-05 | `app/games/page.tsx:73-77` | 5 | P1 | M | Kein `loading.tsx` im Route-Segment — Filterwechsel blockiert ohne Loading-Zustand. | `app/games/loading.tsx` mit Karten-Skeleton; ergänzt B-04. |
| B-06 | `GameDetailModal.tsx:450-501` | 7 | P1 | S | Modal hat keinen sichtbaren Schließen-Button (nur Overlay/Escape/Drag/Back) — auf Desktop schwer entdeckbar. | Schließen-Button in der `modal-drag-zone` (`aria-label="Schließen"`), Pattern aus `CoverPickerDialog.tsx:313-320`. |
| B-07 | `CoverPickerDialog.tsx:223-234,297-426` | 7 | P1 | M | Escape + Scroll-Lock ja, aber **kein Fokus-Trap, kein Initial-Fokus** (im Gegensatz zu `GameDetailModal`). | Von SYS-08 (ModalShell) abgedeckt; kurzfristig Trap + Initial-Fokus nachrüsten. |
| B-08 | `GameDetailCover.tsx:26-32` | 4 | P1 | S | Galerie-Pfeile 36px — unter Touch-Minimum. | Siehe SYS-13. |
| B-09 | `GameDetailCover.tsx:104-108` | 6 | P1 | S | Auto-Advance (10s) ohne reduced-motion-Check. | Wie A-10. |
| B-10 | `GameDetailCover.tsx:134-164` | 7 | P1 | M | Galerie ohne Tastatur-Navigation (Pfeiltasten). | `onKeyDown` am Container, analog A-05. |
| B-11 | `GameCard.tsx:276-287` | 4 | P1 | S | `DetailsButton` 28px — zu klein für Touch. | Siehe SYS-13. |
| B-12 | `GamesClient.tsx:29-35` | 3 | P2 | S | Empty State nur ein `<p>` — keine Hierarchie, kein CTA. | `.card` + `.section-title` + „Filter zurücksetzen“-Button. |
| B-13 | `GamesClient.tsx:50-57` | 5 | P2 | S | Verliehene Spiele nur `opacity-50`, bleiben voll klickbar — Status nicht klar kommuniziert. | `aria-disabled` + Hinweis; oder bewusst klickbar lassen und im Detail erklären. *Annahme: Klickbarkeit evtl. gewollt.* |
| B-14 | `GamesFilterBar.tsx:210,242-245` | 8 | P2 | S | Label „Rating“ (Englisch) in deutscher UI. | „Bewertung“. |
| B-15 | `GameDetailView.tsx:153,158` | 8 | P2 | S | „Best · 4P“ / „Empf. · 4P“ — Denglisch/Abkürzungs-Mix neben deutschem Text. | „Beste: 4 Spieler“ / „Empfohlen: 4 Spieler“. |
| B-16 | `GameDetailView.tsx:209-224` | 3 | P2 | S | Beschreibungs-Card ohne `section-title`, Mechaniken-Section hat einen — uneinheitlich. | `<h2 className="section-title">Beschreibung</h2>`. |
| B-17 | `CoverPickerDialog.tsx:44-65` | 2 | P2 | S | Eigene Tab-Buttons statt `.segment-control` + `.btn-tab`. | Auf Designsystem-Pattern umstellen. |
| B-18 | `CoverPickerDialog.tsx:59` | 1 | P2 | S | `text-[var(--accent-foreground,#fff)]` — Token existiert nicht (Fallback greift, funktioniert also). | Direkt `text-white` oder Token `--on-accent` einführen. |
| B-19 | `FilterChipButton.tsx:57-69` | 7 | P2 | S | Aktive Filter-Chips ohne `aria-pressed`. | `aria-pressed={isActive}`. |
| B-20 | `FilterChipButton.tsx:64` | 5 | P2 | S | Chip-Navigation ohne `useTransition`/Pending-Feedback (inkonsistent zu GamesFilterBar). | Gleiches Transition-Pattern. |
| B-21 | `GamesClient.tsx:40` | 10 | P2 | S | Grid `sm:grid-cols-2 lg:grid-cols-4` — Tablet (768–1023px) bleibt bei 2 Spalten. | `md:grid-cols-3` ergänzen. |
| B-22 | `ExpansionRequiredBanner.tsx:3`, `LentOutBanner.tsx:3` | 7 | P2 | S | Banner komplett `aria-hidden` — Info hängt allein am Cover-`aria-label` (`GameCard.tsx:147-154`). Funktioniert, aber fragil. | Bewusst dokumentieren oder `role="img" aria-label` direkt am Banner. |
| B-23 | `app/games/[id]/page.tsx:22` | 3 | P2 | S | Eyebrow „Spielesammlung“ ist Plain-Text — kein Rückweg zur Liste. | Eyebrow als `<Link href="/games">`. |
| B-24 | `ExpansionFamilyNav.tsx:91-94` | 2 | P2 | M | `.expansion-family-menu` nur als One-off, parallel zum `.filter-dropdown`-Pattern. | In `globals.css` aufnehmen oder Dropdown-Pattern wiederverwenden. |
| B-25 | `GamesFilterBar.tsx:250-257` | 4 | P3 | S | Checkbox „Erweiterungen anzeigen“ — native Checkbox <44px Hit-Area. | Label auf `min-h-[2.75rem]`; `accent-color: var(--accent)`. |
| B-26 | `GameCover.tsx:14-19` | 5 | P3 | S | Placeholder-Cover (🎲) `aria-hidden` — kein Hinweis „kein Cover“. | `role="img" aria-label="Kein Cover verfügbar"`. |
| B-27 | `GameCard.tsx:260` | 1 | P3 | S | `text-[10px]` statt Chip-Skala (0.72rem). | `text-[0.72rem]`. |

---

## 3. Meetups: Formular + Übersicht (C)

| ID | Datei:Zeile | Kat. | Sev. | Aufw. | Problem | Empfehlung |
|----|-------------|------|------|-------|---------|------------|
| C-01 | `MeetupActionsMenu.tsx:47` | 4 | **P0** | S | Host-Menü ist `hidden md:flex` — unter 768px **komplett unsichtbar**. Hosts können ein Treffen am Smartphone nicht löschen. (Verifiziert.) | `hidden` entfernen (`relative flex …`); Dropdown mit `max-w-[calc(100vw-2rem)]`. |
| C-02 | `MeetupVoteActions.tsx:70-79` | 7 | P1 | M | Deaktivierter „Duell-Modus“ ist ein `<span>` mit Button-Klassen — nicht fokussierbar, `title` reicht Screenreadern nicht. | `<button type="button" disabled>` + sichtbarer Hinweistext via `aria-describedby`. |
| C-03 | `KickParticipantButton.tsx:31`, `JoinMeetupButton.tsx:35` | 6 | P1 | S | Fehler via `alert()` — blockierend, unstylebar, bricht das visuelle System. (Verifiziert.) | Inline-Fehler mit `role="alert"` (Pattern `MeetupForm.tsx:69-71`). |
| C-04 | `MeetupShareQr.tsx:152` | 4 | P1 | S | Share-Button fest 32px. | Siehe SYS-13. |
| C-05 | `KickParticipantButton.tsx:41` | 4 | P1 | S | Kick-Button `min-w-[28px]` — schwer treffbar. | Siehe SYS-13. |
| C-06 | `MeetupShareQr.tsx:160-228` | 7 | P1 | M | QR-Modal: Escape ja, aber kein Fokus-Transfer/Trap. | Von SYS-08 abgedeckt. |
| C-07 | `MeetupActionsMenu.tsx:48-71` | 7 | P1 | S | Dropdown ohne Escape (anders als HeaderMenu-Soll) und ohne Pfeiltasten. | `useEscapeKey` + Arrow-Navigation (WAI-ARIA-Menu). |
| C-08 | `MeetupVoteActions.tsx:40-46` + `MeetupRankings.tsx:198-209` | 2/3 | P1 | M | `HostForcedGameBanner` erscheint **zweimal** auf derselben Seite mit leicht anderem Copy. | Nur einmal rendern (Ergebnisse); in VoteActions Kurzverweis. |
| C-09 | `MeetupRankings.tsx:252-254` | 3/5 | P1 | S | Fortschrittstext nur für Hosts — Nicht-Hosts sehen kontextlose gesperrte Card. | Neutralen Status-Text für alle anzeigen. |
| C-10 | `app/meetups/[id]/page.tsx:450-457` | 5 | P1 | S | Gäste (QR-Link) sehen keinen Teilnahme-CTA, obwohl die Seite öffentlich ist. | Für `!user`: Link „Anmelden zum Teilnehmen“ → `/#login`. |
| C-11 | `MeetupRankings.tsx:227-240`, `Ranking.tsx:264-273` | 7 | P1 | S | Tab-Buttons ohne `role="tablist"`/`aria-selected`. | ARIA-Tabs-Pattern ergänzen. |
| C-12 | Banner-Familie: `HostForcedGameBanner`, `HostRecommendationBanner`, `ExpansionVoteFollowsBanner`, `ExpansionRequiredBanner`, `LentOutBanner`, Inline-Callout `MeetupVoteActions.tsx:52-60` | 2 | P2 | L | Mind. 4 Banner-Architekturen (Card-Status, absolute Overlays, CSS-Diagonalband, Inline-Callout) ohne gemeinsames API. | Diagonalbänder (CSS) sind ok als eigene Gattung; Card-Status + Callouts auf gemeinsame `<Callout variant>`-Komponente ziehen. |
| C-13 | `MeetupParticipants.tsx:61` | 1 | P2 | S | `progress-bar-fill` per Tailwind auf `--accent` überschrieben (Default: `--primary`). | Modifier `.progress-bar-fill-accent` in `globals.css` (auch von `ImportClient.tsx:229` genutzt → E-12). |
| C-14 | `MeetupRankings.tsx:152-158` | 6 | P2 | S | Reveal wartet stets 250ms, auch bei reduced-motion (CSS-Animation aus, Delay bleibt). | Early-return bei reduced-motion (`Ranking.tsx:175` macht es vor). |
| C-15 | `MeetupForm.tsx:69-71` | 7 | P2 | S | Server-Fehler ohne `role="alert"`. | `role="alert"` ergänzen. |
| C-16 | `MeetupExpansionActions.tsx:105-118` | 5/6 | P2 | S | Pending nur via `disabled`, kein Label; Erfolg erst nach 5s-Polling sichtbar. | Pending-Label + `router.refresh()` nach Erfolg. |
| C-17 | `MeetupMandatoryExpansions.tsx:19-27,49` | 5 | P2 | M | Toggle-Fehler werden verschluckt; `pending` ohne visuelles Feedback. | Action-Resultat prüfen, Fehler inline, `aria-busy`. |
| C-18 | `MeetupShareQr.tsx:142-144` | 6 | P2 | S | Clipboard-Fehler still ignoriert. | Kurzer Fehlertext „Kopieren fehlgeschlagen“. |
| C-19 | `MeetupOverviewCard.tsx:59-87` | 3/4 | P2 | M | Nur Titel/Datum verlinkt; Rest der Karte ist tote Fläche — verwirrende Tap-Ziele. | Ganze Card verlinken, Join-Button als separates interaktives Element (kein Nesting — vgl. B-01!). |
| C-20 | `MeetupRankings.tsx:202,216` vs. `PageHeader.tsx:17` | 3 | P2 | S | `scroll-mt-24` vs. `scroll-mt-[var(--header-height)]` — inkonsistente Anker-Offsets. | Einheitlich `scroll-mt-[calc(var(--header-height)+1rem)]`. |
| C-21 | `app/meetups/[id]/page.tsx:423-488` | 3 | P2 | M | Eine Mega-Card bündelt Spielerzahl, Steuerung, Teilnehmer, Vote, Expansion — auf Mobile sehr lang, schwache Hierarchie. | Untersektionen mit `border-t` + `.section-title` trennen. |
| C-22 | `Ranking.tsx:117-119` | 8 | P2 | S | Label „… @ 4 Spielern“ — `@` untypisch im deutschen UI. | „bei 4 Spielern“. |
| C-23 | `app/meetups/new/page.tsx:12-14` | 3 | P3 | S | Nur `page-title` ohne Eyebrow; Detailseite nutzt `PageHeader`. | `<PageHeader eyebrow="Treffen" title="Neues Treffen" />`. |
| C-24 | `MeetupOverviewCard.tsx:64` | 1 | P3 | S | Titel `font-bold text-lg` außerhalb der Typo-Skala. | `.section-title` oder definierte Card-Title-Größe. |
| C-25 | `MeetupMandatoryExpansions.tsx:57` | 1 | P3 | S | Chip mit `text-[10px]` unter Chip-Token-Größe. | Standard-`.chip`. |
| C-26 | `app/meetups/new/page.tsx:12` vs. `[id]/page.tsx:406` | 3 | P3 | S | `gap-4` vs. `gap-6` zwischen Seiten — Rhythmus-Drift. | Einheitlich `gap-6`. |

---

## 4. Voting-Modi: Duell / Pick / Erweiterung (D)

Hinweis: `app/meetups/[id]/tinder/page.tsx` ist nur noch ein Redirect nach `/duell` (Z.8-9) — kein Swipe-UI mehr vorhanden (Legacy-Route).

| ID | Datei:Zeile | Kat. | Sev. | Aufw. | Problem | Empfehlung |
|----|-------------|------|------|-------|---------|------------|
| D-01 | `DuellClient.tsx:122`, `ExpansionDuellClient.tsx:100`, `PickClient.tsx:459`, `ExpectedCountControl.tsx:74` | 6/7 | P1 | S | Fehler-/Limit-Hinweise in **Grün** (`--accent`) mit `role="alert"` — Farbe widerspricht Semantik. | Siehe SYS-07 (`--danger`-Token). |
| D-02 | `DuelArena.tsx:65-83` | 7 | P1 | S | Duell-Karten fokussierbar, aber ohne sichtbaren Fokus (kein `:focus-visible` im Projekt). | Von SYS-05 abgedeckt — Tastatur-Duell ist danach möglich. |
| D-03 | `DuellClient.tsx:104-160`, `ExpansionDuellClient.tsx:84-140` | 7 | P1 | S | Nach Vote wechselt das Paar ohne `aria-live` — Screenreader bekommen das neue Duell nicht mit. | `aria-live="polite"`-Statuszeile („Duell 3 von 12: A gegen B“). |
| D-04 | `SyncConflictDialog.tsx:88-157` | 4/10 | P1 | M | 5-Spalten-Tabelle ohne `overflow-x-auto` — auf 360px abgeschnitten. | Wrapper `overflow-x-auto`; mittelfristig Card-Stack auf Mobile. |
| D-05 | `SyncConflictDialog.tsx:60-74` | 7 | P1 | S | Dialog ohne Escape und ohne Fokus-Management (einziges Modal ganz ohne). | `useEscapeKey(onCancel)` + Initial-Fokus; von SYS-08 abgedeckt. |
| D-06 | `app/meetups/[id]/duell/page.tsx:96-191` | 2/3 | P1 | M | Fünf nahezu identische Gate-Cards (~90 % Duplikat) — Copy/Layout driften auseinander. | Shared `DuellGateCard({ title, description, action })`. |
| D-07 | `ExpectedCountControl.tsx:69-70` | 8/5 | P1 | S | Pending zeigt „gespeichert…“ **während** gespeichert wird — irreführend. | „Speichere…“; optional kurzes „Gespeichert“-Feedback. |
| D-08 | `DuellSessionGuard.tsx:31-34` | 5/6 | P2 | M | Bei Vote-Reset stiller `router.replace` — Nutzer verliert ohne Erklärung den Kontext. | Kurzer Hinweis/Toast „Abstimmung wurde zurückgesetzt“. |
| D-09 | `DuellClient.tsx:76-99` vs. `ExpansionDuellClient.tsx:59-79` | 2 | P2 | M | Fertig-Screens ~80 % identisch, aber CTA „Zum Ranking“ vs. „Zum Ergebnis“ (gleiches Ziel!) und andere Untertitel. | `DuelFinishedCard`-Komponente + einheitliches CTA-Label. |
| D-10 | `DuellClient.tsx:109-110` vs. `ExpansionDuellClient.tsx:89-90` | 2/8 | P2 | S | Fortschritt „Duell 3 von 12“ vs. „3 / 12“. | Einheitlich „Duell X von Y“. |
| D-11 | `DuellClient.tsx:162` vs. `PickClient.tsx:429` | 1/2 | P2 | S | Duell-Footer handgebaut (`bg-[var(--background)] border-t`), Pick nutzt `.picker-sticky-bar` — zwei Sticky-Footer-Systeme. | Duell-Footer auf `.picker-sticky-bar`-Variante umstellen. |
| D-12 | `DuellClient.tsx:78,96` vs. `duell/page.tsx:98` | 1/2 | P2 | S | Card-Padding inline `1.5rem` vs. `var(--space-card)` — inkonsistente Dichte. | `.card-pad` (SYS-06) bzw. bewusste `--space-card-lg`-Variante. |
| D-13 | `PickClient.tsx:304-326,356-362` | 3/8 | P2 | M | Phasen-Banner ist langer Fließtext ohne Hierarchie — schwer scannbar. | Headline (`font-semibold`) + Sekundärsatz. |
| D-14 | `PickClient.tsx:389-396` | 5 | P2 | S | Empty State (0 Spiele) nur `<p>` — andere Modi nutzen `.card` + CTA. | Wie Duell-Gates: `.card` + Headline + CTA. |
| D-15 | `SyncConflictDialog.tsx:126-149` | 4/7 | P2 | M | Radio-Optionen `text-xs`, native Inputs — Touch-Targets klein. | Labels `min-h-[2.75rem] py-2`. |
| D-16 | `DuelArena.tsx:20-26` | 7 | P2 | S | Progressbar: statisches `aria-label`, kein `aria-valuetext` („5 von 12“). | `aria-valuetext={`${done} von ${total}`}`. |
| D-17 | `PickClient.tsx:367` / `PickClient.tsx:356-357` | 1 | P2 | S | Skeleton `rounded-xl`, Status-Banner `rounded-lg border` statt System-Pattern. | Siehe SYS-10; Banner → `.filter-bar`/`.card`. |
| D-18 | `pick/page.tsx:95` vs. `duell/page.tsx:252` | 3 | P2 | S | `gap-6` vs. `gap-3 sm:gap-4` — Rhythmus-Drift zwischen verwandten Flows. | Einheitlich `gap-4 sm:gap-6`. |
| D-19 | `DuellClient.tsx:114-117` vs. `ExpansionDuellClient.tsx:94-96` | 2/3 | P2 | S | Gruppenfortschritt nur Host (Basis) vs. alle (Erweiterung). | Eine Regel für beide Modi festlegen. *Annahme: fachlich evtl. gewollt — bitte bestätigen.* |
| D-20 | `duell/page.tsx:100,121,142,168` | 1 | P3 | S | Gate-Headlines `text-lg font-bold` statt `.section-title`. | `.section-title` (entfällt mit D-06). |
| D-21 | `DuelArena.tsx:104-114` / `globals.css:775` | 4 | P3 | S | VS-Badge-Overlay (`top: 40%`) kann auf Mobile die Covermitte verdecken. | Position prüfen/auf 50 % zwischen Kartenrändern. *Annahme: visuell zu verifizieren.* |
| D-22 | `ParticipantPickChip.tsx:44` | 7/9 | P3 | S | Leere Sterne `opacity-30` auf Foreground — Kontrast knapp. | `color: var(--muted)` statt Opacity. |
| D-23 | `ExpansionFamilyNav.tsx:192-194` | 7/8 | P3 | S | Toggle `▴/▾` ohne `aria-label`. | `aria-label="Erweiterungen auswählen"`. |
| D-24 | `ExpectedCountControl.tsx:45` vs. `ExpectedCountReadOnly.tsx:3-7` | 2/8 | P3 | S | Labels/Typo zwischen Host-Control und ReadOnly nicht gespiegelt. | Gleiche Phrase + `font-bold text-lg tabular-nums` in beiden. |
| D-25 | `DuellClient.tsx:106` | 3 | P3 | S | `sticky-below-header -mx-1` bricht Container-Ausrichtung minimal. | `-mx-1` entfernen oder dokumentieren. |

---

## 5. Admin: Collection, Edit, Import (E)

| ID | Datei:Zeile | Kat. | Sev. | Aufw. | Problem | Empfehlung |
|----|-------------|------|------|-------|---------|------------|
| E-01 | `CollectionManagerClient.tsx:181-182` | 5/3 | P1 | S | Leere Sammlung zeigt „Keine Spiele passen zum Filter.“ — falscher Empty State, kein Import-/Hinzufügen-CTA. | `games.length === 0` → eigener Empty State mit CTAs (Import-Link, „Spiel hinzufügen“). |
| E-02 | `CollectionManagerClient.tsx:218-229` | 5 | P1 | M | Ein globales `pending` setzt **alle** Zeilen-Buttons auf „…“, obwohl nur eine Aktion läuft. | `pendingGameId`+`pendingAction` tracken; nur betroffenen Button disablen. |
| E-03 | `CollectionManagerClient.tsx:54-57,103-105` | 6/7 | P1 | M | Destruktive Aktionen (Sammlung leeren, Spiel löschen) via `window.confirm` — uneinheitlich zu `.modal-*`. | Bestätigungs-Modal (`role="alertdialog"`) auf ModalShell-Basis (SYS-08). |
| E-04 | `ImportClient.tsx:101-126` | 5/6 | P1 | M | Anreicherungs-Loop (bis 200 Iterationen) ohne Abbruchmöglichkeit/Cleanup. | `AbortController` + „Abbrechen“-Button; Cleanup bei Unmount. |
| E-05 | `AddGameModal.tsx:311,586,591` | 1/9 | P2 | S | Fehler/Erfolg mit Tailwind-Palette (`text-red-600 dark:…`, `text-green-700 dark:…`) statt Token — einziger Ausreißer im Admin. | `text-[var(--danger)]` (SYS-07) bzw. `text-[var(--accent)]`. |
| E-06 | `CollectionManagerClient.tsx:173-174`, `GameEditClient.tsx:478-479`, `ImportClient.tsx:179-187` | 7 | P2 | S | Statusmeldungen ohne `role="status"`/`role="alert"`. | Fehler `role="alert"`, Erfolg `role="status"`. |
| E-07 | `CollectionManagerClient.tsx:163-170` | 4 | P2 | S | Checkbox „Nur Basisspiele“ ohne vergrößerte Hit-Area. | Label `min-h-[2.75rem]`. |
| E-08 | `GameEditClient.tsx:482-488` | 3/10 | P2 | M | „Speichern“ nur am Ende eines ~350-Zeilen-Formulars — viel Scrollen auf Mobile. | Sticky Action-Bar (`.sticky-above-nav`-Pattern). |
| E-09 | `GameEditClient.tsx:155-496` | 5 | P2 | S | Felder bleiben während `pending` editierbar. | `fieldset disabled={pending}` o. ä. |
| E-10 | `CollectionManagerClient.tsx:55,73,243-245` | 8 | P2 | S | „aus der Sammlung löschen“ vs. „entfernt“ vs. „aus der Datenbank“ — `purgeCollectionAction` löscht tatsächlich aus der DB. | Einheitlich und ehrlich: „endgültig löschen“. |
| E-11 | `CollectionManagerClient.tsx:241` | 8 | P2 | S | „Danger Zone“ (Englisch). | „Gefahrenbereich“. |
| E-12 | `ImportClient.tsx:229-230` | 1 | P2 | S | `.progress-bar-fill` mit `bg-[var(--accent)]`-Override (wie C-13). | Modifier `.progress-bar-fill-accent`. |
| E-13 | `ImportClient.tsx:163-169` | 7 | P2 | S | File-Input ohne sichtbares Label. | `<label className="label">` + beschrifteter Button. |
| E-14 | `AddGameModal.tsx:487-490,521-524` | 7 | P2 | S | Kandidaten-Thumbnails mit `alt=""` — für die Auswahl relevant. | `alt={item.name}`. |
| E-15 | `ImportClient.tsx:33-34,101-125` | 2/5 | P2 | S | Manuelle Loading-Flags statt `useTransition` (Rest des Admin nutzt Transitions). | Pattern angleichen. |
| E-16 | `ImportClient.tsx:156` | 8 | P2 | S | „Collection-CSV“ — Denglisch. | „Sammlungs-CSV (BGG-Export)“. |
| E-17 | `CollectionManagerClient.tsx:215-217` | 6 | P2 | S | „Zurückgegeben“ als `btn-primary` — liest sich wie Haupt-CTA statt Status-Toggle. | `btn-ghost` + Status-Chip „Verliehen“. |
| E-18 | `GameEditClient.tsx:216-246` | 10 | P2 | S | `sm:grid-cols-3` ab 640px — enge Spalten auf schmalen Tablets. | `sm:grid-cols-2 lg:grid-cols-3`. |
| E-19 | `app/admin/collection/page.tsx:41-45`, `app/admin/import/page.tsx:34-39` | 3 | P3 | S | Kein `.page-eyebrow` („Administration“) — Hierarchie schwächer als App-Seiten. | `PageHeader` mit Eyebrow nutzen. |
| E-20 | `GameEditClient.tsx:424-430` | 5/8 | P3 | S | Ungültige BGG-ID → stilles `return` ohne Feedback. | Inline-Fehler unter dem Feld. |
| E-21 | `AddGameModal.tsx:310-334` | 5/6 | P3 | M | Kamerafehler entfernt Video-UI komplett, kein Retry. | „Kamera erneut versuchen“-Button. |
| E-22 | `AddGameModal.tsx:295` | 1 | P3 | S | Inline `maxWidth: "28rem"` statt Klasse. | `max-w-md` am Panel. |
| E-23 | `CollectionManagerClient.tsx:209,225` vs. `:142` | 1 | P3 | S | Mix `min-h-[44px]` (px) vs. `2.75rem` vs. Inline-Style für dieselbe Zielgröße. | Durchgängig `2.75rem` bzw. `.btn-tab`. |

---

## Top 10 Quick Wins (Impact ÷ Aufwand)

1. **C-01** — Host-Menü auf Mobile sichtbar machen (`hidden md:flex` → `flex`). Eine Zeile, behebt funktionale Lücke.
2. **SYS-01/02/03** — Drei fehlende Tokens definieren (`--radius`, `--surface-elevated`, `--card`→`--surface`). Wenige CSS-Zeilen, beheben drei sichtbare Render-Bugs.
3. **SYS-05** — Globales `:focus-visible` für `.btn`/`.card-game`/`.chip-interactive`. Ein CSS-Block, A11y-Gewinn auf jeder Fläche.
4. **SYS-04** — `.btn-sm` definieren (16 bestehende Verwendungen werden schlagartig korrekt).
5. **SYS-07 (Teil 1)** — `--danger`-Token + grüne Fehlertexte in den Voting-Modi auf Rot umstellen (D-01, Suchen/Ersetzen-artig).
6. **C-03** — `alert()` in Join/Kick durch Inline-`role="alert"` ersetzen.
7. **B-03/B-04** — Such-Debounce + `isPending`-Feedback in der Filterbar. ~15 Zeilen, spürbar auf jeder Sammlungs-Interaktion.
8. **B-06** — Sichtbarer Schließen-Button im `GameDetailModal` (Pattern existiert schon im CoverPicker).
9. **SYS-13 (Kern)** — Touch-Targets: Carousel-Pfeile/Dots, Kick-, Share-, Details-Button auf 2.75rem-Hitbox.
10. **Microcopy-Sammelfix** — A-07 („Vote“→„Stimmen“), A-08 („Collection“→„Sammlung“), B-14 („Rating“→„Bewertung“), E-11 („Danger Zone“→„Gefahrenbereich“), D-07 („gespeichert…“→„Speichere…“), C-22 („@“→„bei“).

---

## Systemische Themen (brauchen eine Refactoring-Entscheidung)

1. **Fehlende/halbtote Designsystem-Artefakte.** Vier referenzierte, aber nie definierte Artefakte (`--radius`, `--surface-elevated`, `--card`, `btn-sm`) zeigen: Komponenten erfinden Tokens, die das System nie bekommen hat. → Tokens nachziehen *und* als Konvention festhalten: neue `var(--…)`-Referenzen nur auf existierende Tokens.
2. **Keine semantischen Status-Farben.** `--primary` (Brand-Rot) doubelt als Fehlerfarbe, `--accent` (Grün) wird teils für Fehler missbraucht. → `--danger` einführen, `--accent` strikt = positiv, `--warning` = Hinweis.
3. **Modal-Zoo (5 Implementierungen).** GameDetailModal ist das vollständigste (Drag, Trap, History); CoverPicker, ShareQr, AddGame, SyncConflict besitzen jeweils Teilmengen. → Eine `ModalShell` mit Varianten `sheet`/`dialog`; schrittweise Migration (SyncConflict zuerst, ist am kaputtesten).
4. **Card-Padding als Inline-Style.** `.card` hat bewusst kein Padding, daher >15× `style={{ padding: "var(--space-card)" }}`. → `.card-pad`-Utility, mechanische Migration.
5. **DuellClient ↔ ExpansionDuellClient: ~75–85 % Duplikat.** Gleicher Hook, gleiches Gerüst; Unterschiede nur in Host-Logik/Labels/Footer. Dazu 5 duplizierte Gate-Cards und 2 Fertig-Screens. → `DuelModeShell` + `DuellGateCard` + `DuelFinishedCard` extrahieren (Verhalten unangetastet lassen).
6. **Zwei Sticky-Footer-Systeme** (`.picker-sticky-bar` vs. handgebauter Duell-Footer) und zwei Scroll-Helper-Kopien. → auf je ein Pattern konsolidieren.
7. **Banner-Fragmentierung.** Diagonalbänder (CSS, ok als eigene Gattung) vs. Card-Status vs. Overlay vs. Inline-Callout — kein gemeinsames API, Copy driftet (C-08 doppelter Banner). → `<Callout>`-Komponente für Status/Hinweis-Fälle.
8. **Pending-State-Patterns.** `useTransition` + „…“ vs. manuelle Flags vs. globales `pending` über ganze Listen (E-02). → Konvention (Verb+„…“, `aria-busy`, pro-Aktion-Scope) festschreiben.
9. **Touch-Target-Disziplin.** Drei Maßsysteme (`44px`, `2.75rem`, freie Kleinstgrößen). → `2.75rem` als einzige Konvention; ggf. `.touch-target`-Utility.
10. **Reduced-Motion-Lücken bei JS-Animationen.** CSS ist gut abgedeckt, aber JS-Timer (Auto-Advance ×2, Reveal-Delay) und `scrollIntoView` ignorieren die Präferenz. → zentraler `prefersReducedMotion()`-Helper.

---

## Vorgeschlagene Fix-Reihenfolge (Batches)

**Batch 1 — P0 + Token-Fixes (klein, sofort sichtbar)**
C-01 (Host-Menü mobil) · SYS-01/02/03 (fehlende Tokens) · SYS-04 (`.btn-sm`) · SYS-05 (`:focus-visible`) · SYS-07 (`--danger` + grüne Fehler D-01, E-05) · A-01 (`scroll-mt` Login).

**Batch 2 — Quick-Win-UX (S-Aufwände)**
C-03 (`alert()` raus) · B-03/B-04 (Debounce + Pending) · B-06 (Modal-Close-Button) · SYS-13 (Touch-Targets) · Microcopy-Sammelfix (A-07, A-08, B-14, B-15, C-22, D-07, D-10, E-11, E-16) · E-01 (Empty State) · D-16/C-15/E-06 (ARIA-Kleinigkeiten).

**Batch 3 — GameCard-Restrukturierung (P0, L)**
B-01: Verschachtelte Interaktive auflösen (Card-Hülle als `div`, Aktivierungsfläche getrennt von Chips/Nav). Anschließend C-19 (Overview-Card-Linkfläche) nach gleichem Muster. Vorsicht: Pick-/Duell-Selektionslogik (`onActivate`, `.chip-interactive`-Guard) erhalten.

**Batch 4 — Konsolidierung Zustände & Feedback**
E-02 (pro-Zeile-Pending) · E-03 (Confirm-Modal) · B-05 (`loading.tsx`) · C-16/C-17 (Expansion-Feedback) · D-08 (Reset-Hinweis) · SYS-12 (Pending-Copy-Konvention) · SYS-09 (Scroll-Helper + reduced-motion) · A-10/B-09 (Auto-Advance) · C-14 (Reveal-Delay).

**Batch 5 — Strukturelle Refactorings (je eigener Review)**
SYS-08 (ModalShell, Migration beginnend mit SyncConflictDialog: D-04/D-05, dann B-07, C-06, E-03) · Duell-Duplikate (D-06, D-09, D-11; Verhalten unverändert) · SYS-06 (`.card-pad`-Migration) · C-12 (Callout-Komponente, inkl. C-08) · SYS-10 (Radius-Normalisierung).

**Batch 6 — Polish**
Restliche P2/P3: Typo-Hierarchie (A-13, B-16, C-23, C-24, D-20, E-19) · Grids/Responsiveness (A-14, B-21, E-18) · A-20 (Emoji→SVG, optional) · übrige P3.

---

## Explizit nicht angefasst (Verhalten ist gewollt)

- Voting-/Punktelogik, Duell-Animationen (`duel-card-*`), Swipe-Back, Scroll-Chrome-Mechanik.
- Diagonalband-Banner als visuelles Konzept (nur A11y-Detail B-22).
- QR-Code-Schwarz/Weiß (scan-technisch notwendig).
- `/tinder`-Redirect (Legacy-Route, funktional korrekt).
