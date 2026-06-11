"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { addGameByBggIdAction, type AddGameActionResult } from "@/app/actions";
import type { BarcodeLookupCandidate } from "@/lib/barcode-lookup";
import {
  lookupToScanLock,
  nameSearchToScanLock,
  type LookupResponse,
  type NameSearchResponse,
  type ScanLock,
} from "@/lib/scan-lock";
import { useBarcodeScanner } from "@/lib/use-barcode-scanner";
import { useDragToDismiss } from "@/lib/use-drag-dismiss";
import { useEscapeKey } from "@/lib/use-escape-key";

type AddGameModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  hint?: string;
  variant?: "collection" | "meetup";
  onAdd?: (
    bggId: number,
    options?: { barcode?: string | null; name?: string | null },
  ) => Promise<AddGameActionResult>;
  onSuccess?: () => void;
};

export function AddGameModal(props: AddGameModalProps) {
  // Erst beim Öffnen mounten — so startet jeder Öffnen-Vorgang mit frischem State.
  if (!props.open) return null;
  return <AddGameModalContent {...props} />;
}

function AddGameModalContent({
  onOpenChange,
  title = "Spiel hinzufügen",
  hint = "Barcode scannen, Spielname suchen oder BGG-ID eingeben.",
  variant = "collection",
  onAdd,
  onSuccess,
}: AddGameModalProps) {
  const addHandler = onAdd ?? addGameByBggIdAction;
  const router = useRouter();
  const modalTitleId = useId();
  const scanLockRef = useRef<ScanLock | null>(null);

  const [scanLock, setScanLock] = useState<ScanLock | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [bggIdInput, setBggIdInput] = useState("");
  const [pending, startTransition] = useTransition();

  const applyScanLock = useCallback((lock: ScanLock | null) => {
    scanLockRef.current = lock;
    setScanLock(lock);
  }, []);

  const clearScanLock = useCallback(() => {
    applyScanLock(null);
  }, [applyScanLock]);

  const resolveBarcode = useCallback(
    async (raw: string) => {
      const barcode = raw.trim();
      if (!barcode) return;

      applyScanLock({ phase: "lookingUp", barcode, kind: "barcode" });

      try {
        const res = await fetch("/api/barcode/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: raw }),
        });
        const data = (await res.json()) as LookupResponse;
        const lock = lookupToScanLock(data, barcode);
        if (lock) {
          applyScanLock(lock);
        }
      } catch {
        applyScanLock({
          phase: "error",
          barcode,
          kind: "barcode",
          message: "Barcode-Suche fehlgeschlagen.",
        });
      }
    },
    [applyScanLock],
  );

  const resolveName = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query) return;

      applyScanLock({ phase: "lookingUp", barcode: query, kind: "name" });

      try {
        const res = await fetch("/api/bgg/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = (await res.json()) as NameSearchResponse;
        const lock = nameSearchToScanLock(data, query);
        if (lock) {
          applyScanLock(lock);
        }
      } catch {
        applyScanLock({
          phase: "error",
          barcode: query,
          kind: "name",
          message: "BGG-Namensuche fehlgeschlagen.",
        });
      }
    },
    [applyScanLock],
  );

  const handleScan = useCallback(
    (raw: string): boolean => {
      if (scanLockRef.current) return false;
      void resolveBarcode(raw);
      return true;
    },
    [resolveBarcode],
  );

  const {
    videoRef,
    cameraStarting,
    cameraError,
    setCameraError,
    pauseCamera,
    resumeScanning,
  } = useBarcodeScanner(handleScan);

  const closeModal = useCallback(() => {
    pauseCamera();
    onOpenChange(false);
  }, [pauseCamera, onOpenChange]);

  useEscapeKey(closeModal);

  const { overlayRef, panelRef, dragZoneHandlers } =
    useDragToDismiss(closeModal);

  const handleAddResult = useCallback(
    (res: AddGameActionResult, ctx: { bggId: number; barcode: string }) => {
      const { bggId, barcode } = ctx;
      if ("error" in res) {
        if (scanLockRef.current) {
          applyScanLock({
            phase: "error",
            barcode,
            kind: scanLockRef.current.kind,
            message: res.error,
          });
        } else {
          setCameraError(res.error);
        }
        return;
      }
      if (res.alreadyExists && variant === "collection") {
        applyScanLock({
          phase: "alreadyInCollection",
          barcode,
          kind: scanLockRef.current?.kind ?? "barcode",
          bggId: res.bggId ?? bggId,
          name: res.name,
        });
        return;
      }
      if (res.name) {
        applyScanLock({
          phase: "added",
          barcode,
          kind: scanLockRef.current?.kind ?? "barcode",
          bggId: res.bggId ?? bggId,
          name: res.name,
        });
        setBarcodeInput("");
        setNameInput("");
        setBggIdInput("");
      }
      onSuccess?.();
      router.refresh();
    },
    [applyScanLock, setCameraError, onSuccess, router, variant],
  );

  const confirmAdd = useCallback(() => {
    if (
      scanLock?.phase !== "found" &&
      !(variant === "meetup" && scanLock?.phase === "alreadyInCollection")
    ) {
      return;
    }

    const { bggId } = scanLock;
    const barcode = scanLock.kind === "barcode" ? scanLock.barcode : null;
    const name = scanLock.phase === "found" ? scanLock.name : undefined;
    startTransition(async () => {
      const res = await addHandler(bggId, { barcode, name });
      handleAddResult(res, {
        bggId,
        barcode: barcode ?? scanLock.barcode,
      });
    });
  }, [scanLock, addHandler, handleAddResult, variant]);

  const addByBggId = useCallback(
    (bggId: number, barcode?: string | null) => {
      startTransition(async () => {
        const res = await addHandler(bggId, { barcode });
        handleAddResult(res, {
          bggId,
          barcode: barcode ?? String(bggId),
        });
      });
    },
    [addHandler, handleAddResult],
  );

  function continueScanning() {
    clearScanLock();
    resumeScanning();
  }

  function handleBarcodeSearch(e: React.FormEvent) {
    e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;
    pauseCamera();
    void resolveBarcode(raw);
  }

  function handleNameSearch(e: React.FormEvent) {
    e.preventDefault();
    const raw = nameInput.trim();
    if (!raw) return;
    pauseCamera();
    void resolveName(raw);
  }

  function handleBggAdd(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(bggIdInput.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      setCameraError("Ungültige BGG-ID.");
      return;
    }
    const barcode =
      scanLock?.phase === "notFound" || scanLock?.phase === "error"
        ? scanLock.barcode
        : null;
    addByBggId(id, barcode);
  }

  function selectCandidate(item: BarcodeLookupCandidate) {
    if (scanLock?.phase !== "candidates") return;
    applyScanLock({
      phase: "found",
      barcode: scanLock.barcode,
      kind: scanLock.kind,
      bggId: item.bggId,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
    });
  }

  const lockedBarcode =
    scanLock && scanLock.phase !== "lookingUp" ? scanLock.barcode : null;

  // Portal nach document.body, damit transform-/animation-Vorfahren das
  // fixed-Overlay nicht einfangen (Containing Block & Stacking Context).
  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        className="modal-panel max-w-md"
        tabIndex={-1}
      >
        <div className="modal-drag-zone" {...dragZoneHandlers}>
          <div className="modal-handle" aria-hidden />
          <h2 id={modalTitleId} className="text-sm font-semibold text-[var(--muted)]">
            {title}
          </h2>
        </div>

        <div className="modal-body flex flex-col gap-3 safe-bottom max-h-[min(85vh,40rem)] overflow-y-auto">
          <p className="text-sm text-[var(--muted)]">{hint}</p>

          {!scanLock && (
            <>
              {cameraError ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-[var(--danger)]" role="alert">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={resumeScanning}
                  >
                    Kamera erneut versuchen
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg bg-black aspect-video w-full relative">
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      autoPlay
                    />
                    {cameraStarting && (
                      <p className="absolute inset-0 flex items-center justify-center text-sm text-white bg-black/50">
                        Kamera wird gestartet …
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-center text-[var(--muted)]">
                    Barcode vor die Kamera halten
                  </p>
                </>
              )}
            </>
          )}

          <form onSubmit={handleBarcodeSearch}>
            <div className="flex gap-2 items-center">
              <label className="sr-only" htmlFor="modal-barcode-input">
                Barcode
              </label>
              <input
                id="modal-barcode-input"
                type="text"
                inputMode="numeric"
                className="input flex-1 min-w-0"
                placeholder="EAN / UPC …"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                disabled={scanLock?.phase === "lookingUp"}
              />
              <button
                type="submit"
                className="btn btn-primary shrink-0"
                disabled={pending || scanLock?.phase === "lookingUp"}
              >
                Suchen
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-[var(--muted)]">oder</p>

          <form onSubmit={handleNameSearch}>
            <div className="flex gap-2 items-center">
              <label className="sr-only" htmlFor="modal-name-input">
                Spielname
              </label>
              <input
                id="modal-name-input"
                type="search"
                className="input flex-1 min-w-0"
                placeholder="Spielname, z. B. Splendor"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={scanLock?.phase === "lookingUp"}
              />
              <button
                type="submit"
                className="btn btn-primary shrink-0"
                disabled={pending || scanLock?.phase === "lookingUp"}
              >
                Suchen
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-[var(--muted)]">oder</p>

          <form onSubmit={handleBggAdd}>
            <div className="flex gap-2 items-center">
              <label className="sr-only" htmlFor="modal-bgg-id-input">
                BGG-ID
              </label>
              <input
                id="modal-bgg-id-input"
                type="number"
                min={1}
                className="input flex-1 min-w-0"
                placeholder="BGG-ID, z. B. 148228"
                value={bggIdInput}
                onChange={(e) => setBggIdInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary shrink-0" disabled={pending}>
                {pending ? "Füge hinzu…" : "Hinzufügen"}
              </button>
            </div>
          </form>

          {scanLock && (
            <ScanLockPanel
              scanLock={scanLock}
              pending={pending}
              onConfirmAdd={confirmAdd}
              onSelectCandidate={selectCandidate}
              variant={variant}
            />
          )}

          {lockedBarcode &&
            scanLock?.phase === "notFound" &&
            scanLock.kind === "barcode" && (
            <p className="text-xs text-[var(--muted)]">
              Barcode {lockedBarcode} wird beim Hinzufügen gespeichert.
            </p>
          )}

          <div className="flex flex-col gap-2 w-full pt-1">
            {scanLock && (
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={continueScanning}
              >
                Weiter scannen
              </button>
            )}
            <button type="button" className="btn btn-ghost w-full" onClick={closeModal}>
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScanLockPanel({
  scanLock,
  pending,
  onConfirmAdd,
  onSelectCandidate,
  variant = "collection",
}: {
  scanLock: ScanLock;
  pending: boolean;
  onConfirmAdd: () => void;
  onSelectCandidate: (item: BarcodeLookupCandidate) => void;
  variant?: "collection" | "meetup";
}) {
  const confirmLabel =
    variant === "meetup" ? "Zum Treffen hinzufügen" : "Zur Sammlung hinzufügen";
  const isNameSearch = scanLock.kind === "name";
  return (
    <div
      className="rounded-lg border border-[var(--border)] p-4 flex flex-col gap-3"
      role="status"
    >
      {scanLock.phase === "lookingUp" && (
        <>
          <p className="text-sm font-medium">
            {isNameSearch ? "Suche auf BGG …" : "Suche Spiel …"}
          </p>
          <p className="text-sm text-[var(--muted)]">{scanLock.barcode}</p>
        </>
      )}

      {scanLock.phase === "found" && (
        <>
          {!isNameSearch && (
            <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
          )}
          <div className="flex items-center gap-3">
            {scanLock.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scanLock.thumbnailUrl}
                alt=""
                className="h-16 w-12 object-cover rounded shrink-0"
              />
            )}
            <p className="font-semibold">{scanLock.name}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary w-fit"
            disabled={pending}
            onClick={onConfirmAdd}
          >
            {pending ? "Füge hinzu…" : confirmLabel}
          </button>
        </>
      )}

      {scanLock.phase === "candidates" && (
        <>
          <p className="text-sm text-[var(--muted)]">
            Mehrere Treffer für &bdquo;{scanLock.barcode}&ldquo; — bitte auswählen:
          </p>
          <ul className="flex flex-col gap-2">
            {scanLock.items.map((item) => (
              <li key={item.bggId}>
                <button
                  type="button"
                  className="btn btn-ghost w-full justify-start gap-3 h-auto py-2"
                  onClick={() => onSelectCandidate(item)}
                >
                  {item.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-12 w-9 object-cover rounded shrink-0"
                    />
                  )}
                  <span>
                    {item.name}
                    {item.year ? ` (${item.year})` : ""}
                    {item.isExpansion ? " · Erweiterung" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {scanLock.phase === "alreadyInCollection" && (
        <>
          {!isNameSearch && (
            <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
          )}
          {variant === "meetup" ? (
            <>
              <p className="text-sm font-semibold">{scanLock.name}</p>
              <p className="text-sm text-[var(--muted)]">
                Spiel ist in der Sammlung — trotzdem zum Treffen hinzufügen?
              </p>
              <button
                type="button"
                className="btn btn-primary w-fit"
                disabled={pending}
                onClick={onConfirmAdd}
              >
                {pending ? "Füge hinzu…" : confirmLabel}
              </button>
            </>
          ) : (
            <p className="text-sm">
              &bdquo;{scanLock.name}&ldquo; ist bereits in der Sammlung.{" "}
              <Link href={`/games/${scanLock.bggId}`} className="underline">
                Zum Spiel
              </Link>
            </p>
          )}
        </>
      )}

      {scanLock.phase === "notFound" && (
        <>
          {!isNameSearch && (
            <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
          )}
          <p className="text-sm">
            {isNameSearch
              ? "Kein Spiel auf BGG gefunden. Bitte BGG-ID unten eingeben."
              : "Kein Spiel für diesen Barcode gefunden. Bitte BGG-ID unten eingeben."}
          </p>
        </>
      )}

      {scanLock.phase === "error" && (
        <>
          <p className="text-sm text-[var(--muted)]">{scanLock.barcode}</p>
          <p className="text-sm text-[var(--danger)]" role="alert">{scanLock.message}</p>
        </>
      )}

      {scanLock.phase === "added" && (
        <p className="text-sm text-[var(--accent)]">
          {variant === "meetup" ? (
            <>&bdquo;{scanLock.name}&ldquo; wurde zum Treffen hinzugefügt.</>
          ) : (
            <>
              &bdquo;{scanLock.name}&ldquo; wurde hinzugefügt.{" "}
              <Link href={`/games/${scanLock.bggId}`} className="underline">
                Zum Spiel
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
