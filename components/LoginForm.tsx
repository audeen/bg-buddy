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
    <form action={formAction} className="flex flex-col gap-3" id="login">
      <label className="text-sm font-semibold" htmlFor="name">
        Dein Name
      </label>
      <div className="flex gap-2">
        <input
          id="name"
          name="name"
          className="input"
          placeholder="z. B. Anna"
          autoComplete="off"
          maxLength={40}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "..." : "Los"}
        </button>
      </div>
      {state?.error && (
        <p className="text-sm text-[var(--primary)]">{state.error}</p>
      )}
      <p className="text-xs text-[var(--muted)]">
        Kein Passwort nötig – einfach Name eingeben. Gibt es den Namen schon,
        wirst du als diese Person angemeldet.
      </p>
    </form>
  );
}
