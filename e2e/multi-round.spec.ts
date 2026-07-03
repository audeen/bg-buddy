import { test, expect } from "@playwright/test";
import {
  addRound,
  autoAcceptDialogs,
  createMeetup,
  loginAs,
} from "./helpers";

const HOST = "E2E-Rounds-Host";
const MEETUP_TITLE = `E2E-Mehrrunden ${Date.now()}`;

let meetupId = "";

test.describe.configure({ mode: "serial" });

test("Mehrere Spielrunden: anlegen, Umschalter, getrennte ★", async ({
  page,
}) => {
  autoAcceptDialogs(page);
  await loginAs(page, HOST);

  // Treffen mit einer (Default-)Runde anlegen.
  meetupId = await createMeetup(page, MEETUP_TITLE, 3);
  await page.goto(`/meetups/${meetupId}`);

  // Bei genau einer Runde ist keine Runden-Überschrift sichtbar.
  await expect(page.getByRole("heading", { name: /^Runde 1/ })).toHaveCount(0);

  // Zweite Runde hinzufügen (Aufwärmspiel, andere Spielerzahl).
  await addRound(page, "Aufwärmspiel", 5);

  // Jetzt zeigen sich zwei Runden-Karten mit Überschriften.
  await expect(page.getByRole("heading", { name: /^Runde 1/ })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("heading", { name: /^Runde 2/ })).toBeVisible();

  // Übersichtskarte auf der Startseite zeigt das "2 Runden"-Badge.
  await page.goto("/");
  const card = page
    .locator("article")
    .filter({ hasText: MEETUP_TITLE })
    .first();
  await expect(card.getByText("2 Runden")).toBeVisible({ timeout: 10_000 });

  // Runden-Umschalter erscheint auf der Pick-Seite.
  await page.goto(`/meetups/${meetupId}/pick`);
  const switcher = page.getByText("Spielrunde", { exact: true });
  await expect(switcher).toBeVisible({ timeout: 10_000 });

  // Beide Runden-Tabs sind als Links vorhanden.
  await expect(
    page.getByRole("link", { name: /Runde 1/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Runde 2/ }),
  ).toBeVisible();

  // Aufräumen: Treffen löschen.
  await page.goto(`/meetups/${meetupId}`);
  const menuBtn = page
    .locator("main")
    .getByRole("button", { name: "Menü", exact: true });
  await menuBtn.click();
  await page.getByRole("menuitem", { name: /Treffen löschen/ }).click();
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.getByText(MEETUP_TITLE)).toHaveCount(0);
});
