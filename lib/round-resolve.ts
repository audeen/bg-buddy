import { prisma } from "@/lib/prisma";

export type ResolvedRounds = {
  rounds: { id: string; label: string | null; startsAt: Date | null }[];
  activeRoundId: string;
  multiRound: boolean;
};

/**
 * Lädt die Spielrunden eines Treffens (für den Runden-Umschalter) und bestimmt
 * die aktive Runde anhand des `?runde=`-Parameters. Default = erste Runde,
 * damit bestehende Links ohne Parameter weiterhin funktionieren.
 */
/** Runden-Reihenfolge: Startzeit aufsteigend (ohne Startzeit zuletzt), dann sortOrder. */
export const roundOrderBy = [
  { startsAt: { sort: "asc", nulls: "last" } },
  { sortOrder: "asc" },
] as const;

export async function resolveRound(
  meetupId: string,
  roundParam: string | undefined | null,
): Promise<ResolvedRounds | null> {
  const rounds = await prisma.meetupRound.findMany({
    where: { meetupId },
    orderBy: [...roundOrderBy],
    select: { id: true, label: true, startsAt: true },
  });
  if (rounds.length === 0) return null;

  const active =
    (roundParam && rounds.find((r) => r.id === roundParam)) || rounds[0];

  return {
    rounds,
    activeRoundId: active.id,
    multiRound: rounds.length > 1,
  };
}

/**
 * Teilnehmer einer Runde = Host + explizite Opt-ins + implizit wer in der
 * Runde bereits Pick-Punkte vergeben hat.
 */
export async function isRoundParticipant(
  roundId: string,
  userId: string,
): Promise<boolean> {
  const round = await prisma.meetupRound.findUnique({
    where: { id: roundId },
    select: {
      meetup: { select: { createdById: true } },
      participants: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!round) return false;
  if (round.meetup.createdById === userId) return true;
  if (round.participants.length > 0) return true;

  const pick = await prisma.vote.findFirst({
    where: { roundId, userId, mode: "PICK" },
    select: { id: true },
  });
  return pick != null;
}
