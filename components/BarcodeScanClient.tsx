"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import {
  addGameByBggIdAction,
  type AddGameActionResult,
} from "@/app/actions";
import type { BarcodeLookupCandidate } from "@/lib/barcode-lookup";
import type { BggSearchCandidate } from "@/lib/bgg-search";

const DRAG_CLOSE_THRESHOLD = 100;

type LookupKind = "barcode" | "name";

type LookupResponse =
  | { status: "found"; barcode: string; bggId: number; name: string; verified: boolean }
  | { status: "candidates"; barcode: string; items: BarcodeLookupCandidate[] }
  | { status: "notFound"; barcode: string }
  | { status: "notConfigured" }
  | { status: "alreadyInCollection"; barcode: string; bggId: number; name: string }
  | { status: "error"; message: string }
  | { error: string };

type NameSearchResponse =
  | {
      status: "found";
      query: string;
      bggId: number;
      name: string;
      year: number | null;
      isExpansion: boolean;
    }
  | { status: "candidates"; query: string; items: BggSearchCandidate[] }
  | { status: "notFound"; query: string }
  | { status: "alreadyInCollection"; query: string; bggId: number; name: string }
  | { status: "error"; message: string }
  | { error: string };

type ScanLock =
  | { phase: "lookingUp"; barcode: string; kind: LookupKind }
  | {
      phase: "found";
      barcode: string;
      kind: LookupKind;
      bggId: number;
      name: string;
      thumbnailUrl?: string | null;
    }
  | { phase: "candidates"; barcode: string; kind: LookupKind; items: BarcodeLookupCandidate[] }
  | {
      phase: "alreadyInCollection";
      barcode: string;
      kind: LookupKind;
      bggId: number;
      name: string;
    }
  | { phase: "notFound"; barcode: string; kind: LookupKind }
  | { phase: "error"; barcode: string; kind: LookupKind; message: string }
  | { phase: "added"; barcode: string; kind: LookupKind; bggId: number; name: string };

function mapBggSearchCandidate(item: BggSearchCandidate): BarcodeLookupCandidate {
  return {
    bggId: item.bggId,
    name: item.name,
    thumbnailUrl: null,
    confidence: null,
    year: item.year,
    isExpansion: item.isExpansion,
  };
}

function lookupToScanLock(data: LookupResponse, barcode: string): ScanLock | null {
  const kind: LookupKind = "barcode";
  if ("error" in data) {
    return { phase: "error", barcode, kind, message: data.error };
  }

  switch (data.status) {
    case "found":
      return {
        phase: "found",
        barcode: data.barcode,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "candidates":
      return { phase: "candidates", barcode: data.barcode, kind, items: data.items };
    case "alreadyInCollection":
      return {
        phase: "alreadyInCollection",
        barcode: data.barcode,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "notFound":
      return { phase: "notFound", barcode: data.barcode, kind };
    case "notConfigured":
      return {
        phase: "error",
        barcode,
        kind,
        message:
          "Barcode-Lookup nicht konfiguriert. BGG-ID eingeben oder GAMEUPC_API_KEY setzen.",
      };
    case "error":
      return { phase: "error", barcode, kind, message: data.message };
    default:
      return null;
  }
}

function nameSearchToScanLock(data: NameSearchResponse, query: string): ScanLock | null {
  const kind: LookupKind = "name";
  if ("error" in data) {
    return { phase: "error", barcode: query, kind, message: data.error };
  }

  switch (data.status) {
    case "found":
      return {
        phase: "found",
        barcode: data.query,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "candidates":
      return {
        phase: "candidates",
        barcode: data.query,
        kind,
        items: data.items.map(mapBggSearchCandidate),
      };
    case "alreadyInCollection":
      return {
        phase: "alreadyInCollection",
        barcode: data.query,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "notFound":
      return { phase: "notFound", barcode: data.query, kind };
    case "error":
      return { phase: "error", barcode: query, kind, message: data.message };
    default:
      return null;
  }
}

export function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
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
            {pending ? "Hinzufügen …" : confirmLabel}
          </button>
        </>
      )}

      {scanLock.phase === "candidates" && (
        <>
          <p className="text-sm text-[var(--muted)]">
            Mehrere Treffer für „{scanLock.barcode}" — bitte auswählen:
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
                {pending ? "Hinzufügen …" : confirmLabel}
              </button>
            </>
          ) : (
            <p className="text-sm">
              „{scanLock.name}" ist bereits in der Sammlung.{" "}
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
          <p className="text-sm text-red-600 dark:text-red-400">{scanLock.message}</p>
        </>
      )}

      {scanLock.phase === "added" && (
        <>
          <p className="text-sm text-green-700 dark:text-green-400">
            {variant === "meetup" ? (
              <>„{scanLock.name}" wurde zum Treffen hinzugefügt.</>
            ) : (
              <>
                „{scanLock.name}" wurde hinzugefügt.{" "}
                <Link href={`/games/${scanLock.bggId}`} className="underline">
                  Zum Spiel
                </Link>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

export function AddGameModal({
  open,
  onOpenChange,
  title = "Spiel hinzufügen",
  hint = "Barcode scannen, Spielname suchen oder BGG-ID eingeben.",
  variant = "collection",
  onAdd,
  onSuccess,
}: {
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
}) {
  const addHandler = onAdd ?? addGameByBggIdAction;
  const router = useRouter();
  const modalTitleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanLockRef = useRef<ScanLock | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [scanLock, setScanLock] = useState<ScanLock | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [bggIdInput, setBggIdInput] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const applyScanLock = useCallback((lock: ScanLock | null) => {
    scanLockRef.current = lock;
    setScanLock(lock);
  }, []);

  const clearScanLock = useCallback(() => {
    applyScanLock(null);
  }, [applyScanLock]);

  const pauseCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setCameraStarting(false);
  }, []);

  const clearDragVisuals = useCallback(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.transform = "";
      panel.classList.remove("modal-panel-dragging");
    }
    if (overlay) {
      overlay.style.opacity = "";
    }
    draggingRef.current = false;
    pointerIdRef.current = null;
    dragStartYRef.current = 0;
  }, []);

  const closeModal = useCallback(() => {
    pauseCamera();
    clearDragVisuals();
    clearScanLock();
    setCameraError(null);
    onOpenChange(false);
  }, [pauseCamera, clearDragVisuals, clearScanLock, onOpenChange]);

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

  const resolveBarcodeRef = useRef(resolveBarcode);
  resolveBarcodeRef.current = resolveBarcode;

  const lockFromScan = useCallback(
    (raw: string) => {
      if (scanLockRef.current) return;
      pauseCamera();
      void resolveBarcodeRef.current(raw);
    },
    [pauseCamera],
  );

  const handleAddResult = useCallback(
    (
      res: AddGameActionResult,
      ctx: { bggId: number; barcode: string; name?: string },
    ) => {
      const { bggId, barcode, name } = ctx;
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
    [applyScanLock, onSuccess, router, variant],
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
        name,
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

  useEffect(() => {
    if (!open) {
      pauseCamera();
      clearScanLock();
      setCameraError(null);
      return;
    }

    setCameraError(null);
    clearScanLock();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera wird in diesem Browser nicht unterstützt.");
      return;
    }

    setScanning(true);
  }, [open, pauseCamera, clearScanLock]);

  useEffect(() => {
    if (!scanning || !open) return;

    let cancelled = false;
    setCameraStarting(true);
    setCameraError(null);

    async function startCamera() {
      for (let i = 0; i < 20; i += 1) {
        if (cancelled) return;
        if (videoRef.current) break;
        await new Promise((r) => requestAnimationFrame(r));
      }

      const video = videoRef.current;
      if (cancelled || !video) {
        if (!cancelled) {
          setScanning(false);
          setCameraStarting(false);
          setCameraError("Kamera-Vorschau konnte nicht gestartet werden.");
        }
        return;
      }

      const reader = new BrowserMultiFormatReader();

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (!result || cancelled || scanLockRef.current) return;
            lockFromScan(result.getText());
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraStarting(false);

        try {
          await video.play();
        } catch {
          // muted + playsInline usually sufficient on iOS
        }
      } catch {
        if (!cancelled) {
          setScanning(false);
          setCameraStarting(false);
          setCameraError("Kamera-Zugriff verweigert oder nicht verfügbar.");
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraStarting(false);
    };
  }, [scanning, open, lockFromScan]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeModal]);

  const applyDragVisuals = useCallback((delta: number) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.transform = delta > 0 ? `translateY(${delta}px)` : "";
    }
    if (overlay) {
      overlay.style.opacity =
        delta > 0 ? String(Math.max(0.35, 1 - delta / 400)) : "";
    }
  }, []);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      if (window.matchMedia("(min-width: 640px)").matches) return;

      draggingRef.current = true;
      pointerIdRef.current = e.pointerId;
      dragStartYRef.current = e.clientY;
      panelRef.current?.classList.add("modal-panel-dragging");
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = Math.max(0, e.clientY - dragStartYRef.current);
      applyDragVisuals(delta);
      if (delta > 0) e.preventDefault();
    },
    [applyDragVisuals],
  );

  const onDragPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = Math.max(0, e.clientY - dragStartYRef.current);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (delta >= DRAG_CLOSE_THRESHOLD) {
        closeModal();
      } else {
        clearDragVisuals();
      }
    },
    [closeModal, clearDragVisuals],
  );

  function continueScanning() {
    setCameraError(null);
    clearScanLock();
    setScanning(true);
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

  if (!open) return null;

  return (
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
        className="modal-panel"
        style={{ maxWidth: "28rem" }}
        tabIndex={-1}
      >
        <div
          className="modal-drag-zone"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerEnd}
          onPointerCancel={onDragPointerEnd}
        >
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
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {cameraError}
                </p>
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
                {pending ? "Hinzufügen …" : "Hinzufügen"}
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
    </div>
  );
}
