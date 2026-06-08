-- AlterEnum
ALTER TYPE "VoteMode" ADD VALUE 'EXPANSION_DUEL';

-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN "expansionDuelStartedAt" TIMESTAMP(3),
ADD COLUMN "expansionDuelFrozenData" JSONB;

-- CreateTable
CREATE TABLE "MeetupMandatoryExpansion" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "baseGameId" INTEGER NOT NULL,
    "expansionGameId" INTEGER NOT NULL,

    CONSTRAINT "MeetupMandatoryExpansion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetupMandatoryExpansion_meetupId_baseGameId_idx" ON "MeetupMandatoryExpansion"("meetupId", "baseGameId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupMandatoryExpansion_meetupId_baseGameId_expansionGameId_key" ON "MeetupMandatoryExpansion"("meetupId", "baseGameId", "expansionGameId");

-- AddForeignKey
ALTER TABLE "MeetupMandatoryExpansion" ADD CONSTRAINT "MeetupMandatoryExpansion_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
