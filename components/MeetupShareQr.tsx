"use client";

import { useCallback, useEffect, useId, useState } from "react";
import QRCode from "react-qr-code";

function QrIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h2v2h-2z" />
      <path d="M18 14h3v3h-3z" />
      <path d="M14 18h2v3h-2z" />
      <path d="M18 18h1v1h-1z" />
      <path d="M20 18h1v3h-1z" />
    </svg>
  );
}

export function MeetupShareQr({
  meetupId,
  title,
}: {
  meetupId: string;
  title: string;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setCopied(false);
  }, []);

  function handleOpen() {
    setUrl(new URL(`/meetups/${meetupId}`, window.location.origin).href);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost shrink-0"
        style={{ width: "2rem", height: "2rem", padding: 0 }}
        aria-label="Treffen teilen"
        title="QR-Code anzeigen"
        onClick={handleOpen}
      >
        <QrIcon />
      </button>

      {open && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="modal-panel"
            style={{ maxWidth: "22rem" }}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <h2 id={titleId} className="text-sm font-semibold">
                Treffen teilen
              </h2>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "2rem", height: "2rem", padding: 0 }}
                aria-label="Schließen"
                onClick={close}
              >
                ×
              </button>
            </div>

            <div className="modal-body flex flex-col items-center gap-4">
              <p className="text-sm text-center text-[var(--muted)]">{title}</p>

              {url ? (
                <div
                  className="rounded-lg p-3"
                  style={{ background: "#ffffff" }}
                >
                  <QRCode
                    value={url}
                    size={180}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    level="M"
                  />
                </div>
              ) : (
                <div
                  className="rounded-lg"
                  style={{ width: 180, height: 180, background: "#ffffff" }}
                />
              )}

              {url && (
                <p className="w-full text-center text-xs text-[var(--muted)] break-all">
                  {url}
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={!url}
                onClick={handleCopy}
              >
                {copied ? "Kopiert!" : "Link kopieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
