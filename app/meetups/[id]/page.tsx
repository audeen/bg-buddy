import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { ExpectedCountReadOnly } from "@/components/ExpectedCountReadOnly";
import { MeetupActionsMenu } from "@/components/MeetupActionsMenu";
import { MeetupShareQr } from "@/components/MeetupShareQr";
import { DuellResetNotice } from "@/components/DuellResetNotice";
import { MeetupVoteActions } from "@/components/MeetupVoteActions";
import { MeetupExpansionActions } from "@/components/MeetupExpansionActions";
import { MeetupRankings } from "@/components/MeetupRankings";
import { MeetupParticipants } from "@/components/MeetupParticipants";
import { MeetupTableToolsClient } from "@/components/MeetupTableToolsClient";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { JoinMeetupButton } from "@/components/JoinMeetupButton";
import { MeetupSpielsteuerungClient } from "@/components/MeetupSpielsteuerungClient";
import {
  AddRoundButton,
  RoundAdminBar,
} from "@/components/RoundControls";
import { PageHeader } from "@/components/PageHeader";
import { roundOrderBy, isMeetupRegistered } from "@/lib/round-resolve";
import { meetupEndsAt } from "@/lib/meetup-time";
import {
  buildCombinedByCount,
  playerCountsFromVotes,
} from "@/lib/vote-aggregation";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import {
  getDuelProgressForCount,
  parseDuelFrozenData,
} from "@/lib/duel-pairs";
import { buildGameTieMetaMap } from "@/lib/duel-tiebreaker";
import { getPickPhaseState } from "@/lib/pick-phase";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";
import {
  buildRegisteredPlayers,
  canLeaveMeetup,
  sumPickPointsAtExpected,
} from "@/lib/meetup-participants";
import { loadExpansionPhaseState } from "@/lib/expansion-phase";
import {
  loadWinnerExpansionFamily,
  mandatoryExpansionKeysForWinner,
} from "@/lib/meetup-mandatory-data";
import { parseExpansionDuelFrozenData } from "@/lib/expansion-duel";
import {
  buildExpansionRankingEntries,
  coverByVoteGameIdForConfigs,
} from "@/lib/expansion-ranking";
import type { RankEntry } from "@/lib/types/ranking";
import { PickedGamesStrip } from "@/components/PickedGamesStrip";
import { resolveCoverSrc } from "@/lib/cover-image";

export const dynamic = "force-dynamic";

function formatSchedule(
  scheduledAt: Date | null,
  durationMinutes: number,
): string {
  if (!scheduledAt) return "Termin offen";
  const start = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(scheduledAt);
  const end = meetupEndsAt({ scheduledAt, durationMinutes });
  return end
    ? `${start}–${new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(end)} Uhr`
    : start;
}

function formatTime(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const roundInclude = {
  hostChoiceGames: {
    include: {
      game: {
        select: {
          id: true,
          name: true,
          thumbnail: true,
          image: true,
          coverUrl: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  hostForcedGame: {
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
      coverUrl: true,
    },
  },
  mandatoryExpansions: {
    select: { baseGameId: true, expansionGameId: true },
  },
};

export default async function MeetupDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      guestGames: {
        include: {
          game: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              image: true,
              coverUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      rounds: {
        orderBy: [...roundOrderBy],
        include: roundInclude,
      },
    },
  });
  if (!meetup) notFound();

  const guestGames = meetup.guestGames.map((g) => g.game);
  const isHost = user?.id === meetup.createdBy.id;
  const canDeleteMeetup = isHost || isAdmin(user);
  const multiRound = meetup.rounds.length > 1;

  // Meetup-weite Teilnehmerliste (Vereinigung aller Runden) für Tisch-Tools.
  const roundIds = meetup.rounds.map((r) => r.id);
  const allPickVotes = await prisma.vote.findMany({
    where: { roundId: { in: roundIds }, mode: "PICK" },
    select: { userId: true, user: { select: { name: true } } },
  });
  const pickVoterMap = new Map<string, string>();
  for (const v of allPickVotes) pickVoterMap.set(v.userId, v.user.name);
  const meetupPlayers = buildRegisteredPlayers(
    meetup.createdBy,
    [...pickVoterMap.entries()].map(([userId, name]) => ({ userId, name })),
  );

  const duelVoteCount = await prisma.vote.count({
    where: { roundId: { in: roundIds }, mode: "DUEL" },
  });
  const duelsStarted = duelVoteCount > 0;
  const userIsMeetupRegistered = user?.id
    ? await isMeetupRegistered(id, user.id)
    : false;
  const canLeaveMeetupNow = user?.id
    ? canLeaveMeetup({
        isHost,
        isRegistered: userIsMeetupRegistered,
        duelsStarted,
      })
    : false;

  return (
    <div className="container-app flex flex-col gap-6">
      <PageHeader id="meetup-page-top" eyebrow="Treffen" title={meetup.title}>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm text-[var(--muted)]">
            {formatSchedule(meetup.scheduledAt, meetup.durationMinutes)}
            {meetup.location ? ` · ${meetup.location}` : ""} · von{" "}
            {meetup.createdBy.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {user && (
              <JoinMeetupButton
                meetupId={meetup.id}
                isLoggedIn
                isRegistered={userIsMeetupRegistered}
                canLeave={canLeaveMeetupNow}
                variant="icon"
              />
            )}
            <MeetupShareQr meetupId={meetup.id} title={meetup.title} />
            {canDeleteMeetup && (
              <MeetupActionsMenu meetupId={meetup.id} title={meetup.title} />
            )}
          </div>
        </div>
      </PageHeader>

      <DuellResetNotice />

      {meetup.rounds.map((round, index) => (
        <RoundCard
          key={round.id}
          round={round}
          index={index}
          meetupId={meetup.id}
          meetupCreatedBy={meetup.createdBy}
          guestGames={guestGames}
          userId={user?.id ?? null}
          isHost={isHost}
          multiRound={multiRound}
          meetupRegistered={userIsMeetupRegistered}
        />
      ))}

      {isHost && <AddRoundButton meetupId={meetup.id} />}

      <div className="card card-pad">
        <CollapsibleSection title="Tisch-Tools">
          <MeetupTableToolsClient players={meetupPlayers} />
        </CollapsibleSection>
      </div>
    </div>
  );
}

type RoundWithRelations = Prisma.MeetupRoundGetPayload<{
  include: typeof roundInclude;
}>;

async function RoundCard({
  round,
  index,
  meetupId,
  meetupCreatedBy,
  guestGames,
  userId,
  isHost,
  multiRound,
  meetupRegistered,
}: {
  round: RoundWithRelations;
  index: number;
  meetupId: string;
  meetupCreatedBy: { id: string; name: string };
  guestGames: {
    id: number;
    name: string;
    thumbnail: string | null;
    image: string | null;
    coverUrl: string | null;
  }[];
  userId: string | null;
  isHost: boolean;
  multiRound: boolean;
  meetupRegistered: boolean;
}) {
  const roundId = round.id;
  const expected = round.expectedPlayerCount;
  const roundQuery = multiRound ? `?runde=${roundId}` : "";

  const hostChoiceGames = round.hostChoiceGames.map((g) => g.game);
  const forcedGame = round.hostForcedGame;
  const hostForced = round.hostForcedGameId != null;

  const votes = await prisma.vote.findMany({
    where: { roundId },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          thumbnail: true,
          image: true,
          coverUrl: true,
          bestPlayerCounts: true,
          rank: true,
          bggRating: true,
        },
      },
      user: { select: { name: true } },
    },
  });

  const frozen = parseDuelFrozenData(round.duelFrozenData, expected);
  const combinedByCount = buildCombinedByCount(votes, roundId, frozen);
  const playerCounts = playerCountsFromVotes(expected, votes);

  const pickPhase = await getPickPhaseState(roundId, expected, prisma);
  const groupPicks = votes.filter(
    (v) => v.mode === "PICK" && v.playerCount === expected,
  );
  const pickCounts = buildPickCounts(groupPicks);
  const poolIds = frozen?.poolGameIds ?? poolGameIds(pickCounts);
  const pickPoolSize = poolIds.length;

  const myPickStrip = userId
    ? votes
        .filter(
          (v) =>
            v.mode === "PICK" &&
            v.playerCount === expected &&
            v.userId === userId &&
            v.points > 0,
        )
        .sort((a, b) => b.points - a.points)
        .map((v) => ({
          id: v.gameId,
          name: v.game.name,
          coverSrc: resolveCoverSrc(v.game),
          points: v.points,
        }))
    : [];

  const duelRows = votes
    .filter((v) => v.mode === "DUEL" && v.playerCount === expected)
    .map((v) => ({
      gameId: v.gameId,
      opponentGameId: v.opponentGameId,
      userId: v.userId,
      playerCount: v.playerCount,
    }));

  const tieBreak =
    poolIds.length >= 2
      ? {
          meetupId: roundId,
          expectedPlayerCount: expected,
          pickCounts,
          games: buildGameTieMetaMap(
            poolIds.map((gameId) => {
              const vote = votes.find(
                (v) => v.gameId === gameId && v.mode === "PICK",
              );
              const g = vote?.game;
              return {
                id: gameId,
                bestPlayerCounts: g?.bestPlayerCounts ?? [],
                rank: g?.rank ?? null,
                bggRating: g?.bggRating ?? null,
              };
            }),
          ),
        }
      : undefined;

  const {
    phase: duelPhase,
    totalPairs,
    decidedPairs: groupDecidedPairs,
    duelComplete,
    finishedParticipants,
    totalParticipants,
  } = getDuelProgressForCount(poolIds, duelRows, expected, {
    picks: groupPicks,
    meetupId: roundId,
    tieBreak,
    frozen,
  });

  const duelRoundComplete = hostForced || (duelComplete && totalPairs > 0);

  const expansionPhase = await loadExpansionPhaseState(
    roundId,
    expected,
    prisma,
  );
  const winnerFamily =
    duelRoundComplete && expansionPhase.winnerGameId
      ? await loadWinnerExpansionFamily(expansionPhase.winnerGameId, expected)
      : null;
  const mandatoryKeys =
    expansionPhase.winnerGameId != null
      ? mandatoryExpansionKeysForWinner(
          round.mandatoryExpansions,
          expansionPhase.winnerGameId,
        )
      : [];

  let expansionRanking: RankEntry[] = [];
  let expansionRankingAvailable = false;

  if (duelRoundComplete && expansionPhase.winnerGameId) {
    const winnerId = expansionPhase.winnerGameId;
    const [baseGame, ownedExpansions, expansionVotes] = await Promise.all([
      prisma.game.findUnique({
        where: { id: winnerId },
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
          expandsGameIds: { has: winnerId },
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
      prisma.vote.findMany({
        where: {
          roundId,
          mode: "EXPANSION_DUEL",
          playerCount: expected,
        },
        select: {
          gameId: true,
          opponentGameId: true,
          userId: true,
        },
      }),
    ]);

    if (baseGame) {
      if (expansionPhase.expansionDuelStarted) {
        const expFrozen = parseExpansionDuelFrozenData(
          round.expansionDuelFrozenData,
          expected,
        );
        if (expFrozen && expFrozen.configs.length > 0) {
          const gamesById = new Map([
            [baseGame.id, baseGame],
            ...ownedExpansions.map((e) => [e.id, e] as const),
          ]);
          const covers = coverByVoteGameIdForConfigs(
            expFrozen.configs,
            gamesById,
            baseGame,
          );
          expansionRanking = buildExpansionRankingEntries(
            expFrozen.configs,
            expansionVotes,
            covers,
          );
          expansionRankingAvailable =
            expansionRanking.length >= 2 ||
            (expansionPhase.expansionDuelComplete &&
              expansionRanking.length >= 1);
        }
      }
    }
  }

  const duellLinkTitle = duelRoundComplete
    ? "Duelle abgeschlossen — Host kann ★ ändern für eine neue Runde"
    : pickPhase.readyForDuels
      ? undefined
      : pickPhase.poolSize < 2
        ? "Mindestens zwei nominierte Spiele nötig"
        : `${pickPhase.fullPickCount}/${pickPhase.expectedPlayerCount} Spieler mit ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★`;

  const pickVoters = votes
    .filter((v) => v.mode === "PICK")
    .reduce(
      (acc, v) => {
        if (!acc.some((p) => p.userId === v.userId)) {
          acc.push({ userId: v.userId, name: v.user.name });
        }
        return acc;
      },
      [] as { userId: string; name: string }[],
    );

  const registeredPlayers = buildRegisteredPlayers(
    meetupCreatedBy,
    pickVoters,
  );

  const pickPointsAtExpected = sumPickPointsAtExpected(
    votes
      .filter((v) => v.mode === "PICK")
      .map((v) => ({
        userId: v.userId,
        playerCount: v.playerCount,
        points: v.points,
      })),
    expected,
  );

  const completedCounts = playerCounts.filter((pc) => {
    if (pc === expected && !duelRoundComplete) return false;
    const countPicks = votes.filter(
      (v) => v.mode === "PICK" && v.playerCount === pc,
    );
    const countPool = poolGameIds(buildPickCounts(countPicks));
    const countDuels = votes
      .filter((v) => v.mode === "DUEL" && v.playerCount === pc)
      .map((v) => ({
        gameId: v.gameId,
        opponentGameId: v.opponentGameId,
        userId: v.userId,
        playerCount: v.playerCount,
      }));
    if (countDuels.length === 0) return false;
    const countPickCounts = buildPickCounts(countPicks);
    const countTieBreak =
      countPool.length >= 2
        ? {
            meetupId: roundId,
            expectedPlayerCount: pc,
            pickCounts: countPickCounts,
            games: buildGameTieMetaMap(
              countPool.map((gameId) => {
                const vote = votes.find(
                  (v) =>
                    v.gameId === gameId &&
                    v.mode === "PICK" &&
                    v.playerCount === pc,
                );
                const g = vote?.game;
                return {
                  id: gameId,
                  bestPlayerCounts: g?.bestPlayerCounts ?? [],
                  rank: g?.rank ?? null,
                  bggRating: g?.bggRating ?? null,
                };
              }),
            ),
          }
        : undefined;
    const countFrozen = parseDuelFrozenData(round.duelFrozenData, pc);
    return getDuelProgressForCount(countPool, countDuels, pc, {
      picks: countPicks,
      meetupId: roundId,
      tieBreak: countTieBreak,
      frozen: countFrozen,
    }).duelComplete;
  });

  const time = formatTime(round.startsAt);
  const headerParts = [`Runde ${index + 1}`];
  if (time) headerParts.push(`${time} Uhr`);
  if (round.label) headerParts.push(round.label);

  return (
    <div className="card card-pad flex flex-col gap-4">
      {multiRound && (
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-3">
          <h2 className="text-base font-semibold">
            {headerParts.join(" · ")}
          </h2>
          {isHost && (
            <RoundAdminBar
              roundId={roundId}
              label={round.label ?? ""}
              startsAtLocal={toLocalInputValue(round.startsAt)}
              canDelete
            />
          )}
        </div>
      )}

      {isHost ? (
        <>
          <ExpectedCountControl
            key={expected}
            roundId={roundId}
            value={expected}
          />
          <MeetupSpielsteuerungClient
            meetupId={meetupId}
            roundId={roundId}
            forcedGame={forcedGame}
            hostChoiceGames={hostChoiceGames}
            hostChoiceMode={round.hostChoiceMode}
            guestGames={guestGames}
          />
        </>
      ) : (
        <ExpectedCountReadOnly count={expected} />
      )}

      <MeetupParticipants
        expected={expected}
        players={registeredPlayers}
        pickPointsAtExpected={pickPointsAtExpected}
        roundId={roundId}
        kickEnabled={isHost}
        duelActive={pickPhase.picksLocked}
      />

      {userId && !meetupRegistered ? (
        <p className="text-xs text-[var(--muted)] rounded-lg border border-[var(--border)] px-3 py-2">
          Du nimmst am Treffen noch nicht teil. Tritt oben bei, um mitzustimmen.
        </p>
      ) : (
        <>
          <PickedGamesStrip
            games={myPickStrip}
            title={`Deine Picks für ${expected} Spieler ★`}
          />
          <MeetupVoteActions
            meetupId={meetupId}
            roundQuery={roundQuery}
            readyForDuels={pickPhase.readyForDuels}
          picksLocked={pickPhase.picksLocked}
          duelComplete={duelRoundComplete}
          pickPoolSize={pickPoolSize}
          fullPickCount={pickPhase.fullPickCount}
          expectedPlayerCount={pickPhase.expectedPlayerCount}
          poolSize={pickPhase.poolSize}
          duellLinkTitle={duellLinkTitle}
          hostForced={hostForced}
          hostForcedGameName={forcedGame?.name ?? null}
          hostChoiceMode={round.hostChoiceMode}
          />
        </>
      )}

      {duelRoundComplete && (
        <MeetupExpansionActions
          meetupId={meetupId}
          roundId={roundId}
          roundQuery={roundQuery}
          isHost={isHost}
          expansionDuelAvailable={expansionPhase.expansionDuelAvailable}
          expansionDuelStarted={expansionPhase.expansionDuelStarted}
          expansionDuelComplete={expansionPhase.expansionDuelComplete}
          winnerName={expansionPhase.winnerName}
          winnerFamily={winnerFamily}
          mandatoryKeys={mandatoryKeys}
          optionalExpansionCount={expansionPhase.optionalExpansionCount}
          winnerHasExpansionsAtStar={expansionPhase.winnerHasExpansionsAtStar}
        />
      )}

      <MeetupRankings
        key={`${roundId}:${expected}`}
        meetupId={roundId}
        expected={expected}
        playerCounts={playerCounts}
        combinedByCount={combinedByCount}
        duelComplete={duelComplete}
        completedCounts={completedCounts}
        duelPhase={duelPhase}
        groupDecidedPairs={groupDecidedPairs}
        totalPairs={totalPairs}
        finishedParticipants={finishedParticipants}
        totalParticipants={totalParticipants}
        isHost={isHost}
        expansionRanking={expansionRanking}
        expansionDuelComplete={expansionPhase.expansionDuelComplete}
        expansionRankingAvailable={expansionRankingAvailable}
        winnerName={expansionPhase.winnerName}
        hostForced={hostForced}
        hostForcedGameName={forcedGame?.name ?? null}
      />
    </div>
  );
}
