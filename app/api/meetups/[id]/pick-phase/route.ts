import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizePickSums } from "@/lib/pick-phase";
import { getPickPhaseState } from "@/lib/pick-phase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { id: true, title: true, expectedPlayerCount: true },
  });
  if (!meetup) {
    return NextResponse.json({ error: "Treffen nicht gefunden." }, { status: 404 });
  }

  const expected = meetup.expectedPlayerCount;
  const [phase, picks] = await Promise.all([
    getPickPhaseState(id, expected, prisma),
    prisma.vote.findMany({
      where: { meetupId: id, mode: "PICK", playerCount: expected },
      select: { userId: true, gameId: true, points: true },
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
    meetup,
    phase,
    pickers,
    hint: phase.readyForDuels
      ? "Duell frei (readyForDuels=true)"
      : `Gesperrt: ${phase.fullPickCount}/${phase.expectedPlayerCount} mit 3/3 bei ★`,
  });
}
