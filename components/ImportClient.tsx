"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { importCsvAction } from "@/app/actions";

type ImportState =
  | { ok: true; total: number; standalone: number; expansions: number }
  | { error: string }
  | null;

export function ImportClient({
  total,
  enriched,
}: {
  total: number;
  enriched: number;
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
        // be gentle with the BGG API
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
          </p>
        )}
        {importState && "error" in importState && (
          <p className="text-sm text-[var(--primary)]">{importState.error}</p>
        )}
      </section>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="font-bold">2. Cover &amp; Details laden</h2>
        <p className="text-sm text-[var(--muted)]">
          Holt Beschreibung, Genre, Mechaniken und Cover-Bilder von BoardGameGeek
          nach. Läuft in kleinen Schritten – du kannst es jederzeit erneut starten.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={runEnrichment}
            disabled={enriching || total === 0}
          >
            {enriching ? "Lädt…" : "Cover & Details laden"}
          </button>
          <span className="text-sm text-[var(--muted)]">
            {shownEnriched} / {shownTotal} angereichert
          </span>
        </div>

        <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {enrichDone && (
          <p className="text-sm text-[var(--accent)]">Fertig angereichert!</p>
        )}
        {enrichError && (
          <p className="text-sm text-[var(--primary)]">{enrichError}</p>
        )}
      </section>
    </div>
  );
}
