"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { addGameByBggIdAction } from "@/app/actions";
import type { BarcodeLookupCandidate } from "@/lib/barcode-lookup";

type LookupResponse =
  | { status: "found"; barcode: string; bggId: number; name: string; verified: boolean }
  | { status: "candidates"; barcode: string; items: BarcodeLookupCandidate[] }
  | { status: "notFound"; barcode: string }
  | { status: "notConfigured" }
  | { status: "alreadyInCollection"; barcode: string; bggId: number; name: string }
  | { status: "error"; message: string }
  | { error: string };

type ScanLock =
  | { phase: "lookingUp"; barcode: string }
  | {
      phase: "found";
      barcode: string;
      bggId: number;
      name: string;
      thumbnailUrl?: string | null;
    }
  | { phase: "candidates"; barcode: string; items: BarcodeLookupCandidate[] }
  | { phase: "alreadyInCollection"; barcode: string; bggId: number; name: string }
  | { phase: "notFound"; barcode: string }
  | { phase: "error"; barcode: string; message: string }
  | { phase: "added"; barcode: string; bggId: number; name: string };

function lookupToScanLock(data: LookupResponse, barcode: string): ScanLock | null {
  if ("error" in data) {
    return { phase: "error", barcode, message: data.error };
  }

  switch (data.status) {
    case "found":
      return {
        phase: "found",
        barcode: data.barcode,
        bggId: data.bggId,
        name: data.name,
      };
    case "candidates":
      return { phase: "candidates", barcode: data.barcode, items: data.items };
    case "alreadyInCollection":
      return {
        phase: "alreadyInCollection",
        barcode: data.barcode,
        bggId: data.bggId,
        name: data.name,
      };
    case "notFound":
      return { phase: "notFound", barcode: data.barcode };
    case "notConfigured":
      return {
        phase: "error",
        barcode,
        message:
          "Barcode-Lookup nicht konfiguriert. BGG-ID eingeben oder GAMEUPC_API_KEY setzen.",
      };
    case "error":
      return { phase: "error", barcode, message: data.message };
    default:
      return null;
  }
}

export function BarcodeScanClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanLockRef = useRef<ScanLock | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [scanLock, setScanLock] = useState<ScanLock | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
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

  const stopScanning = useCallback(() => {
    pauseCamera();
  }, [pauseCamera]);

  const resolveBarcode = useCallback(
    async (raw: string) => {
      const barcode = raw.trim();
      if (!barcode) return;

      applyScanLock({ phase: "lookingUp", barcode });

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
          message: "Barcode-Suche fehlgeschlagen.",
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

  const confirmAdd = useCallback(() => {
    if (scanLock?.phase !== "found") return;

    const { bggId, barcode, name } = scanLock;
    startTransition(async () => {
      const res = await addGameByBggIdAction(bggId, { barcode, name });
      if (res && "error" in res && res.error) {
        applyScanLock({ phase: "error", barcode, message: res.error });
        return;
      }
      if (res && "alreadyExists" in res && res.alreadyExists) {
        applyScanLock({
          phase: "alreadyInCollection",
          barcode,
          bggId: res.bggId ?? bggId,
          name: res.name,
        });
      } else if (res && "name" in res && res.name) {
        applyScanLock({
          phase: "added",
          barcode,
          bggId,
          name: res.name,
        });
        setBarcodeInput("");
      }
      router.refresh();
    });
  }, [scanLock, applyScanLock, router]);

  const addByBggId = useCallback(
    (bggId: number, barcode?: string | null) => {
      startTransition(async () => {
        const res = await addGameByBggIdAction(bggId, { barcode });
        if (res && "error" in res && res.error) {
          setCameraError(res.error);
          return;
        }
        if (res && "alreadyExists" in res && res.alreadyExists) {
          applyScanLock({
            phase: "alreadyInCollection",
            barcode: barcode ?? String(bggId),
            bggId: res.bggId ?? bggId,
            name: res.name,
          });
        } else if (res && "name" in res && res.name) {
          applyScanLock({
            phase: "added",
            barcode: barcode ?? String(bggId),
            bggId,
            name: res.name,
          });
          setBggIdInput("");
        }
        router.refresh();
      });
    },
    [applyScanLock, router],
  );

  useEffect(() => {
    if (!scanning) return;

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
  }, [scanning, lockFromScan]);

  function requestScanning() {
    setCameraError(null);
    clearScanLock();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera wird in diesem Browser nicht unterstützt.");
      return;
    }

    setScanning(true);
  }

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
      bggId: item.bggId,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
    });
  }

  const lockedBarcode =
    scanLock && scanLock.phase !== "lookingUp" ? scanLock.barcode : null;

  return (
    <div className="card flex flex-col gap-4" style={{ padding: "var(--space-card)" }}>
      <div>
        <h2 className="text-lg font-semibold">Spiel hinzufügen</h2>
        <p className="text-sm text-[var(--muted)]">
          Barcode scannen oder BGG-ID eingeben.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {scanLock ? (
          <button type="button" className="btn btn-primary" onClick={continueScanning}>
            Weiter scannen
          </button>
        ) : scanning ? (
          <button type="button" className="btn btn-ghost" onClick={stopScanning}>
            Kamera stoppen
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={requestScanning}>
            Kamera starten
          </button>
        )}
      </div>

      {scanning && (
        <div className="overflow-hidden rounded-lg bg-black aspect-video max-h-64 relative">
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
      )}

      {scanLock && (
        <div
          className="rounded-lg border border-[var(--border)] p-4 flex flex-col gap-3"
          role="status"
        >
          {scanLock.phase === "lookingUp" && (
            <>
              <p className="text-sm font-medium">Suche Spiel …</p>
              <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
            </>
          )}

          {scanLock.phase === "found" && (
            <>
              <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
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
                onClick={confirmAdd}
              >
                {pending ? "Hinzufügen …" : "Zur Sammlung hinzufügen"}
              </button>
            </>
          )}

          {scanLock.phase === "candidates" && (
            <>
              <p className="text-sm text-[var(--muted)]">
                Mehrere Treffer für {scanLock.barcode} — bitte auswählen:
              </p>
              <ul className="flex flex-col gap-2">
                {scanLock.items.map((item) => (
                  <li key={item.bggId}>
                    <button
                      type="button"
                      className="btn btn-ghost w-full justify-start gap-3 h-auto py-2"
                      onClick={() => selectCandidate(item)}
                    >
                      {item.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-12 w-9 object-cover rounded shrink-0"
                        />
                      )}
                      <span>{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {scanLock.phase === "alreadyInCollection" && (
            <>
              <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
              <p className="text-sm">
                „{scanLock.name}" ist bereits in der Sammlung.{" "}
                <Link href={`/games/${scanLock.bggId}`} className="underline">
                  Zum Spiel
                </Link>
              </p>
            </>
          )}

          {scanLock.phase === "notFound" && (
            <>
              <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
              <p className="text-sm">
                Kein Spiel für diesen Barcode gefunden. Bitte BGG-ID unten eingeben.
              </p>
            </>
          )}

          {scanLock.phase === "error" && (
            <>
              <p className="text-sm text-[var(--muted)] font-mono">{scanLock.barcode}</p>
              <p className="text-sm text-red-600 dark:text-red-400">{scanLock.message}</p>
            </>
          )}

          {scanLock.phase === "added" && (
            <>
              <p className="text-sm text-green-700 dark:text-green-400">
                „{scanLock.name}" wurde hinzugefügt.{" "}
                <Link href={`/games/${scanLock.bggId}`} className="underline">
                  Zum Spiel
                </Link>
              </p>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleBarcodeSearch} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="barcode-input">Barcode</label>
          <input
            id="barcode-input"
            type="text"
            inputMode="numeric"
            className="input"
            placeholder="EAN / UPC …"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            disabled={scanLock?.phase === "lookingUp"}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary sm:mb-0"
          disabled={pending || scanLock?.phase === "lookingUp"}
        >
          Suchen
        </button>
      </form>

      <div className="text-center text-sm text-[var(--muted)]">oder</div>

      <form onSubmit={handleBggAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="bgg-id-input">BGG-ID</label>
          <input
            id="bgg-id-input"
            type="number"
            min={1}
            className="input"
            placeholder="z. B. 148228"
            value={bggIdInput}
            onChange={(e) => setBggIdInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Hinzufügen …" : "Hinzufügen"}
        </button>
      </form>

      {cameraError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {cameraError}
        </p>
      )}

      {lockedBarcode && scanLock?.phase === "notFound" && (
        <p className="text-xs text-[var(--muted)]">
          Barcode {lockedBarcode} wird beim Hinzufügen gespeichert.
        </p>
      )}
    </div>
  );
}
