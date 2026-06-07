/**
 * Prüft data/bgg-descriptions-de.json auf Sync, fehlende Texte und Stil-Verstöße.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ENRICHMENT = join(ROOT, "data", "bgg-enrichment.json");
const DESC_DE = join(ROOT, "data", "bgg-descriptions-de.json");

const enrichment = JSON.parse(readFileSync(ENRICHMENT, "utf8"));
const descDe = JSON.parse(readFileSync(DESC_DE, "utf8"));

const HARD_PATTERNS = [
  { name: "VP-Abkürzung", re: /\bVP\b/ },
  { name: "Meta-kooperativ", re: /Meta-kooperativ/i },
  { name: "Semi-kooperativ", re: /Semi-kooperativ/i },
  { name: "Scoring", re: /\bScoring\b/i },
  { name: "Gameplay", re: /\bGameplay\b/i },
  { name: "Bad Stuff", re: /Bad Stuff/i },
  { name: "Sie beanspruchen", re: /\. Sie beanspruchen/ },
  { name: "konkurriert (Plural)", re: /Freunde konkurriert/ },
  { name: "kluges Nutzen", re: /kluges Nutzen/ },
  { name: "managt", re: /\bmanagt\b/ },
];

const SOFT_PATTERNS = [
  { name: "unpersönliches man", re: /\bman\b/i, allow: /kommt man weit|Radio Bob|manchmal|German|Romans|Human|woman|Command|Performance/ },
  { name: "Checkpoints", re: /\bCheckpoints\b/i },
  { name: "Companion (ohne Begleit)", re: /\bCompanion\b/i, allow: /Begleit-App/ },
];

let errors = 0;
let warnings = 0;

const ids = Object.keys(enrichment).sort((a, b) => Number(a) - Number(b));

for (const id of ids) {
  if (!descDe[id]) {
    console.error(`FEHLER: Keine descriptionDe für ${id}`);
    errors++;
    continue;
  }
  if (descDe[id] !== enrichment[id].descriptionDe) {
    console.error(`FEHLER: Sync-Drift bei ${id}`);
    errors++;
  }
}

for (const [id, text] of Object.entries(descDe)) {
  for (const { name, re } of HARD_PATTERNS) {
    if (re.test(text)) {
      console.error(`FEHLER [${name}] in ${id}`);
      errors++;
    }
  }
  for (const { name, re, allow } of SOFT_PATTERNS) {
    if (re.test(text) && !(allow && allow.test(text))) {
      console.warn(`WARNUNG [${name}] in ${id}`);
      warnings++;
    }
  }
}

const lowRatio = ids
  .map((id) => ({
    id,
    ratio: descDe[id].length / (enrichment[id].description?.length || 1),
    deLen: descDe[id].length,
    enLen: enrichment[id].description?.length || 0,
  }))
  .filter((r) => r.ratio < 0.5)
  .sort((a, b) => a.ratio - b.ratio);

if (lowRatio.length) {
  console.warn(`\nWARNUNG: ${lowRatio.length} Einträge mit DE/EN-Ratio < 0,5:`);
  for (const r of lowRatio) {
    console.warn(`  ${r.id}: ${r.ratio.toFixed(2)} (${r.deLen}/${r.enLen})`);
  }
}

console.log(`\nAudit: ${errors} Fehler, ${warnings} Warnungen, ${ids.length} Einträge`);
if (errors > 0) process.exit(1);
