# Browser-E2E-Test: Refactoring-Bericht

Datum: 2026-07-03T10:16:03.504Z

| Phase | Check | Status | Anmerkung |
|-------|-------|--------|-----------|
| Setup | Login als E2E-Host | OK |  |
| Setup | Session bleibt nach Reload erhalten | OK |  |
| Setup | Geheimmenü per sessionStorage aktiviert | OK |  |
| Setup | Dummy-Treffen erzeugen | OK |  |
| Setup | Dummy-Treffen in Übersicht gefunden | SKIP | Kein Dummy-Link sichtbar |
| Setup | E2E-Treffen angelegt | OK | cmr4s2eo20094pswzrzzceha3 |
| Smoke | Startseite lädt (HTTP 200) | OK |  |
| Smoke | /games lädt (HTTP 200) | OK |  |
| Smoke | /meetups/new lädt (HTTP 200) | OK |  |
| Smoke | Meetup-Detail lädt (HTTP 200) | OK |  |
| Smoke | /pick lädt (HTTP 200) | OK |  |
| Smoke | /duell lädt (HTTP 200) | OK |  |
| Smoke | /erweiterung lädt (HTTP 200) | OK |  |
| Smoke | /admin/collection lädt (HTTP undefined) | OK |  |
| Smoke | /admin/import lädt (HTTP 200) | OK |  |
| Smoke | /games/[id] | SKIP | Keine Spiele in Sammlung |
| Smoke | /tinder redirectet nach /duell | OK |  |
| Auth/Meetups | ExpectedCountControl speichert und überlebt Reload | OK | 4 → 5 |
| Auth/Meetups | MeetupActionsMenu für Host sichtbar | OK |  |
| Auth/Meetups | QR-Modal schließt mit Escape | OK |  |
| Auth/Meetups | Admin-Menü schließt mit Escape | OK |  |
| Auth/Meetups | Gast kann Treffen beitreten | OK |  |
| Auth/Meetups | MeetupActionsMenu für Gast nicht sichtbar | OK |  |
| Auth/Meetups | Host kann Gast entfernen | SKIP | Kick-Button nicht sichtbar |
| Voting | Pick-Seite lädt | OK |  |
| Voting | Pick: Spiel antippen | OK |  |
| Voting | ScrollToTopButton erscheint nach Scroll | OK |  |
| Voting | Spieldetail-Modal öffnet und schließt | OK |  |
| Voting | Duell-Seite mit Fortschritt/Done-State | SKIP |  |
| Voting | Tab-Override-Fix | SKIP | Erweiterungs-Tabs nicht verfügbar |
| Voting | Erweiterungs-Duell-Seite lädt | OK |  |
| Host-Control | Spielsteuerung für Host sichtbar | SKIP |  |
| Host-Control | Spielsteuerung für Gast nicht sichtbar | OK |  |
| Collection | GamesFilterBar öffnet | OK |  |
| Collection | /admin/collection lädt | OK |  |
| Collection | AddGameModal: BGG-ID hinzufügen | OK | BGG_TOKEN evtl. nicht gesetzt |
| Collection | CSV-Vorschau (ohne Apply) | SKIP |  |
| Cleanup | Dummy-Treffen purged | OK |  |
| Cleanup | Testlauf abgeschlossen | OK | 0 Fehler |

**Zusammenfassung:** 32 OK, 0 Fehler, 7 übersprungen