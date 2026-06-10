"use client";

import { useTransition } from "react";
import { toggleMandatoryExpansionAction } from "@/app/actions";
import type { MandatoryExpansionFamily } from "@/lib/types/meetup";

export function MeetupMandatoryExpansions({
  meetupId,
  family,
  mandatoryKeys,
}: {
  meetupId: string;
  family: MandatoryExpansionFamily;
  mandatoryKeys: string[];
}) {
  const [pending, startTransition] = useTransition();
  const mandatorySet = new Set(mandatoryKeys);

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
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold">Pflicht-Erweiterungen</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Automatisch dabei — darüber wird nicht abgestimmt (z. B. Catan 5–6 bei
          6 Spielern).
        </p>
      </div>
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
                    toggle(family.baseGameId, exp.id, e.target.checked)
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
    </div>
  );
}
