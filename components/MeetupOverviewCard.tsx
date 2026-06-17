import Link from "next/link";
import { MeetupParticipants } from "@/components/MeetupParticipants";
import { JoinMeetupButton } from "@/components/JoinMeetupButton";
import type { RegisteredPlayer } from "@/lib/meetup-participants";
import { canLeaveMeetup, isUserRegistered } from "@/lib/meetup-participants";
import { meetupEndsAt } from "@/lib/meetup-time";

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatSchedule(
  scheduledAt: Date | null,
  durationMinutes: number,
): string {
  if (!scheduledAt) return "Termin offen";
  const start = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(scheduledAt);
  const end = meetupEndsAt({ scheduledAt, durationMinutes });
  return end ? `${start}–${formatTime(end)}` : start;
}

export function MeetupOverviewCard({
  meetupId,
  title,
  scheduledAt,
  durationMinutes,
  location,
  expected,
  hostName,
  voteCount,
  players,
  duelsStarted,
  currentUserId,
  isLoggedIn,
}: {
  meetupId: string;
  title: string;
  scheduledAt: Date | null;
  durationMinutes: number;
  location: string | null;
  expected: number;
  hostName: string;
  voteCount: number;
  players: RegisteredPlayer[];
  duelsStarted: boolean;
  currentUserId?: string;
  isLoggedIn: boolean;
}) {
  const isHost = currentUserId != null && players.some(
    (p) => p.userId === currentUserId && p.isHost,
  );
  const registered = isUserRegistered(currentUserId ?? "", players);
  const leaveAllowed = canLeaveMeetup({
    isHost,
    isRegistered: registered,
    duelsStarted,
  });

  return (
    <article
      className="card card-pad card-game relative flex flex-col gap-3 h-full"
    >
      {/* Ganze Karte verlinkt (Stretched-Link); Join-Button liegt per z-index darüber. */}
      <Link
        href={`/meetups/${meetupId}`}
        className="card-overlay"
        aria-label={title}
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="section-title">{title}</span>
          <span className="chip chip-accent shrink-0 tabular-nums">
            {expected} ★
          </span>
        </div>
        <span className="text-sm text-[var(--muted)]">
          📅 {formatSchedule(scheduledAt, durationMinutes)}
          {location ? ` · ${location}` : ""}
        </span>
      </div>

      <MeetupParticipants expected={expected} players={players} compact />

      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <span className="text-xs text-[var(--muted)]">
          von {hostName} · {voteCount} Stimmen
        </span>
        <div className="relative z-[2]">
          <JoinMeetupButton
            meetupId={meetupId}
            isLoggedIn={isLoggedIn}
            isRegistered={registered}
            canLeave={leaveAllowed}
          />
        </div>
      </div>
    </article>
  );
}
