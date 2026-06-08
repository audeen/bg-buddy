import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { ExpectedCountReadOnly } from "@/components/ExpectedCountReadOnly";
import { MeetupActionsMenu } from "@/components/MeetupActionsMenu";
import { MeetupShareQr } from "@/components/MeetupShareQr";
import { MeetupVoteActions } from "@/components/MeetupVoteActions";
import { MeetupExpansionActions } from "@/components/MeetupExpansionActions";
import { MeetupRankings } from "@/components/MeetupRankings";
import { MeetupParticipants } from "@/components/MeetupParticipants";
import { JoinMeetupButton } from "@/components/JoinMeetupButton";
import { MeetupSpielsteuerungClient } from "@/components/MeetupSpielsteuerungClient";
import { PageHeader } from "@/components/PageHeader";
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
  isUserRegistered,
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
import type { RankEntry } from "@/components/Ranking";

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
    include: {
      createdBy: { select: { id: true, name: true } },
      registrations: {
        include: { user: { select: { id: true, name: true } } },
      },
      guestGames: {
        include: {
          game: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      hostChoiceGames: {
        include: {
          game: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              image: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      hostForcedGame: {
        select: {
          id: true,
          name: true,
          thumbnail: true,
          image: true,
        },
      },
      mandatoryExpansions: {
        select: { baseGameId: true, expansionGameId: true },
      },
    },
  });
  if (!meetup) notFound();

  const guestGames = meetup.guestGames.map((g) => g.game);
  const hostChoiceGames = meetup.hostChoiceGames.map((g) => g.game);
  const forcedGame = meetup.hostForcedGame;
  const hostForced = meetup.hostForcedGameId != null;

  const votes = await prisma.vote.findMany({
    where: { meetupId: id },
    include: {
      game: {
        select: {
          id: true,
          name: true,
          thumbnail: true,
          image: true,
          bestPlayerCounts: true,
          rank: true,
          bggRating: true,
        },
      },
      user: { select: { name: true } },
    },
  });

  const combinedByCount = buildCombinedByCount(votes, id);
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
  const frozen = parseDuelFrozenData(meetup.duelFrozenData, expected);
  const poolIds = frozen?.poolGameIds ?? poolGameIds(pickCounts);
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

  const tieBreak =
    poolIds.length >= 2
      ? {
          meetupId: id,
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
    meetupId: id,
    tieBreak,
    frozen,
  });

  const duelRoundComplete =
    hostForced || (duelComplete && totalPairs > 0);
  const isHost = user?.id === meetup.createdBy.id;

  const expansionPhase = await loadExpansionPhaseState(id, expected, prisma);
  const winnerFamily =
    duelRoundComplete && expansionPhase.winnerGameId
      ? await loadWinnerExpansionFamily(expansionPhase.winnerGameId, expected)
      : null;
  const mandatoryKeys =
    expansionPhase.winnerGameId != null
      ? mandatoryExpansionKeysForWinner(
          meetup.mandatoryExpansions,
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
          minPlayers: true,
          maxPlayers: true,
        },
      }),
      prisma.vote.findMany({
        where: {
          meetupId: id,
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
        const frozen = parseExpansionDuelFrozenData(
          meetup.expansionDuelFrozenData,
          expected,
        );
        if (frozen && frozen.configs.length > 0) {
          const gamesById = new Map([
            [baseGame.id, baseGame],
            ...ownedExpansions.map((e) => [e.id, e] as const),
          ]);
          const covers = coverByVoteGameIdForConfigs(
            frozen.configs,
            gamesById,
            baseGame,
          );
          expansionRanking = buildExpansionRankingEntries(
            frozen.configs,
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

  const manualRegistrations = meetup.registrations.map((r) => ({
    userId: r.userId,
    name: r.user.name,
  }));

  const registeredPlayers = buildRegisteredPlayers(
    meetup.createdBy,
    pickVoters,
    manualRegistrations,
  );

  const pickPointsAtExpected = sumPickPointsAtExpected(
    votes
      .filter((v) => v.mode === "PICK")
      .map((v) => ({
        userId: v.userId,
        playerCount: v.playerCount,
        points: v.points,
      })),
    meetup.expectedPlayerCount,
  );

  const duelVoteCount = votes.filter(
    (v) => v.mode === "DUEL" || v.mode === "TINDER",
  ).length;
  const duelsStarted = duelVoteCount > 0;

  const isRegistered = user
    ? isUserRegistered(user.id, registeredPlayers)
    : false;
  const leaveAllowed = user
    ? canLeaveMeetup({
        isHost,
        isRegistered,
        duelsStarted,
      })
    : false;

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
    const countPickCounts = buildPickCounts(countPicks);
    const countTieBreak =
      countPool.length >= 2
        ? {
            meetupId: id,
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
    const countFrozen = parseDuelFrozenData(meetup.duelFrozenData, pc);
    return getDuelProgressForCount(countPool, countDuels, pc, {
      picks: countPicks,
      meetupId: id,
      tieBreak: countTieBreak,
      frozen: countFrozen,
    }).duelComplete;
  });

  return (
    <div className="container-app flex flex-col gap-6">
      <PageHeader id="meetup-page-top" eyebrow="Treffen" title={meetup.title}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-[var(--muted)]">
            {formatDate(meetup.scheduledAt)}
            {meetup.location ? ` · ${meetup.location}` : ""} · von{" "}
            {meetup.createdBy.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <MeetupShareQr meetupId={meetup.id} title={meetup.title} />
            {user && (
              <MeetupActionsMenu meetupId={meetup.id} title={meetup.title} />
            )}
          </div>
        </div>
      </PageHeader>

      <div className="card flex flex-col gap-4" style={{ padding: "var(--space-card)" }}>
        {isHost ? (
          <>
            <ExpectedCountControl
              key={meetup.expectedPlayerCount}
              meetupId={meetup.id}
              value={meetup.expectedPlayerCount}
            />
            <MeetupSpielsteuerungClient
              meetupId={meetup.id}
              forcedGame={forcedGame}
              hostChoiceGames={hostChoiceGames}
              hostChoiceMode={meetup.hostChoiceMode}
              guestGames={guestGames}
            />
          </>
        ) : (
          <ExpectedCountReadOnly count={meetup.expectedPlayerCount} />
        )}
        <MeetupParticipants
          expected={meetup.expectedPlayerCount}
          players={registeredPlayers}
          pickPointsAtExpected={pickPointsAtExpected}
          meetupId={meetup.id}
          kickEnabled={isHost}
          duelActive={pickPhase.picksLocked}
        />
        {user && (
          <JoinMeetupButton
            meetupId={meetup.id}
            isLoggedIn
            isRegistered={isRegistered}
            canLeave={leaveAllowed}
          />
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
          hostForced={hostForced}
          hostForcedGameName={forcedGame?.name ?? null}
          hostChoiceMode={meetup.hostChoiceMode}
        />
        {duelRoundComplete && (
          <MeetupExpansionActions
            meetupId={meetup.id}
            isHost={isHost}
            expansionDuelAvailable={expansionPhase.expansionDuelAvailable}
            expansionDuelStarted={expansionPhase.expansionDuelStarted}
            expansionDuelComplete={expansionPhase.expansionDuelComplete}
            winnerName={expansionPhase.winnerName}
            winnerFamily={winnerFamily}
            mandatoryKeys={mandatoryKeys}
            optionalExpansionCount={expansionPhase.optionalExpansionCount}
            winnerHasExpansionsAtStar={
              expansionPhase.winnerHasExpansionsAtStar
            }
          />
        )}
      </div>

      <MeetupRankings
        key={expected}
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
