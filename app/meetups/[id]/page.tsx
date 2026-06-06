import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { ExpectedCountReadOnly } from "@/components/ExpectedCountReadOnly";
import { MeetupActionsMenu } from "@/components/MeetupActionsMenu";
import { MeetupVoteActions } from "@/components/MeetupVoteActions";
import { MeetupRankings } from "@/components/MeetupRankings";
import { PageHeader } from "@/components/PageHeader";
import {
  buildCombinedByCount,
  playerCountsFromVotes,
} from "@/lib/vote-aggregation";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import { getDuelProgressForCount } from "@/lib/duel-pairs";
import { getPickPhaseState } from "@/lib/pick-phase";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "Termin offen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function MeetupDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!meetup) notFound();

  const votes = await prisma.vote.findMany({
    where: { meetupId: id },
    include: {
      game: { select: { id: true, name: true, thumbnail: true, image: true } },
      user: { select: { name: true } },
    },
  });

  const combinedByCount = buildCombinedByCount(votes);
  const playerCounts = playerCountsFromVotes(
    meetup.expectedPlayerCount,
    votes,
  );

  const expected = meetup.expectedPlayerCount;
  const pickPhase = await getPickPhaseState(id, expected, prisma);
  const groupPicks = votes.filter(
    (v) => v.mode === "PICK" && v.playerCount === expected,
  );
  const pickCounts = buildPickCounts(groupPicks);
  const poolIds = poolGameIds(pickCounts);
  const pickPoolSize = poolIds.length;

  const duelRows = votes
    .filter(
      (v) =>
        (v.mode === "DUEL" || v.mode === "TINDER") &&
        v.playerCount === expected,
    )
    .map((v) => ({
      gameId: v.gameId,
      opponentGameId: v.opponentGameId,
      userId: v.userId,
      playerCount: v.playerCount,
    }));

  const {
    totalPairs,
    decidedPairs: groupDecidedPairs,
    duelComplete,
  } = getDuelProgressForCount(poolIds, duelRows, expected);

  const duelRoundComplete = duelComplete && totalPairs > 0;

  const duellLinkTitle = duelRoundComplete
    ? "Duelle abgeschlossen — Host kann ★ ändern für eine neue Runde"
    : pickPhase.readyForDuels
      ? undefined
      : pickPhase.poolSize < 2
        ? "Mindestens zwei nominierte Spiele nötig"
        : `${pickPhase.fullPickCount}/${pickPhase.expectedPlayerCount} Spieler mit ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★`;

  const isHost = user?.id === meetup.createdBy.id;

  const completedCounts = playerCounts.filter((pc) => {
    if (pc === expected && !duelRoundComplete) return false;
    const countPicks = votes.filter(
      (v) => v.mode === "PICK" && v.playerCount === pc,
    );
    const countPool = poolGameIds(buildPickCounts(countPicks));
    const countDuels = votes
      .filter(
        (v) =>
          (v.mode === "DUEL" || v.mode === "TINDER") && v.playerCount === pc,
      )
      .map((v) => ({
        gameId: v.gameId,
        opponentGameId: v.opponentGameId,
        userId: v.userId,
        playerCount: v.playerCount,
      }));
    if (countDuels.length === 0) return false;
    return getDuelProgressForCount(countPool, countDuels, pc).duelComplete;
  });

  return (
    <div className="container-app flex flex-col gap-6">
      <PageHeader id="meetup-page-top" eyebrow="Treffen" title={meetup.title}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            {formatDate(meetup.scheduledAt)}
            {meetup.location ? ` · ${meetup.location}` : ""} · von{" "}
            {meetup.createdBy.name}
          </p>
          {user && (
            <MeetupActionsMenu meetupId={meetup.id} title={meetup.title} />
          )}
        </div>
      </PageHeader>

      <div className="card flex flex-col gap-4" style={{ padding: "var(--space-card)" }}>
        {isHost ? (
          <ExpectedCountControl
            key={meetup.expectedPlayerCount}
            meetupId={meetup.id}
            value={meetup.expectedPlayerCount}
          />
        ) : (
          <ExpectedCountReadOnly count={meetup.expectedPlayerCount} />
        )}
        <MeetupVoteActions
          meetupId={meetup.id}
          readyForDuels={pickPhase.readyForDuels}
          picksLocked={pickPhase.picksLocked}
          duelComplete={duelRoundComplete}
          pickPoolSize={pickPoolSize}
          fullPickCount={pickPhase.fullPickCount}
          expectedPlayerCount={pickPhase.expectedPlayerCount}
          poolSize={pickPhase.poolSize}
          duellLinkTitle={duellLinkTitle}
        />
      </div>

      <MeetupRankings
        key={expected}
        expected={expected}
        playerCounts={playerCounts}
        combinedByCount={combinedByCount}
        duelComplete={duelComplete}
        completedCounts={completedCounts}
        groupDecidedPairs={groupDecidedPairs}
        totalPairs={totalPairs}
      />
    </div>
  );
}
