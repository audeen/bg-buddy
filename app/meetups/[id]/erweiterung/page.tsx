import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpansionDuellClient } from "@/components/ExpansionDuellClient";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      title: true,
      expectedPlayerCount: true,
      expansionDuelStartedAt: true,
      expansionDuelFrozenData: true,
    },
  });
  if (!meetup) notFound();
  if (!meetup.expansionDuelStartedAt) {
    redirect(`/meetups/${id}`);
  }

  const expected = meetup.expectedPlayerCount;
  const frozen = parseExpansionDuelFrozenData(
    meetup.expansionDuelFrozenData,
    expected,
  );
  if (!frozen) notFound();

  const [groupPicks, expansionVotes, baseGame, expansions] = await Promise.all([
    prisma.vote.findMany({
      where: { meetupId: id, mode: "PICK", playerCount: expected },
      select: { userId: true, gameId: true, points: true },
    }),
    prisma.vote.findMany({
      where: {
        meetupId: id,
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
        <div
          className="card flex flex-col items-center gap-3 text-center"
          style={{ padding: "var(--space-card)" }}
        >
          <p className="text-lg font-bold">Erst Stimmen vergeben</p>
          <p className="text-[var(--muted)] text-sm">
            Du brauchst {MAX_PICK_POINTS}/{MAX_PICK_POINTS} Stimmen bei ★.
          </p>
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Stimmen setzen
          </Link>
        </div>
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
      <ExpansionDuellClient
        meetupId={id}
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
