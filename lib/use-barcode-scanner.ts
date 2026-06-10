"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

/**
 * Kamera-Lebenszyklus für das Barcode-Scannen: startet die Vorschau,
 * dekodiert Barcodes und räumt beim Unmount auf.
 * `onScan` gibt zurück, ob der Scan verarbeitet wurde — dann pausiert die Kamera.
 */
export function useBarcodeScanner(onScan: (text: string) => boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  const [scanning, setScanning] = useState(true);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const pauseCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setCameraStarting(false);
  }, []);

  const resumeScanning = useCallback(() => {
    setCameraError(null);
    setScanning(true);
  }, []);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;

    async function startCamera() {
      // Auf das Video-Element warten (Mount kann einen Frame dauern).
      for (let i = 0; i < 20; i += 1) {
        if (cancelled) return;
        if (videoRef.current) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      if (cancelled) return;

      if (!navigator.mediaDevices?.getUserMedia) {
        setScanning(false);
        setCameraError("Kamera wird in diesem Browser nicht unterstützt.");
        return;
      }

      const video = videoRef.current;
      if (!video) {
        setScanning(false);
        setCameraStarting(false);
        setCameraError("Kamera-Vorschau konnte nicht gestartet werden.");
        return;
      }

      setCameraStarting(true);
      setCameraError(null);

      const reader = new BrowserMultiFormatReader();

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (!result || cancelled) return;
            const handled = onScanRef.current(result.getText());
            if (handled) pauseCamera();
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
          // muted + playsInline reicht auf iOS in der Regel aus
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
    };
  }, [scanning, pauseCamera]);

  return {
    videoRef,
    scanning,
    cameraStarting,
    cameraError,
    setCameraError,
    pauseCamera,
    resumeScanning,
  };
}
