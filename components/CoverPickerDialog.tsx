"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { setGameCoverAction } from "@/app/actions";
import type { BggGalleryImage, BggGalleryPage } from "@/lib/bgg/gallery";

const UPLOAD_MAX_DIMENSION = 1200;

type Tab = "gallery" | "url" | "upload";

/** Verkleinert ein Bild clientseitig auf max. 1200 px Kantenlänge (WebP). */
async function resizeImageFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      UPLOAD_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Bild konnte nicht verarbeitet werden.")),
        "image/webp",
        0.85,
      );
    });
  } finally {
    bitmap.close();
  }
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-foreground,#fff)]"
          : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function GalleryTab({
  gameId,
  selected,
  onSelect,
}: {
  gameId: number;
  selected: string | null;
  onSelect: (url: string | null) => void;
}) {
  const [boxFrontOnly, setBoxFrontOnly] = useState(true);
  const [images, setImages] = useState<BggGalleryImage[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // Startet true, damit vor dem ersten Fetch kein "keine Bilder"-Hinweis aufblitzt.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean, boxFront: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          gameId: String(gameId),
          page: String(nextPage),
        });
        if (boxFront) params.set("tag", "BoxFront");
        const res = await fetch(`/api/bgg/images?${params.toString()}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as BggGalleryPage;
        setImages((prev) => (replace ? data.images : [...prev, ...data.images]));
        setPage(nextPage);
        setHasMore(data.hasMore);
      } catch {
        setError("Galerie konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    },
    [gameId],
  );

  useEffect(() => {
    setImages([]);
    onSelect(null);
    void loadPage(1, true, boxFrontOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxFrontOnly, loadPage]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={boxFrontOnly}
          onChange={(e) => setBoxFrontOnly(e.target.checked)}
        />
        Nur Box-Cover anzeigen
      </label>

      {error && <p className="text-sm text-[var(--primary)]">{error}</p>}

      {images.length === 0 && !loading && !error && (
        <p className="text-sm text-[var(--muted)]">
          Keine Bilder in dieser Kategorie gefunden.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {images.map((img) => {
          const isSelected = selected === img.large;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : img.large)}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-[var(--surface-2)] transition-colors ${
                isSelected
                  ? "border-[var(--accent)]"
                  : "border-transparent hover:border-[var(--border)]"
              }`}
              title={img.caption ?? undefined}
              aria-pressed={isSelected}
            >
              <img
                src={img.thumb}
                alt={img.caption ?? "Galerie-Bild"}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {isSelected && (
                <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)] text-center">Lade Bilder…</p>
      )}

      {hasMore && !loading && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void loadPage(page + 1, false, boxFrontOnly)}
        >
          Mehr Bilder laden
        </button>
      )}
    </div>
  );
}

/**
 * Dialog zum Wählen eines Spiel-Covers: BGG-Galerie durchsuchen,
 * eigenen Link einfügen oder ein eigenes Bild hochladen.
 */
export function CoverPickerDialog({
  gameId,
  gameName,
  onClose,
  onSaved,
}: {
  gameId: number;
  gameName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<Tab>("gallery");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [gallerySelection, setGallerySelection] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreviewOk, setLinkPreviewOk] = useState<boolean | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const uploadBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  const trimmedLink = linkUrl.trim();
  const linkValid = /^https?:\/\//i.test(trimmedLink);

  const canSave =
    !pending &&
    ((tab === "gallery" && gallerySelection != null) ||
      (tab === "url" && linkValid) ||
      (tab === "upload" && uploadBlobRef.current != null));

  async function handleFileChange(file: File | null) {
    setError(null);
    uploadBlobRef.current = null;
    setUploadPreview(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei auswählen.");
      return;
    }
    try {
      const blob = await resizeImageFile(file);
      uploadBlobRef.current = blob;
      setUploadPreview(URL.createObjectURL(blob));
    } catch {
      setError("Bild konnte nicht verarbeitet werden.");
    }
  }

  function save() {
    setError(null);
    const formData = new FormData();
    if (tab === "gallery") {
      if (!gallerySelection) return;
      formData.set("type", "url");
      formData.set("url", gallerySelection);
    } else if (tab === "url") {
      if (!linkValid) return;
      formData.set("type", "url");
      formData.set("url", trimmedLink);
    } else {
      const blob = uploadBlobRef.current;
      if (!blob) return;
      formData.set("type", "upload");
      formData.set("file", new File([blob], "cover.webp", { type: blob.type }));
    }

    startTransition(async () => {
      const res = await setGameCoverAction(gameId, formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cover wählen für ${gameName}`}
        className="modal-panel"
        style={{ maxWidth: "28rem" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Cover wählen</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="flex gap-2">
            <TabButton active={tab === "gallery"} onClick={() => setTab("gallery")}>
              BGG-Galerie
            </TabButton>
            <TabButton active={tab === "url"} onClick={() => setTab("url")}>
              Link
            </TabButton>
            <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
              Upload
            </TabButton>
          </div>

          {tab === "gallery" && (
            <GalleryTab
              gameId={gameId}
              selected={gallerySelection}
              onSelect={setGallerySelection}
            />
          )}

          {tab === "url" && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="cover-link-url">
                  Bild-URL
                </label>
                <input
                  id="cover-link-url"
                  type="url"
                  className="input"
                  placeholder="https://…"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setLinkPreviewOk(null);
                  }}
                />
              </div>
              {linkValid && (
                <div className="flex flex-col gap-1">
                  <span className="label">Vorschau</span>
                  <div className="aspect-square w-40 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    <img
                      src={trimmedLink}
                      alt="Vorschau"
                      className="h-full w-full object-contain"
                      onLoad={() => setLinkPreviewOk(true)}
                      onError={() => setLinkPreviewOk(false)}
                    />
                  </div>
                  {linkPreviewOk === false && (
                    <p className="text-sm text-[var(--primary)]">
                      Bild konnte nicht geladen werden — URL prüfen.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "upload" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--muted)]">
                Das Bild wird vor dem Hochladen automatisch auf max.{" "}
                {UPLOAD_MAX_DIMENSION} px verkleinert.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="input"
                onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
              />
              {uploadPreview && (
                <div className="aspect-square w-40 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                  <img
                    src={uploadPreview}
                    alt="Vorschau"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-[var(--primary)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave}
            onClick={save}
          >
            {pending ? "Speichern…" : "Als Cover übernehmen"}
          </button>
        </div>
      </div>
    </div>
  );
}
