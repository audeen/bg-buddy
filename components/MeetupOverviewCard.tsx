import Link from "next/link";
import { MeetupParticipants } from "@/components/MeetupParticipants";
import { JoinMeetupButton } from "@/components/JoinMeetupButton";
import type { PickPointsAtExpected, RegisteredPlayer } from "@/lib/meetup-participants";
import { canLeaveMeetup, isUserRegistered } from "@/lib/meetup-participants";

function formatDate(d: Date | null): string {
  if (!d) return "Termin offen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function MeetupOverviewCard({
  meetupId,
  title,
  scheduledAt,
  location,
  expected,
  hostName,
  voteCount,
  players,
  pickPointsAtExpected,
  duelsStarted,
  currentUserId,
  isLoggedIn,
}: {
  meetupId: string;
  title: string;
  scheduledAt: Date | null;
  location: string | null;
  expected: number;
  hostName: string;
  voteCount: number;
  players: RegisteredPlayer[];
  pickPointsAtExpected: PickPointsAtExpected;
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
      className="card flex flex-col gap-3 h-full"
      style={{ padding: "var(--space-card)" }}
    >
      <Link
        href={`/meetups/${meetupId}`}
        className="flex flex-col gap-2 hover:opacity-90 transition-opacity -m-1 p-1 rounded-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-lg">{title}</span>
          <span className="chip chip-accent shrink-0 tabular-nums">
            {expected} ★
          </span>
        </div>
        <span className="text-sm text-[var(--muted)]">
          📅 {formatDate(scheduledAt)}
          {location ? ` · ${location}` : ""}
        </span>
      </Link>

      <MeetupParticipants
        expected={expected}
        players={players}
        compact
        pickPointsAtExpected={pickPointsAtExpected}
      />

      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <span className="text-xs text-[var(--muted)]">
          von {hostName} · {voteCount} Stimmen
        </span>
        <JoinMeetupButton
          meetupId={meetupId}
          isLoggedIn={isLoggedIn}
          isRegistered={registered}
          canLeave={leaveAllowed}
        />
      </div>
    </article>
  );
}
