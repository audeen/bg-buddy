import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPickPhaseState, summarizePickSums } from "@/lib/pick-phase";
import { roundOrderBy } from "@/lib/round-resolve";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  const roundParam = new URL(request.url).searchParams.get("runde");

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      rounds: {
        orderBy: [...roundOrderBy],
        select: {
          id: true,
          expectedPlayerCount: true,
          hostForcedGameId: true,
          hostForcedGame: { select: { name: true } },
        },
      },
    },
  });
  if (!meetup) {
    return NextResponse.json({ error: "Treffen nicht gefunden." }, { status: 404 });
  }

  const round =
    (roundParam && meetup.rounds.find((r) => r.id === roundParam)) ||
    meetup.rounds[0];
  if (!round) {
    return NextResponse.json({ error: "Spielrunde nicht gefunden." }, { status: 404 });
  }

  const expected = round.expectedPlayerCount;
  const [phase, picks, duelVoteCount] = await Promise.all([
    getPickPhaseState(round.id, expected, prisma),
    prisma.vote.findMany({
      where: { roundId: round.id, mode: "PICK", playerCount: expected },
      select: { userId: true, gameId: true, points: true },
    }),
    prisma.vote.count({
      where: {
        roundId: round.id,
        playerCount: expected,
        mode: "DUEL",
      },
    }),
  ]);

  const sums = summarizePickSums(picks);
  const pickerIds = [...sums.keys()];
  const users =
    pickerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: pickerIds } },
          select: { id: true, name: true },
        })
      : [];

  const pickers = users
    .map((u) => ({
      name: u.name,
      userId: u.id,
      pickSum: sums.get(u.id) ?? 0,
      isYou: u.id === user.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    meetup: {
      id: meetup.id,
      title: meetup.title,
      roundId: round.id,
      expectedPlayerCount: expected,
      hostForcedGameId: round.hostForcedGameId,
      hostForcedGame: round.hostForcedGame,
    },
    phase,
    duelVoteCount,
    pickers,
    hostForced: round.hostForcedGameId != null,
    hostForcedGameName: round.hostForcedGame?.name ?? null,
    hint: round.hostForcedGameId != null
      ? "Host hat Spiel festgelegt"
      : phase.readyForDuels
        ? "Duell frei (readyForDuels=true)"
        : `Gesperrt: ${phase.fullPickCount}/${phase.expectedPlayerCount} mit 3/3 bei ★`,
  });
}
