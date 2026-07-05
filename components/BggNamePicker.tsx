"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { BggNameOption, BggNameOptionKind } from "@/lib/bgg";

const KIND_LABELS: Record<BggNameOptionKind, string> = {
  primary: "Primär",
  alternate: "Alternativ",
  version: "Version",
};

function formatOptionMeta(opt: BggNameOption): string | null {
  const parts: string[] = [];
  if (opt.language) {
    parts.push(opt.language === "German" ? "Deutsch" : opt.language);
  }
  if (opt.publisher) parts.push(opt.publisher);
  if (opt.year != null) parts.push(String(opt.year));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function BggNameOptionList({
  listId,
  options,
  value,
  onSelect,
}: {
  listId: string;
  options: BggNameOption[];
  value: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div
      id={listId}
      role="radiogroup"
      aria-label="BGG-Namen auswählen"
      className="divide-y divide-[var(--border)]"
    >
      {options.map((opt) => {
        const meta = formatOptionMeta(opt);
        const selected = value === opt.name;
        const optionId = `${listId}-${opt.kind}-${opt.name}-${meta ?? ""}`;

        return (
          <label
            key={optionId}
            htmlFor={optionId}
            className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
              selected ? "bg-[var(--accent)]/10" : "hover:bg-[var(--surface-2)]"
            }`}
          >
            <input
              id={optionId}
              type="radio"
              name={`${listId}-bgg-name`}
              className="mt-1 shrink-0"
              checked={selected}
              onChange={() => onSelect(opt.name)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium">{opt.name}</span>
                <span className="chip chip-meta text-xs">{KIND_LABELS[opt.kind]}</span>
              </span>
              {meta && (
                <span className="block text-sm text-[var(--muted)] mt-0.5">{meta}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function BggNamePickerModal({
  options,
  value,
  onSelect,
  onClose,
}: {
  options: BggNameOption[];
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const listId = useId();

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

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="BGG-Namen auswählen"
        className="modal-panel max-w-lg w-full flex flex-col max-h-[min(85vh,32rem)]"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 shrink-0">
          <div>
            <h2 className="section-title">BGG-Namen</h2>
            <p className="text-sm text-[var(--muted)]">
              {options.length} {options.length === 1 ? "Eintrag" : "Einträge"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm shrink-0"
            onClick={onClose}
            aria-label="Schließen"
          >
            Schließen
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border-y border-[var(--border)] mx-4 mb-4 rounded-lg">
          <BggNameOptionList
            listId={listId}
            options={options}
            value={value}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

type BggNamePickerProps = {
  gameId: number;
  value: string;
  onChange: (value: string) => void;
  inputId: string;
  required?: boolean;
};

export function BggNamePicker({
  gameId,
  value,
  onChange,
  inputId,
  required,
}: BggNamePickerProps) {
  const [options, setOptions] = useState<BggNameOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function openNamePicker() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bgg/names?gameId=${gameId}`);
      const data = (await res.json()) as { names?: BggNameOption[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "BGG-Namen konnten nicht geladen werden.");
      }
      const names = data.names ?? [];
      setOptions(names);
      if (names.length === 0) {
        setError("Keine Namen von BGG erhalten.");
        return;
      }
      setModalOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "BGG-Namen konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(name: string) {
    onChange(name);
    setModalOpen(false);
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <input
          id={inputId}
          name="name"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />

        <button
          type="button"
          className="btn btn-ghost w-fit"
          disabled={loading}
          onClick={() => void openNamePicker()}
        >
          {loading ? "Lade BGG-Namen…" : "Namen auswählen"}
        </button>

        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
      </div>

      {modalOpen && options.length > 0 && (
        <BggNamePickerModal
          options={options}
          value={value}
          onSelect={handleSelect}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
