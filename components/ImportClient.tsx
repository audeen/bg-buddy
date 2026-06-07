"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importCsvAction, importCsvPreviewAction } from "@/app/actions";
import { SyncConflictDialog } from "@/components/SyncConflictDialog";
import type { FieldChoice, GameSyncConflict } from "@/lib/game-sync";
import { buildFieldResolutionsFromChoices } from "@/lib/csv-import";

type ImportResult =
  | {
      ok: true;
      total: number;
      standalone: number;
      expansions: number;
      cacheApplied: number;
    }
  | { error: string };

type ConflictMode = "csv" | "cache" | null;

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyRunning, setApplyRunning] = useState(false);
  const [importState, setImportState] = useState<ImportResult | null>(null);

  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState<{
    enriched: number;
    total: number;
  } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichDone, setEnrichDone] = useState(false);

  const [cachePreviewLoading, setCachePreviewLoading] = useState(false);
  const [cacheApplyMsg, setCacheApplyMsg] = useState<string | null>(null);
  const [cacheApplyOk, setCacheApplyOk] = useState(false);

  const [conflictMode, setConflictMode] = useState<ConflictMode>(null);
  const [conflicts, setConflicts] = useState<GameSyncConflict[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function runCsvImport(
    file: File,
    choices: Record<string, FieldChoice>,
  ) {
    setApplyRunning(true);
    setImportState(null);
    try {
      const fieldResolutions = buildFieldResolutionsFromChoices(conflicts, choices);
      const formData = new FormData();
      formData.set("file", file);
      formData.set("fieldResolutions", JSON.stringify(fieldResolutions));
      const res = (await importCsvAction(formData)) ?? { error: "Unbekannter Fehler." };
      setImportState(res as ImportResult);
      if (res && "ok" in res) {
        router.refresh();
      }
    } finally {
      setApplyRunning(false);
      setConflictMode(null);
      setConflicts([]);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCsvPreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || file.size === 0) {
      setImportState({ error: "Keine Datei ausgewählt." });
      return;
    }

    setPreviewLoading(true);
    setImportState(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const preview = await importCsvPreviewAction(formData);
      if (preview && "error" in preview) {
        setImportState({ error: preview.error ?? "Vorschau fehlgeschlagen." });
        return;
      }
      if (preview && "ok" in preview && preview.conflicts.length > 0) {
        setPendingFile(file);
        setConflicts(preview.conflicts);
        setConflictMode("csv");
        return;
      }
      await runCsvImport(file, {});
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runApplyCache(choices: Record<string, FieldChoice>) {
    setApplyRunning(true);
    setCacheApplyMsg(null);
    setCacheApplyOk(false);
    setEnrichError(null);
    try {
      const fieldResolutions = buildFieldResolutionsFromChoices(conflicts, choices);
      const res = await fetch("/api/apply-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldResolutions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCacheApplyMsg(data.error ?? "Cache konnte nicht angewendet werden.");
        return;
      }
      setCacheApplyOk(true);
      const skipped =
        data.conflictsSkipped > 0
          ? ` (${data.conflictsSkipped} manuelle Felder beibehalten)`
          : "";
      setCacheApplyMsg(
        `${data.updated} Spiele aus dem Offline-Cache aktualisiert (${data.enriched}/${data.total} angereichert)${skipped}.`,
      );
      setProgress({ enriched: data.enriched, total: data.total });
      router.refresh();
    } catch {
      setCacheApplyMsg("Netzwerkfehler beim Anwenden des Caches.");
    } finally {
      setApplyRunning(false);
      setConflictMode(null);
      setConflicts([]);
    }
  }

  async function handleApplyCacheClick() {
    setCachePreviewLoading(true);
    setCacheApplyMsg(null);
    setCacheApplyOk(false);
    try {
      const res = await fetch("/api/apply-cache?preview=1");
      const data = await res.json();
      if (!res.ok) {
        setCacheApplyMsg(data.error ?? "Cache-Vorschau fehlgeschlagen.");
        return;
      }
      if (data.conflicts?.length > 0) {
        setConflicts(data.conflicts);
        setConflictMode("cache");
        return;
      }
      await runApplyCache({});
    } catch {
      setCacheApplyMsg("Netzwerkfehler bei der Cache-Vorschau.");
    } finally {
      setCachePreviewLoading(false);
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

  const csvBusy = previewLoading || applyRunning;
  const cacheBusy = cachePreviewLoading || applyRunning;

  return (
    <div className="flex flex-col gap-6">
      {conflictMode && conflicts.length > 0 && (
        <SyncConflictDialog
          title={
            conflictMode === "csv"
              ? "Konflikte beim CSV-Import"
              : "Konflikte beim Offline-Cache"
          }
          description={
            conflictMode === "csv"
              ? "Wähle pro Feld, ob deine manuelle Änderung bleibt oder der Import-Wert übernommen wird."
              : "Wähle pro Feld, ob deine manuelle Änderung bleibt oder der Cache-Wert übernommen wird."
          }
          applyLabel={
            conflictMode === "csv" ? "Import starten" : "Cache anwenden"
          }
          conflicts={conflicts}
          pending={applyRunning}
          onApply={(choices) => {
            if (conflictMode === "csv" && pendingFile) {
              void runCsvImport(pendingFile, choices);
            } else if (conflictMode === "cache") {
              void runApplyCache(choices);
            }
          }}
          onCancel={() => {
            setConflictMode(null);
            setConflicts([]);
            setPendingFile(null);
          }}
        />
      )}

      <section className="card flex flex-col gap-3" style={{ padding: "var(--space-card)" }}>
        <h2 className="section-title">1. Collection-CSV hochladen</h2>
        <p className="text-sm text-[var(--muted)]">
          Exportiere auf BoardGameGeek unter <em>Profile → Collection → Export</em>{" "}
          deine Sammlung als CSV und lade sie hier hoch. Bestehende Spiele werden
          aktualisiert. Manuell bearbeitete Felder werden vor dem Import geprüft.
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
        <form onSubmit={handleCsvPreview} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="input min-h-[44px]"
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg sm:w-auto shrink-0"
            disabled={csvBusy}
          >
            {previewLoading ? "Prüfe…" : applyRunning && conflictMode === "csv" ? "Importiere…" : "Importieren"}
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

      <section className="card flex flex-col gap-3" style={{ padding: "var(--space-card)" }}>
        <h2 className="section-title">2. Offline-Cache anwenden</h2>
        <p className="text-sm text-[var(--muted)]">
          Wenn <code className="text-xs">bgg-enrichment.json</code> deployed ist:
          ein Klick schreibt Cover &amp; Details (deutsch) in die Datenbank (ohne BGG-Token).
          Manuell bearbeitete Felder werden vorher geprüft.
        </p>

        <button
          type="button"
          className="btn btn-primary btn-lg sm:w-fit"
          onClick={handleApplyCacheClick}
          disabled={cacheBusy || cacheEntries === 0 || total === 0}
        >
          {cachePreviewLoading
            ? "Prüfe…"
            : applyRunning && conflictMode === "cache"
              ? "Wird angewendet…"
              : "Offline-Cache jetzt anwenden"}
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

        <div className="progress-bar">
          <div
            className="progress-bar-fill bg-[var(--accent)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="card flex flex-col gap-3 border-dashed" style={{ padding: "var(--space-card)" }}>
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
            className="btn btn-ghost btn-lg sm:w-fit"
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
