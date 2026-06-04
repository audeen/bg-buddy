"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { importCsvAction } from "@/app/actions";

type ImportState =
  | {
      ok: true;
      total: number;
      standalone: number;
      expansions: number;
      cacheApplied: number;
    }
  | { error: string }
  | null;

export function ImportClient({
  total,
  enriched,
  cacheEntries,
}: {
  total: number;
  enriched: number;
  cacheEntries: number;
}) {
  const router = useRouter();

  const [importState, importFormAction, importing] = useActionState<
    ImportState,
    FormData
  >(async (_prev, formData) => {
    const res = (await importCsvAction(formData)) ?? null;
    router.refresh();
    return res as ImportState;
  }, null);

  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState<{
    enriched: number;
    total: number;
  } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichDone, setEnrichDone] = useState(false);
  const [applyingCache, setApplyingCache] = useState(false);
  const [cacheApplyMsg, setCacheApplyMsg] = useState<string | null>(null);
  const [cacheApplyOk, setCacheApplyOk] = useState(false);

  async function runApplyCache() {
    setApplyingCache(true);
    setCacheApplyMsg(null);
    setCacheApplyOk(false);
    setEnrichError(null);
    try {
      const res = await fetch("/api/apply-cache", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCacheApplyMsg(data.error ?? "Cache konnte nicht angewendet werden.");
        return;
      }
      setCacheApplyOk(true);
      setCacheApplyMsg(
        `${data.updated} Spiele aus dem Offline-Cache aktualisiert (${data.enriched}/${data.total} angereichert).`,
      );
      setProgress({ enriched: data.enriched, total: data.total });
    } catch {
      setCacheApplyMsg("Netzwerkfehler beim Anwenden des Caches.");
    } finally {
      setApplyingCache(false);
      router.refresh();
    }
  }

  async function runEnrichment() {
    setEnriching(true);
    setEnrichError(null);
    setEnrichDone(false);
    try {
      for (let i = 0; i < 200; i++) {
        const res = await fetch("/api/enrich", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setEnrichError(data.error ?? "Fehler beim Anreichern.");
          break;
        }
        setProgress({ enriched: data.enriched, total: data.total });
        if (data.done || data.processed === 0) {
          setEnrichDone(true);
          break;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch {
      setEnrichError("Netzwerkfehler beim Anreichern.");
    } finally {
      setEnriching(false);
      router.refresh();
    }
  }

  const shownEnriched = progress?.enriched ?? enriched;
  const shownTotal = progress?.total ?? total;
  const pct = shownTotal > 0 ? Math.round((shownEnriched / shownTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-bold">1. Collection-CSV hochladen</h2>
        <p className="text-sm text-[var(--muted)]">
          Exportiere auf BoardGameGeek unter <em>Profile → Collection → Export</em>{" "}
          deine Sammlung als CSV und lade sie hier hoch. Bestehende Spiele werden
          aktualisiert.
        </p>
        {cacheEntries > 0 ? (
          <p className="text-sm text-[var(--accent)]">
            <code className="text-xs">data/bgg-enrichment.json</code> enthält{" "}
            {cacheEntries} Einträge — beim Import werden Cover &amp; Details daraus
            übernommen (Anzeige auf Deutsch, Englisch bleibt in der Datei; kein API-Token nötig).
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Noch keine Anreicherungs-Datei: siehe Schritt 2 oder{" "}
            <code className="text-xs">docs/browser-prefetch-bgg.md</code>.
          </p>
        )}
        <form action={importFormAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="input"
          />
          <button type="submit" className="btn btn-primary" disabled={importing}>
            {importing ? "Importiere…" : "Importieren"}
          </button>
        </form>
        {importState && "ok" in importState && (
          <p className="text-sm text-[var(--accent)]">
            {importState.total} Einträge importiert ({importState.standalone}{" "}
            Spiele, {importState.expansions} Erweiterungen).
            {importState.cacheApplied > 0 &&
              ` ${importState.cacheApplied} mit Daten aus dem Offline-Cache angereichert.`}
          </p>
        )}
        {importState && "error" in importState && (
          <p className="text-sm text-[var(--primary)]">{importState.error}</p>
        )}
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-bold">2. Offline-Cache anwenden</h2>
        <p className="text-sm text-[var(--muted)]">
          Wenn <code className="text-xs">bgg-enrichment.json</code> deployed ist:
          ein Klick schreibt Cover &amp; Details (deutsch) in die Datenbank (ohne BGG-Token).
          Vorher CSV importieren (Schritt 1), falls die Sammlung leer ist.
        </p>

        <button
          type="button"
          className="btn btn-primary w-fit"
          onClick={runApplyCache}
          disabled={applyingCache || cacheEntries === 0 || total === 0}
        >
          {applyingCache ? "Wird angewendet…" : "Offline-Cache jetzt anwenden"}
        </button>

        {cacheEntries === 0 && (
          <p className="text-sm text-[var(--primary)]">
            Auf dem Server wurde keine Cache-Datei gefunden — neu deployen oder{" "}
            <code className="text-xs">docs/browser-prefetch-bgg.md</code>.
          </p>
        )}
        {total === 0 && cacheEntries > 0 && (
          <p className="text-sm text-[var(--primary)]">
            Zuerst Schritt 1: CSV importieren, dann diesen Button.
          </p>
        )}
        {cacheApplyMsg && (
          <p
            className={`text-sm ${cacheApplyOk ? "text-[var(--accent)]" : "text-[var(--primary)]"}`}
          >
            {cacheApplyMsg}
          </p>
        )}

        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <span>
            {shownEnriched} / {shownTotal} in der DB angereichert
            {cacheEntries > 0 ? ` · ${cacheEntries} Cache-Einträge` : ""}
          </span>
        </div>

        <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="card p-5 flex flex-col gap-3 border border-dashed border-[var(--surface-2)]">
        <h2 className="font-bold text-sm">Optional: BGG-XML-API (mit Token)</h2>
        <p className="text-sm text-[var(--muted)]">
          Wenn deine Application freigegeben ist: <code className="text-xs">BGG_TOKEN</code>{" "}
          setzen und unten klicken oder{" "}
          <code className="text-xs">npm run prefetch-bgg</code> /{" "}
          <code className="text-xs">npm run enrich</code>.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runEnrichment}
            disabled={enriching || total === 0}
          >
            {enriching ? "Lädt…" : "Live von BGG laden"}
          </button>
        </div>

        {enrichDone && (
          <p className="text-sm text-[var(--accent)]">Live-Anreicherung fertig.</p>
        )}
        {enrichError && (
          <p className="text-sm text-[var(--primary)]">{enrichError}</p>
        )}
      </section>
    </div>
  );
}
