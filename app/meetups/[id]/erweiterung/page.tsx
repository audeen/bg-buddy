import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpansionDuellClient } from "@/components/ExpansionDuellClient";
import { DuellGateCard } from "@/components/DuellGateCard";
import { RoundSwitcher } from "@/components/RoundSwitcher";
import { RoundParticipationToggle } from "@/components/RoundControls";
import { isRoundParticipant, resolveRound } from "@/lib/round-resolve";
import { PageHeader } from "@/components/PageHeader";
import {
  buildExpansionDuelPairs,
  parseExpansionDuelFrozenData,
} from "@/lib/expansion-duel";
import { choicesFromConfigs } from "@/lib/expansion-result";
import { expansionDuelProgress } from "@/lib/expansion-duel";
import { duelParticipantIds } from "@/lib/duel-pairs";
import { pairKey } from "@/lib/duel-pairs";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export const dynamic = "force-dynamic";

export default async function ErweiterungPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const roundParam = typeof sp.runde === "string" ? sp.runde : undefined;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const resolved = await resolveRound(id, roundParam);
  if (!resolved) notFound();
  const { rounds, activeRoundId, multiRound } = resolved;
  const roundQuery = multiRound ? `?runde=${activeRoundId}` : "";

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { title: true },
  });
  const round = await prisma.meetupRound.findUnique({
    where: { id: activeRoundId },
    select: {
      expectedPlayerCount: true,
      expansionDuelStartedAt: true,
      expansionDuelFrozenData: true,
    },
  });
  if (!meetup || !round) notFound();
  if (!round.expansionDuelStartedAt) {
    redirect(`/meetups/${id}${roundQuery}`);
  }

  // Nicht-Teilnehmer sehen bei mehreren Runden Hinweis + Mitspielen-Button
  // statt der Erweiterungs-UI.
  if (multiRound && !(await isRoundParticipant(activeRoundId, user.id))) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Erweiterungs-Duell" />
        <RoundSwitcher
          meetupId={id}
          segment="erweiterung"
          rounds={rounds}
          activeRoundId={activeRoundId}
        />
        <div className="card card-pad flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">
            Du nimmst an dieser Spielrunde noch nicht teil. Tritt bei, um
            mitzustimmen.
          </p>
          <RoundParticipationToggle
            roundId={activeRoundId}
            isParticipant={false}
            canLeave={false}
          />
        </div>
      </div>
    );
  }

  const expected = round.expectedPlayerCount;
  const frozen = parseExpansionDuelFrozenData(
    round.expansionDuelFrozenData,
    expected,
  );
  if (!frozen) notFound();

  const [groupPicks, expansionVotes, baseGame, expansions] = await Promise.all([
    prisma.vote.findMany({
      where: { roundId: activeRoundId, mode: "PICK", playerCount: expected },
      select: { userId: true, gameId: true, points: true },
    }),
    prisma.vote.findMany({
      where: {
        roundId: activeRoundId,
        mode: "EXPANSION_DUEL",
        playerCount: expected,
      },
      select: {
        userId: true,
        gameId: true,
        opponentGameId: true,
      },
    }),
    prisma.game.findUnique({
      where: { id: frozen.baseGameId },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        image: true,
        coverUrl: true,
        minPlayers: true,
        maxPlayers: true,
      },
    }),
    prisma.game.findMany({
      where: {
        isExpansion: true,
        listedInCollection: true,
        expandsGameIds: { has: frozen.baseGameId },
      },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        image: true,
        coverUrl: true,
        minPlayers: true,
        maxPlayers: true,
      },
    }),
  ]);

  if (!baseGame) notFound();

  const myPickSum = groupPicks
    .filter((p) => p.userId === user.id)
    .reduce((s, p) => s + p.points, 0);

  if (myPickSum < MAX_PICK_POINTS) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Erweiterungs-Duell" />
        <DuellGateCard title="Erst Stimmen vergeben" ctaHref={`/meetups/${id}/pick${roundQuery}`}>
          <p className="text-[var(--muted)] text-sm">
            Du brauchst {MAX_PICK_POINTS}/{MAX_PICK_POINTS} Stimmen bei ★.
          </p>
        </DuellGateCard>
      </div>
    );
  }

  const pairs = buildExpansionDuelPairs(frozen.configs);
  const participants = duelParticipantIds(groupPicks);
  const progress = expansionDuelProgress(
    frozen.configs,
    expansionVotes,
    participants,
  );

  const gamesById = new Map([
    [baseGame.id, baseGame],
    ...expansions.map((e) => [e.id, e] as const),
  ]);
  const choices = choicesFromConfigs(frozen.configs, gamesById, baseGame);

  const completedKeys = expansionVotes
    .filter((v) => v.userId === user.id && v.opponentGameId != null)
    .map((v) =>
      pairKey(
        Math.min(v.gameId, v.opponentGameId!),
        Math.max(v.gameId, v.opponentGameId!),
      ),
    );

  return (
    <div className="container-app flex flex-col gap-3 sm:gap-4">
      <PageHeader eyebrow={meetup.title} title="Erweiterungs-Duell" />
      <RoundSwitcher
        meetupId={id}
        segment="erweiterung"
        rounds={rounds}
        activeRoundId={activeRoundId}
      />
      <ExpansionDuellClient
        meetupId={id}
        roundId={activeRoundId}
        roundQuery={roundQuery}
        expected={expected}
        winnerName={baseGame.name}
        choices={choices}
        myPairs={pairs}
        totalPairs={progress.totalPairs}
        decidedPairs={progress.decidedPairs}
        initialCompletedKeys={completedKeys}
      />
    </div>
  );
}
