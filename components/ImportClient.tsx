"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importCsvAction, importCsvPreviewAction } from "@/app/actions";
import { SyncConflictDialog } from "@/components/SyncConflictDialog";
import {
  buildFieldResolutionsFromChoices,
  type FieldChoice,
  type GameSyncConflict,
} from "@/lib/game-sync";

type ImportResult =
  | {
      ok: true;
      total: number;
      standalone: number;
      expansions: number;
    }
  | { error: string };

export function ImportClient({
  total,
  enriched,
}: {
  total: number;
  enriched: number;
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
        return;
      }
      await runCsvImport(file, {});
    } finally {
      setPreviewLoading(false);
    }
  }

  // Bricht eine laufende Anreicherung sauber ab (Button oder Unmount).
  const enrichAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => enrichAbortRef.current?.abort();
  }, []);

  function cancelEnrichment() {
    enrichAbortRef.current?.abort();
  }

  async function runEnrichment() {
    const controller = new AbortController();
    enrichAbortRef.current = controller;
    setEnriching(true);
    setEnrichError(null);
    setEnrichDone(false);
    try {
      for (let i = 0; i < 200; i++) {
        if (controller.signal.aborted) break;
        const res = await fetch("/api/enrich", {
          method: "POST",
          signal: controller.signal,
        });
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
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setEnrichError("Netzwerkfehler beim Anreichern.");
      }
    } finally {
      enrichAbortRef.current = null;
      setEnriching(false);
      router.refresh();
    }
  }

  const shownEnriched = progress?.enriched ?? enriched;
  const shownTotal = progress?.total ?? total;
  const pct = shownTotal > 0 ? Math.round((shownEnriched / shownTotal) * 100) : 0;

  const csvBusy = previewLoading || applyRunning;

  return (
    <div className="flex flex-col gap-6">
      {conflicts.length > 0 && (
        <SyncConflictDialog
          title="Konflikte beim CSV-Import"
          description="Wähle pro Feld, ob deine manuelle Änderung bleibt oder der Import-Wert übernommen wird."
          applyLabel="Import starten"
          conflicts={conflicts}
          pending={applyRunning}
          onApply={(choices) => {
            if (pendingFile) {
              void runCsvImport(pendingFile, choices);
            }
          }}
          onCancel={() => {
            setConflicts([]);
            setPendingFile(null);
          }}
        />
      )}

      <section className="card card-pad flex flex-col gap-3">
        <h2 className="section-title">1. Sammlungs-CSV hochladen</h2>
        <p className="text-sm text-[var(--muted)]">
          Exportiere auf BoardGameGeek unter <em>Profile → Collection → Export</em>{" "}
          deine Sammlung als CSV und lade sie hier hoch. Bestehende Spiele werden
          aktualisiert. Manuell bearbeitete Felder werden vor dem Import geprüft.
        </p>
        <form onSubmit={handleCsvPreview} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="input min-h-[2.75rem]"
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg sm:w-auto shrink-0"
            disabled={csvBusy}
          >
            {previewLoading ? "Prüfe…" : applyRunning ? "Importiere…" : "Importieren"}
          </button>
        </form>
        {importState && "ok" in importState && (
          <p className="text-sm text-[var(--accent)]" role="status">
            {importState.total} Einträge importiert ({importState.standalone}{" "}
            Spiele, {importState.expansions} Erweiterungen).
          </p>
        )}
        {importState && "error" in importState && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {importState.error}
          </p>
        )}
      </section>

      <section className="card card-pad flex flex-col gap-3">
        <h2 className="section-title">2. Cover &amp; Details von BGG laden</h2>
        <p className="text-sm text-[var(--muted)]">
          Lädt Beschreibung, Cover, Kategorien und Mechaniken über die offizielle
          BGG-XML-API (benötigt <code className="text-xs">BGG_TOKEN</code> auf dem
          Server). Die Anfragen werden automatisch gedrosselt.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary btn-lg sm:w-fit"
            onClick={runEnrichment}
            disabled={enriching || total === 0}
            aria-busy={enriching}
          >
            {enriching ? "Lade…" : "Von BGG laden"}
          </button>
          {enriching && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelEnrichment}
            >
              Abbrechen
            </button>
          )}
        </div>

        {total === 0 && (
          <p className="text-sm text-[var(--primary)]">
            Zuerst Schritt 1: CSV importieren, dann diesen Button.
          </p>
        )}
        {enrichDone && (
          <p className="text-sm text-[var(--accent)]" role="status">
            Anreicherung fertig.
          </p>
        )}
        {enrichError && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {enrichError}
          </p>
        )}

        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          <span>
            {shownEnriched} / {shownTotal} in der DB angereichert
          </span>
        </div>

        <div className="progress-bar">
          <div
            className="progress-bar-fill bg-[var(--accent)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>
    </div>
  );
}
