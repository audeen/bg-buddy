"use client";

import { useEffect } from "react";

const STORAGE_KEY = "bg-buddy-chunk-reload";

function isChunkLoadError(value: string): boolean {
  return (
    value.includes("ChunkLoadError") ||
    value.includes("Loading chunk") ||
    value.includes("Failed to fetch dynamically imported module") ||
    /\/_next\/static\/chunks\//.test(value)
  );
}

function tryReload() {
  if (sessionStorage.getItem(STORAGE_KEY)) return;
  sessionStorage.setItem(STORAGE_KEY, "1");
  window.location.reload();
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    sessionStorage.removeItem(STORAGE_KEY);

    function onError(event: ErrorEvent) {
      const message = event.message ?? "";
      const src =
        event.target instanceof HTMLScriptElement ? (event.target.src ?? "") : "";
      if (isChunkLoadError(message) || isChunkLoadError(src)) {
        event.preventDefault();
        tryReload();
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : String(reason ?? "");
      if (isChunkLoadError(message)) {
        event.preventDefault();
        tryReload();
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
