"use client";

import { useActionState } from "react";
import { createMeetupAction } from "@/app/actions";

type State = { error?: string } | null;

export function MeetupForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => (await createMeetupAction(formData)) ?? null,
    null,
  );

  return (
    <form action={formAction} className="card p-5 flex flex-col gap-4">
      <div>
        <label className="text-sm font-semibold" htmlFor="title">
          Titel
        </label>
        <input
          id="title"
          name="title"
          className="input mt-1"
          placeholder="z. B. Spieleabend bei Anna"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold" htmlFor="scheduledAt">
            Datum &amp; Uhrzeit
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="expectedPlayerCount">
            Erwartete Spieleranzahl
          </label>
          <input
            id="expectedPlayerCount"
            name="expectedPlayerCount"
            type="number"
            min={1}
            max={20}
            defaultValue={4}
            className="input mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="location">
          Ort (optional)
        </label>
        <input
          id="location"
          name="location"
          className="input mt-1"
          placeholder="z. B. Annas Wohnzimmer"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-[var(--primary)]">{state.error}</p>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Erstelle…" : "Treffen erstellen"}
      </button>
    </form>
  );
}
