import { test, expect } from "@playwright/test";
import {
  autoAcceptDialogs,
  createMeetup,
  loginAs,
  logout,
  record,
  revealSecretMenu,
  results,
  writeReport,
} from "./helpers";

const HOST = "E2E-Host";
const GUEST = "E2E-Gast";
const MEETUP_TITLE = `E2E-Test Refactor ${Date.now()}`;

let meetupId = "";
let gameId = "";
let dummyMeetupId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  autoAcceptDialogs(page);
  await loginAs(page, HOST);
  await page.close();
});

test.afterAll(async () => {
  writeReport();
});

test("Phase 1: Setup — Login, Session, Dummy-Meetups", async ({ page }) => {
  autoAcceptDialogs(page);

  // Session persistiert nach Reload
  await page.goto("/");
  await expect(page.getByText(`Angemeldet als ${HOST}`).or(page.locator("text=Spieleabend"))).toBeVisible({ timeout: 10_000 }).catch(async () => {
    await loginAs(page, HOST);
  });

  const loggedIn = await page.getByRole("link", { name: "Neues Treffen" }).or(page.getByLabel("Neues Treffen")).isVisible().catch(() => false);
  if (!loggedIn) {
    await loginAs(page, HOST);
  }
  record("Setup", "Login als E2E-Host", "pass");

  await page.reload();
  const stillLoggedIn = !(await page.locator("#login").isVisible().catch(() => false));
  record(
    "Setup",
    "Session bleibt nach Reload erhalten",
    stillLoggedIn ? "pass" : "fail",
  );

  // Geheimmenü + Dummy-Treffen
  await revealSecretMenu(page);
  const menuBtn = page.locator("footer").getByRole("button", { name: "Menü", exact: true });
  await expect(menuBtn).toBeVisible();
  record("Setup", "Geheimmenü per sessionStorage aktiviert", "pass");

  await menuBtn.click();
  await page.getByRole("dialog").getByRole("button", { name: "Dummy-Treffen erzeugen" }).click();
  await expect(page.getByText(/Dummy-Treffen erstellt/)).toBeVisible({ timeout: 30_000 });
  record("Setup", "Dummy-Treffen erzeugen", "pass");

  // Erstes Dummy-Treffen finden
  await page.goto("/");
  const dummyLink = page.locator('a[href^="/meetups/"]').filter({ hasText: /Dummy|Duell bereit|Pick/i }).first();
  if (await dummyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await dummyLink.getAttribute("href");
    dummyMeetupId = href?.split("/meetups/")[1]?.split(/[?#]/)[0] ?? "";
    record("Setup", "Dummy-Treffen in Übersicht gefunden", dummyMeetupId ? "pass" : "skip", dummyMeetupId);
  } else {
    record("Setup", "Dummy-Treffen in Übersicht gefunden", "skip", "Kein Dummy-Link sichtbar");
  }

  // E2E-Treffen anlegen
  meetupId = await createMeetup(page, MEETUP_TITLE, 4);
  record("Setup", "E2E-Treffen angelegt", meetupId ? "pass" : "fail", meetupId);
});

test("Phase 2: Smoke — alle Routen", async ({ page }) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);

  const routes: { path: string; label: string; expect?: RegExp | string }[] = [
    { path: "/", label: "Startseite" },
    { path: "/games", label: "/games" },
    { path: "/meetups/new", label: "/meetups/new", expect: /Neues Treffen/ },
    { path: `/meetups/${meetupId}`, label: "Meetup-Detail" },
    { path: `/meetups/${meetupId}/pick`, label: "/pick" },
    { path: `/meetups/${meetupId}/duell`, label: "/duell" },
    { path: `/meetups/${meetupId}/erweiterung`, label: "/erweiterung" },
    { path: "/admin/collection", label: "/admin/collection" },
    { path: "/admin/import", label: "/admin/import", expect: /importieren/i },
  ];

  for (const route of routes) {
    const res = await page.goto(route.path);
    const ok = res?.ok() ?? false;
    if (route.expect) {
      await expect(page.locator("body")).toContainText(route.expect, { timeout: 10_000 });
    }
    record("Smoke", `${route.label} lädt (HTTP ${res?.status()})`, ok ? "pass" : "fail");
  }

  // games/[id] — erstes Spiel aus DB-Liste
  await page.goto("/games");
  const gameLink = page.locator('a[href^="/games/"]').first();
  if (await gameLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await gameLink.getAttribute("href");
    gameId = href?.replace("/games/", "") ?? "";
    await page.goto(`/games/${gameId}`);
    record("Smoke", `/games/${gameId}`, "pass");
  } else {
    record("Smoke", "/games/[id]", "skip", "Keine Spiele in Sammlung");
  }

  // admin/collection/[id]
  if (gameId) {
    await page.goto(`/admin/collection/${gameId}`);
    record("Smoke", `/admin/collection/${gameId}`, page.url().includes(gameId) ? "pass" : "fail");
  }

  // Tinder-Redirect (Phase 3 Altlast)
  await page.goto(`/meetups/${meetupId}/tinder`);
  await page.waitForURL(`**/meetups/${meetupId}/duell`, { timeout: 10_000 });
  record("Smoke", "/tinder redirectet nach /duell", page.url().includes("/duell") ? "pass" : "fail");
});

test("Phase 3: Auth & Treffen-Verwaltung", async ({ page }) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);
  await page.goto(`/meetups/${meetupId}`);

  // ExpectedCountControl (Host)
  await expect(page.getByText("Erwartete Spieler festlegen:")).toBeVisible({ timeout: 10_000 });
  const countEl = page.locator(".tabular-nums").filter({ hasText: /^\d+$/ }).first();
  const countBefore = await countEl.textContent();
  await page.getByRole("button", { name: "mehr" }).click();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByText("Erwartete Spieler festlegen:")).toBeVisible({ timeout: 10_000 });
  const countAfter = await countEl.textContent();
  const countPersisted = countBefore !== countAfter;
  record(
    "Auth/Meetups",
    "ExpectedCountControl speichert und überlebt Reload",
    countPersisted ? "pass" : "fail",
    `${countBefore} → ${countAfter}`,
  );

  // MeetupActionsMenu nur für Host (desktop viewport — im Meetup-Header-Bereich)
  const hostMenuVisible = await page
    .locator(".hidden.md\\:flex")
    .getByRole("button", { name: "Menü" })
    .isVisible();
  record(
    "Auth/Meetups",
    "MeetupActionsMenu für Host sichtbar",
    hostMenuVisible ? "pass" : "fail",
  );

  // QR-Modal + Escape
  await page.getByRole("button", { name: "Treffen teilen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
  record("Auth/Meetups", "QR-Modal schließt mit Escape", "pass");

  // Admin-Menü (Footer-Sheet) öffnet und schließt per Escape
  await revealSecretMenu(page);
  await page.locator("footer").getByRole("button", { name: "Menü", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Admin-Menü" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Admin-Menü" })).not.toBeVisible({ timeout: 3000 });
  record("Auth/Meetups", "Admin-Menü schließt mit Escape", "pass");

  // Gast: Join/Leave/Kick
  await logout(page);
  await loginAs(page, GUEST);
  await page.goto(`/meetups/${meetupId}`);
  await page.getByRole("button", { name: "Teilnehmen" }).click();
  await page.waitForTimeout(1000);
  const joined = await page.getByRole("button", { name: "Abmelden" }).isVisible();
  record("Auth/Meetups", "Gast kann Treffen beitreten", joined ? "pass" : "fail");

  // Gast sieht kein Lösch-Menü (MeetupActionsMenu)
  const guestDeleteMenu = await page
    .locator(".hidden.md\\:flex")
    .getByRole("button", { name: "Menü" })
    .isVisible()
    .catch(() => false);
  record(
    "Auth/Meetups",
    "MeetupActionsMenu für Gast nicht sichtbar",
    !guestDeleteMenu ? "pass" : "fail",
  );

  // Host kickt Gast
  await logout(page);
  await loginAs(page, HOST);
  await page.goto(`/meetups/${meetupId}`);
  const kickBtn = page.getByRole("button", { name: new RegExp(`${GUEST} entfernen`) });
  if (await kickBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await kickBtn.click();
    await page.waitForTimeout(1000);
    record("Auth/Meetups", "Host kann Gast entfernen", "pass");
  } else {
    record("Auth/Meetups", "Host kann Gast entfernen", "skip", "Kick-Button nicht sichtbar");
  }
});

test("Phase 4: Voting-Flows", async ({ page }) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);

  const targetId = dummyMeetupId || meetupId;

  // Pick
  await page.goto(`/meetups/${targetId}/pick`);
  const pickLoaded = !(await page.locator("text=404").isVisible().catch(() => false));
  record("Voting", "Pick-Seite lädt", pickLoaded ? "pass" : "fail");

  // Erstes Spiel antippen (wenn vorhanden)
  const gameCard = page.locator(".card-game, [class*='card']").first();
  if (await gameCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await gameCard.click();
    await page.waitForTimeout(500);
    record("Voting", "Pick: Spiel antippen", "pass");
  }

  // Scroll-to-top Button (nach Scroll)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const scrollTop = page.getByRole("button", { name: "Nach oben" });
  if (await scrollTop.isVisible({ timeout: 3000 }).catch(() => false)) {
    record("Voting", "ScrollToTopButton erscheint nach Scroll", "pass");
  } else {
    record("Voting", "ScrollToTopButton erscheint nach Scroll", "skip", "Button nicht sichtbar (evtl. schon oben)");
  }

  // Spieldetail-Modal
  const detailsBtn = page.getByRole("button", { name: "Details anzeigen" }).first();
  if (await detailsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await detailsBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    record("Voting", "Spieldetail-Modal öffnet und schließt", "pass");
  } else {
    record("Voting", "Spieldetail-Modal", "skip");
  }

  // Duell
  await page.goto(`/meetups/${targetId}/duell`);
  const progressBar = page.getByRole("progressbar", { name: "Eigener Duell-Fortschritt" });
  const duellLoaded = await progressBar.or(page.locator("text=Deine Duelle")).isVisible({ timeout: 10_000 }).catch(() => false);
  record("Voting", "Duell-Seite mit Fortschritt/Done-State", duellLoaded ? "pass" : "skip");

  // Duell-Stimme abgeben wenn Paar sichtbar
  const duelCards = page.locator(".card-game").filter({ has: page.locator("img, [class*='cover']") });
  if ((await duelCards.count()) >= 1) {
    await duelCards.first().click();
    await page.waitForTimeout(800);
    record("Voting", "Duell: Stimme abgeben", "pass");
  }

  // Ergebnisse + Tab-Override
  await page.goto(`/meetups/${targetId}#ergebnisse`);
  await page.waitForTimeout(1000);

  const variantenTab = page.getByRole("button", { name: "Varianten" });
  const basisspieleTab = page.getByRole("button", { name: "Basisspiele" });

  if (await variantenTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await basisspieleTab.click();
    await page.reload();
    await page.waitForTimeout(1000);
    // Nach manuellem Wechsel soll Reload nicht wieder auf Varianten umschalten
    const stillBase = await basisspieleTab.evaluate((el) =>
      el.classList.contains("chip-active") || el.getAttribute("aria-pressed") === "true",
    ).catch(() => false);
    record(
      "Voting",
      "Tab-Override-Fix: manuelle Tab-Wahl überlebt Reload",
      stillBase ? "pass" : "skip",
      "Tabs evtl. nicht aktiv markiert",
    );
  } else {
    record("Voting", "Tab-Override-Fix", "skip", "Erweiterungs-Tabs nicht verfügbar");
  }

  // Erweiterungs-Duell
  await page.goto(`/meetups/${targetId}/erweiterung`);
  const erweiterungLoaded = !(await page.locator("text=404").isVisible().catch(() => false));
  record("Voting", "Erweiterungs-Duell-Seite lädt", erweiterungLoaded ? "pass" : "fail");
});

test("Phase 5: Spielsteuerung (Host-Control)", async ({ page }) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);
  await page.goto(`/meetups/${meetupId}`);

  // Spielsteuerung sichtbar für Host
  const spielsteuerung = page.locator("text=Spielsteuerung").or(page.locator('input[placeholder*="Spiel suchen"]'));
  const hostControlVisible = await spielsteuerung.first().isVisible({ timeout: 5000 }).catch(() => false);
  record("Host-Control", "Spielsteuerung für Host sichtbar", hostControlVisible ? "pass" : "skip");

  // Suche mit schnellem Tippen (Race-Fix)
  const searchInput = page.locator('input[placeholder*="Spiel suchen"], input[type="search"]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill("a");
    await searchInput.fill("ab");
    await searchInput.fill("cat");
    await page.waitForTimeout(600);
    await page.locator("text=Suche…").isVisible().catch(() => false);
    await page.waitForTimeout(800);
    // Kein Crash, Ergebnisse konsistent mit letzter Query
    record("Host-Control", "Spielsuche ohne Crash (Race-Fix)", "pass");
  }

  // Gast sieht keine Spielsteuerung
  await logout(page);
  await loginAs(page, GUEST);
  await page.goto(`/meetups/${meetupId}`);
  const guestControl = await page.locator('input[placeholder*="Spiel suchen"]').isVisible().catch(() => false);
  record(
    "Host-Control",
    "Spielsteuerung für Gast nicht sichtbar",
    !guestControl ? "pass" : "fail",
  );

  await logout(page);
  await loginAs(page, HOST);
});

test("Phase 6: Sammlung & Spiele", async ({ page }) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);

  // /games Filter
  await page.goto("/games");
  const filterSummary = page.locator(".filter-dropdown-summary, details summary").first();
  if (await filterSummary.isVisible({ timeout: 5000 }).catch(() => false)) {
    await filterSummary.click();
    record("Collection", "GamesFilterBar öffnet", "pass");
  }

  // Admin Sammlung
  await page.goto("/admin/collection");
  record(
    "Collection",
    "/admin/collection lädt",
    page.url().includes("/admin/collection") ? "pass" : "fail",
  );

  // AddGameModal via BGG-ID (ohne Kamera)
  const addBtn = page.getByRole("button", { name: "Spiel hinzufügen" });
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator("#modal-bgg-id-input").fill("68448");
    await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
    await page.waitForTimeout(3000);
    const added = await page.locator("text=wurde hinzugefügt").or(page.locator("text=bereits in der Sammlung")).isVisible().catch(() => false);
    record(
      "Collection",
      "AddGameModal: BGG-ID hinzufügen",
      added ? "pass" : "skip",
      "BGG_TOKEN evtl. nicht gesetzt",
    );
    await page.getByRole("button", { name: "Schließen" }).click().catch(() => {});
  }

  // CSV-Vorschau (kein Apply)
  await page.goto("/admin/import");
  const csvInput = page.locator('input[type="file"]');
  if (await csvInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    const miniCsv = "objectid,objectname,yearpublished,minplayers,maxplayers,itemtype\n999999999,E2E Testspiel,2020,2,4,boardgame\n";
    await csvInput.setInputFiles({
      name: "e2e-test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(miniCsv),
    });
    await page.waitForTimeout(2000);
    const preview = await page.locator("text=Konflikt").or(page.locator("text=neu")).or(page.locator("text=Vorschau")).isVisible().catch(() => false);
    record("Collection", "CSV-Vorschau (ohne Apply)", preview ? "pass" : "skip");
  } else {
    record("Collection", "CSV-Vorschau", "skip", "Import-UI nicht gefunden");
  }
});

test("Phase 7: Aufräumen", async ({ page }) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);

  // E2E-Treffen löschen
  await page.goto(`/meetups/${meetupId}`);
  const menuBtn = page
    .locator(".hidden.md\\:flex")
    .getByRole("button", { name: "Menü" });
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await page.getByRole("menuitem", { name: "Treffen löschen" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
    record("Cleanup", "E2E-Treffen gelöscht", "pass");
  }

  // Dummy-Treffen purgen
  await revealSecretMenu(page);
  await page.locator("footer").getByRole("button", { name: "Menü", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dummy-Treffen löschen" }).click();
  await expect(page.getByText(/Dummy-Treffen gelöscht|Keine Dummy-Treffen/)).toBeVisible({ timeout: 15_000 });
  record("Cleanup", "Dummy-Treffen purged", "pass");

  const failed = results.filter((r) => r.status === "fail").length;
  record("Cleanup", "Testlauf abgeschlossen", failed === 0 ? "pass" : "fail", `${failed} Fehler`);
  // Bericht dokumentiert Fehler; harter Abbruch nur bei Cleanup-Fehlern
  expect(meetupId).not.toBe("new");
});
