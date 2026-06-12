"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

type State = { error?: string } | null;

export function LoginForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      return (await loginAction(formData)) ?? null;
    },
    null,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 scroll-mt-6"
      id="login"
    >
      <div>
        <label className="label" htmlFor="name">
          Dein Name
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="name"
            name="name"
            className="input"
            placeholder="z. B. Anna"
            autoComplete="off"
            maxLength={40}
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg sm:w-auto shrink-0"
            disabled={pending}
          >
            {pending ? "Melde an…" : "Los"}
          </button>
        </div>
      </div>
      {state?.error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      )}
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        Kein Passwort nötig – einfach Name eingeben. Gibt es den Namen schon,
        wirst du als diese Person angemeldet.
      </p>
    </form>
  );
}
