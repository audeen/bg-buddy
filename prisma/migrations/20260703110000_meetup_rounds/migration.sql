-- Spielrunden: Der komplette Abstimmungs-Zustand wandert vom Meetup in eine
-- neue Entitaet MeetupRound. Jedes bestehende Treffen erhaelt genau eine
-- Default-Runde (id = 'rnd_' || meetup.id), so dass sich fuer bestehende Daten
-- nichts aendert.

-- CreateTable MeetupRound
CREATE TABLE "MeetupRound" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "label" TEXT,
    "startsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "expectedPlayerCount" INTEGER NOT NULL DEFAULT 4,
    "initialExpectedPlayerCount" INTEGER NOT NULL DEFAULT 4,
    "registrationPeakCount" INTEGER NOT NULL DEFAULT 1,
    "duelFrozenAt" TIMESTAMP(3),
    "duelFrozenData" JSONB,
    "expansionDuelStartedAt" TIMESTAMP(3),
    "expansionDuelFrozenData" JSONB,
    "hostForcedGameId" INTEGER,
    "hostForcedAt" TIMESTAMP(3),
    "hostChoiceMode" "HostChoiceMode" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable MeetupRoundParticipant
CREATE TABLE "MeetupRoundParticipant" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupRoundParticipant_pkey" PRIMARY KEY ("id")
);

-- Backfill: eine Default-Runde pro Treffen (deterministische id).
INSERT INTO "MeetupRound" (
    "id", "meetupId", "label", "startsAt", "sortOrder",
    "expectedPlayerCount", "initialExpectedPlayerCount", "registrationPeakCount",
    "duelFrozenAt", "duelFrozenData", "expansionDuelStartedAt", "expansionDuelFrozenData",
    "hostForcedGameId", "hostForcedAt", "hostChoiceMode", "createdAt"
)
SELECT
    'rnd_' || m."id", m."id", NULL, m."scheduledAt", 0,
    m."expectedPlayerCount", m."initialExpectedPlayerCount", m."registrationPeakCount",
    m."duelFrozenAt", m."duelFrozenData", m."expansionDuelStartedAt", m."expansionDuelFrozenData",
    m."hostForcedGameId", m."hostForcedAt", m."hostChoiceMode", m."createdAt"
FROM "Meetup" m;

-- Backfill: bestehende Meetup-Anmeldungen werden Teilnehmer der Default-Runde.
INSERT INTO "MeetupRoundParticipant" ("id", "roundId", "userId", "createdAt")
SELECT gen_random_uuid()::text, 'rnd_' || r."meetupId", r."userId", r."createdAt"
FROM "MeetupRegistration" r;

-- CreateIndex
CREATE INDEX "MeetupRound_meetupId_idx" ON "MeetupRound"("meetupId");
CREATE INDEX "MeetupRoundParticipant_roundId_idx" ON "MeetupRoundParticipant"("roundId");
CREATE UNIQUE INDEX "MeetupRoundParticipant_roundId_userId_key" ON "MeetupRoundParticipant"("roundId", "userId");

-- AddForeignKey
ALTER TABLE "MeetupRound" ADD CONSTRAINT "MeetupRound_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetupRound" ADD CONSTRAINT "MeetupRound_hostForcedGameId_fkey" FOREIGN KEY ("hostForcedGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetupRoundParticipant" ADD CONSTRAINT "MeetupRoundParticipant_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MeetupRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetupRoundParticipant" ADD CONSTRAINT "MeetupRoundParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vote: meetupId -> roundId
ALTER TABLE "Vote" ADD COLUMN "roundId" TEXT;
UPDATE "Vote" SET "roundId" = 'rnd_' || "meetupId";
ALTER TABLE "Vote" ALTER COLUMN "roundId" SET NOT NULL;
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_meetupId_fkey";
DROP INDEX "Vote_meetupId_playerCount_idx";
DROP INDEX "Vote_meetupId_gameId_playerCount_idx";
ALTER TABLE "Vote" DROP COLUMN "meetupId";
CREATE INDEX "Vote_roundId_playerCount_idx" ON "Vote"("roundId", "playerCount");
CREATE INDEX "Vote_roundId_gameId_playerCount_idx" ON "Vote"("roundId", "gameId", "playerCount");
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MeetupRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MeetupHostChoiceGame: meetupId -> roundId
ALTER TABLE "MeetupHostChoiceGame" ADD COLUMN "roundId" TEXT;
UPDATE "MeetupHostChoiceGame" SET "roundId" = 'rnd_' || "meetupId";
ALTER TABLE "MeetupHostChoiceGame" ALTER COLUMN "roundId" SET NOT NULL;
ALTER TABLE "MeetupHostChoiceGame" DROP CONSTRAINT "MeetupHostChoiceGame_meetupId_fkey";
DROP INDEX "MeetupHostChoiceGame_meetupId_idx";
DROP INDEX "MeetupHostChoiceGame_meetupId_gameId_key";
ALTER TABLE "MeetupHostChoiceGame" DROP COLUMN "meetupId";
CREATE INDEX "MeetupHostChoiceGame_roundId_idx" ON "MeetupHostChoiceGame"("roundId");
CREATE UNIQUE INDEX "MeetupHostChoiceGame_roundId_gameId_key" ON "MeetupHostChoiceGame"("roundId", "gameId");
ALTER TABLE "MeetupHostChoiceGame" ADD CONSTRAINT "MeetupHostChoiceGame_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MeetupRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MeetupMandatoryExpansion: meetupId -> roundId
ALTER TABLE "MeetupMandatoryExpansion" ADD COLUMN "roundId" TEXT;
UPDATE "MeetupMandatoryExpansion" SET "roundId" = 'rnd_' || "meetupId";
ALTER TABLE "MeetupMandatoryExpansion" ALTER COLUMN "roundId" SET NOT NULL;
ALTER TABLE "MeetupMandatoryExpansion" DROP CONSTRAINT "MeetupMandatoryExpansion_meetupId_fkey";
DROP INDEX "MeetupMandatoryExpansion_meetupId_baseGameId_idx";
DROP INDEX "MeetupMandatoryExpansion_meetupId_baseGameId_expansionGameId_key";
ALTER TABLE "MeetupMandatoryExpansion" DROP COLUMN "meetupId";
CREATE INDEX "MeetupMandatoryExpansion_roundId_baseGameId_idx" ON "MeetupMandatoryExpansion"("roundId", "baseGameId");
CREATE UNIQUE INDEX "MeetupMandatoryExpansion_roundId_baseGameId_expansionGameId_key" ON "MeetupMandatoryExpansion"("roundId", "baseGameId", "expansionGameId");
ALTER TABLE "MeetupMandatoryExpansion" ADD CONSTRAINT "MeetupMandatoryExpansion_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MeetupRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meetup: verschobene Felder entfernen
ALTER TABLE "Meetup" DROP CONSTRAINT "Meetup_hostForcedGameId_fkey";
ALTER TABLE "Meetup"
    DROP COLUMN "expectedPlayerCount",
    DROP COLUMN "initialExpectedPlayerCount",
    DROP COLUMN "registrationPeakCount",
    DROP COLUMN "duelFrozenAt",
    DROP COLUMN "duelFrozenData",
    DROP COLUMN "expansionDuelStartedAt",
    DROP COLUMN "expansionDuelFrozenData",
    DROP COLUMN "hostForcedGameId",
    DROP COLUMN "hostForcedAt",
    DROP COLUMN "hostChoiceMode";
