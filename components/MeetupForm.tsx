"use client";

import { useActionState, useEffect, useState } from "react";
import { createMeetupAction } from "@/app/actions";

type FormValues = {
  title: string;
  scheduledAt: string;
  durationHours: string;
  expectedPlayerCount: string;
  location: string;
};

type State = { error?: string; values?: FormValues } | null;

/** Aktueller Zeitpunkt als Wert für ein <input type="datetime-local"> (lokale Zeit, Minuten-genau). */
function nowLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export function MeetupForm({
  className = "card card-pad",
  onCancel,
}: {
  /** Wrapper-Klassen des <form>. Im Modal leer lassen (das Panel ist die Karte). */
  className?: string;
  /** Wenn gesetzt, wird ein Abbrechen-Button angezeigt (z. B. im Modal). */
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => (await createMeetupAction(formData)) ?? null,
    null,
  );

  // Erst nach Mount setzen, um Hydration-Mismatch (Server vs. Client-Zeit) zu vermeiden.
  const [minDateTime, setMinDateTime] = useState<string | undefined>(undefined);
  useEffect(() => {
    setMinDateTime(nowLocalDateTime());
  }, []);

  // React 19 setzt das Formular nach der Action zurueck. Bei einem Fehler die
  // zuletzt eingegebenen Werte als defaultValue erhalten.
  const values = state?.values;

  return (
    <form action={formAction} className={`flex flex-col gap-4 ${className}`.trim()}>
      <div>
        <label className="label" htmlFor="title">
          Titel
        </label>
        <input
          id="title"
          name="title"
          className="input"
          placeholder="z. B. Spieleabend bei Anna"
          defaultValue={values?.title ?? ""}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="scheduledAt">
          Datum &amp; Uhrzeit
        </label>
        <input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          className="input"
          min={minDateTime}
          defaultValue={values?.scheduledAt ?? ""}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Optional. Das Treffen kann nicht in der Vergangenheit liegen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="durationHours">
            Dauer (Stunden)
          </label>
          <input
            id="durationHours"
            name="durationHours"
            type="number"
            min={0.5}
            step={0.5}
            defaultValue={values?.durationHours ?? 4}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="expectedPlayerCount">
            Erwartete Spieleranzahl
          </label>
          <input
            id="expectedPlayerCount"
            name="expectedPlayerCount"
            type="number"
            min={1}
            max={20}
            defaultValue={values?.expectedPlayerCount ?? 4}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="location">
          Ort (optional)
        </label>
        <input
          id="location"
          name="location"
          className="input"
          placeholder="z. B. Annas Wohnzimmer"
          defaultValue={values?.location ?? ""}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="submit"
          className="btn btn-primary btn-lg sm:flex-1"
          disabled={pending}
        >
          {pending ? "Erstelle…" : "Treffen erstellen"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={onCancel}
            disabled={pending}
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
