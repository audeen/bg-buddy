import type { Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export type TestResult = {
  phase: string;
  check: string;
  status: "pass" | "fail" | "skip";
  note?: string;
};

export const results: TestResult[] = [];

export function record(
  phase: string,
  check: string,
  status: TestResult["status"],
  note?: string,
) {
  results.push({ phase, check, status, note });
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "○";
  console.log(`${icon} [${phase}] ${check}${note ? ` — ${note}` : ""}`);
}

export function writeReport() {
  const lines = [
    "# Browser-E2E-Test: Refactoring-Bericht",
    "",
    `Datum: ${new Date().toISOString()}`,
    "",
    "| Phase | Check | Status | Anmerkung |",
    "|-------|-------|--------|-----------|",
  ];

  for (const r of results) {
    const status =
      r.status === "pass" ? "OK" : r.status === "fail" ? "FEHLER" : "SKIP";
    lines.push(
      `| ${r.phase} | ${r.check} | ${status} | ${r.note ?? ""} |`,
    );
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  lines.push("");
  lines.push(`**Zusammenfassung:** ${passed} OK, ${failed} Fehler, ${skipped} übersprungen`);

  const path = join(process.cwd(), "e2e-refactor-report.md");
  writeFileSync(path, lines.join("\n"), "utf8");
  console.log(`\nBericht geschrieben: ${path}`);
}

/** Auto-accept confirm/alert dialogs for the whole session. */
export function autoAcceptDialogs(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

export async function loginAs(page: Page, name: string) {
  await page.goto("/#login");
  await page.locator("#name").fill(name);
  await page.getByRole("button", { name: "Los" }).click();
  await page.waitForURL((url) => !url.hash.includes("login"), {
    timeout: 15_000,
  });
}

const GLOBAL_FOOTER = "footer";

export async function logout(page: Page) {
  await page.evaluate(() => sessionStorage.setItem("bg-buddy:secret-menu", "1"));
  await page.reload();
  await page.locator(GLOBAL_FOOTER).getByRole("button", { name: "Menü", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Abmelden" }).click();
  await page.waitForURL((url) => url.pathname === "/" || url.hash.includes("login"), {
    timeout: 10_000,
  }).catch(() => {});
}

export async function revealSecretMenu(page: Page) {
  await page.evaluate(() => {
    sessionStorage.setItem("bg-buddy:secret-menu", "1");
  });
  await page.reload();
}

export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        !text.includes("favicon") &&
        !text.includes("404") &&
        !text.includes("prisma:error")
      ) {
        errors.push(text);
      }
    }
  });
  return errors;
}

export async function createMeetup(
  page: Page,
  title: string,
  expectedCount = 4,
): Promise<string> {
  await page.goto("/meetups/new");
  await page.locator("#title").fill(title);
  await page.locator("#expectedPlayerCount").fill(String(expectedCount));
  await page.getByRole("button", { name: "Treffen erstellen" }).click();
  await page.waitForURL(/\/meetups\/(?!new)[^/?#]+$/, { timeout: 15_000 });
  const url = page.url();
  const id = url.split("/meetups/")[1]?.split(/[?#]/)[0] ?? "";
  if (!id || id === "new") {
    throw new Error(`Meetup-Erstellung fehlgeschlagen, URL: ${url}`);
  }
  return id;
}
