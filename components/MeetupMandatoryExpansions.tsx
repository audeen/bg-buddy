"use client";

import { useTransition } from "react";
import { toggleMandatoryExpansionAction } from "@/app/actions";

export type MandatoryExpansionFamily = {
  baseGameId: number;
  baseGameName: string;
  expansions: { id: number; name: string }[];
};

export function MeetupMandatoryExpansions({
  meetupId,
  families,
  mandatoryKeys,
}: {
  meetupId: string;
  families: MandatoryExpansionFamily[];
  mandatoryKeys: string[];
}) {
  const [pending, startTransition] = useTransition();
  const mandatorySet = new Set(mandatoryKeys);

  if (families.length === 0) return null;

  function toggle(baseGameId: number, expansionGameId: number, checked: boolean) {
    startTransition(async () => {
      await toggleMandatoryExpansionAction(
        meetupId,
        baseGameId,
        expansionGameId,
        checked,
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
      <div>
        <p className="text-sm font-semibold">Pflicht-Erweiterungen</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Erweiterungen, die bei diesem Treffen automatisch dazugehören (z. B.
          Catan 5–6 bei 6 Spielern). Über diese wird nicht abgestimmt.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {families.map((family) => (
          <li key={family.baseGameId} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--muted)]">
              {family.baseGameName}
            </span>
            <ul className="flex flex-col gap-1">
              {family.expansions.map((exp) => {
                const key = `${family.baseGameId}:${exp.id}`;
                const checked = mandatorySet.has(key);
                return (
                  <li key={exp.id}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={pending}
                        onChange={(e) =>
                          toggle(
                            family.baseGameId,
                            exp.id,
                            e.target.checked,
                          )
                        }
                        className="rounded border-[var(--border)]"
                      />
                      <span>{exp.name}</span>
                      {checked && (
                        <span className="chip text-[10px] py-0">Pflicht</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
