"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinMeetupAction, leaveMeetupAction } from "@/app/actions";
import { UserMinusIcon, UserPlusIcon } from "@/components/icons";

const ICON_BUTTON_CLASS =
  "btn shrink-0 min-w-[2.75rem] min-h-[2.75rem] p-0";

export function JoinMeetupButton({
  meetupId,
  isLoggedIn,
  isRegistered,
  canLeave,
  variant = "label",
}: {
  meetupId: string;
  isLoggedIn: boolean;
  isRegistered: boolean;
  canLeave: boolean;
  variant?: "icon" | "label";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) return null;

  if (isRegistered && !canLeave) {
    return null;
  }

  const joinLabel = "Ich spiele mit";
  const leaveLabel = "Nicht mehr mitspielen";
  const label = pending
    ? isRegistered
      ? "Melde ab…"
      : "Trete bei…"
    : isRegistered
      ? leaveLabel
      : joinLabel;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = isRegistered
        ? await leaveMeetupAction(meetupId)
        : await joinMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "icon") {
    return (
      <div className="relative flex shrink-0 flex-col items-center">
        <button
          type="button"
          className={`${ICON_BUTTON_CLASS} ${
            isRegistered ? "btn-ghost" : "btn-primary"
          } ${pending ? "opacity-70" : ""}`}
          onClick={handleClick}
          disabled={pending}
          aria-busy={pending}
          aria-label={label}
          title={error ?? label}
        >
          {isRegistered ? <UserMinusIcon /> : <UserPlusIcon />}
        </button>
        {error && (
          <p
            className="absolute top-full right-0 z-10 mt-1 max-w-[12rem] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--danger)] shadow-sm"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={`btn ${isRegistered ? "btn-ghost" : "btn-primary"} btn-sm whitespace-nowrap`}
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
      >
        {label}
      </button>
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
