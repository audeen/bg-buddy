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

export function BarcodeScanClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bggIdInput, setBggIdInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [candidates, setCandidates] = useState<BarcodeLookupCandidate[] | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setCameraStarting(false);
  }, []);

  const lookupBarcode = useCallback(async (raw: string) => {
    setLookupLoading(true);
    setError(null);
    setMessage(null);
    setCandidates(null);
    setPendingBarcode(null);

    try {
      const res = await fetch("/api/barcode/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: raw }),
      });
      const data = (await res.json()) as LookupResponse;

      if ("error" in data) {
        setError(data.error);
        return;
      }

      if (data.status === "notConfigured") {
        setError(
          "Barcode-Lookup nicht konfiguriert. BGG-ID eingeben oder GAMEUPC_API_KEY setzen.",
        );
        return;
      }

      if (data.status === "error") {
        setError(data.message);
        return;
      }

      if (data.status === "alreadyInCollection") {
        setMessage(`„${data.name}" ist bereits in der Sammlung.`);
        return;
      }

      if (data.status === "found") {
        return { action: "add" as const, bggId: data.bggId, barcode: data.barcode, name: data.name };
      }

      if (data.status === "candidates") {
        setPendingBarcode(data.barcode);
        setCandidates(data.items);
        return;
      }

      setError(
        `Kein Spiel für Barcode ${data.barcode} gefunden. Bitte BGG-ID eingeben.`,
      );
    } catch {
      setError("Barcode-Suche fehlgeschlagen.");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const lookupBarcodeRef = useRef(lookupBarcode);
  lookupBarcodeRef.current = lookupBarcode;

  const addGame = useCallback(
    (bggId: number, barcode?: string | null, name?: string | null) => {
      startTransition(async () => {
        setError(null);
        setMessage(null);
        const res = await addGameByBggIdAction(bggId, { barcode, name });
        if (res && "error" in res && res.error) {
          setError(res.error);
          return;
        }
        if (res && "alreadyExists" in res && res.alreadyExists) {
          setMessage(`„${res.name}" ist bereits in der Sammlung.`);
        } else if (res && "name" in res && res.name) {
          setMessage(`„${res.name}" wurde hinzugefügt.`);
          setCandidates(null);
          setBarcodeInput("");
          stopScanning();
        }
        router.refresh();
      });
    },
    [router, stopScanning],
  );

  const addGameRef = useRef(addGame);
  addGameRef.current = addGame;

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    setCameraStarting(true);

    async function startCamera() {
      // Wait until React has mounted the <video> element (fixes blank preview on mobile).
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
          setError("Kamera-Vorschau konnte nicht gestartet werden.");
        }
        return;
      }

      const reader = new BrowserMultiFormatReader();

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (!result || cancelled) return;
            const code = result.getText();
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.code === code && now - last.at < 2500) {
              return;
            }
            lastScanRef.current = { code, at: now };

            void lookupBarcodeRef.current(code).then((out) => {
              if (out?.action === "add") {
                addGameRef.current(out.bggId, out.barcode, out.name);
              }
            });
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraStarting(false);

        // iOS requires an explicit play() after the stream is attached.
        try {
          await video.play();
        } catch {
          // Autoplay may still work via muted + playsInline.
        }
      } catch {
        if (!cancelled) {
          setScanning(false);
          setCameraStarting(false);
          setError("Kamera-Zugriff verweigert oder nicht verfügbar.");
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
  }, [scanning]);

  function requestScanning() {
    setError(null);
    setMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera wird in diesem Browser nicht unterstützt.");
      return;
    }

    setScanning(true);
  }

  function handleBarcodeSearch(e: React.FormEvent) {
    e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;
    void lookupBarcode(raw).then((out) => {
      if (out?.action === "add") {
        addGame(out.bggId, out.barcode, out.name);
      }
    });
  }

  function handleBggAdd(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(bggIdInput.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Ungültige BGG-ID.");
      return;
    }
    addGame(id, pendingBarcode);
  }

  return (
    <div className="card flex flex-col gap-4" style={{ padding: "var(--space-card)" }}>
      <div>
        <h2 className="text-lg font-semibold">Spiel hinzufügen</h2>
        <p className="text-sm text-[var(--muted)]">
          Barcode scannen oder BGG-ID eingeben.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {scanning ? (
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
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary sm:mb-0"
          disabled={lookupLoading || pending}
        >
          {lookupLoading ? "Suche …" : "Suchen"}
        </button>
      </form>

      {candidates && candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--muted)]">Mehrere Treffer — bitte auswählen:</p>
          <ul className="flex flex-col gap-2">
            {candidates.map((item) => (
              <li key={item.bggId}>
                <button
                  type="button"
                  className="btn btn-ghost w-full justify-start gap-3 h-auto py-2"
                  disabled={pending}
                  onClick={() => addGame(item.bggId, pendingBarcode, item.name)}
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
        </div>
      )}

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

      {message && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {message}{" "}
          <Link href="/games" className="underline">
            Zur Sammlung
          </Link>
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
