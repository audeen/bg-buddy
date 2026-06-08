-- CreateEnum
CREATE TYPE "HostChoiceMode" AS ENUM ('NONE', 'HIGHLIGHT', 'RESTRICT');

-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN "hostForcedGameId" INTEGER,
ADD COLUMN "hostForcedAt" TIMESTAMP(3),
ADD COLUMN "hostChoiceMode" "HostChoiceMode" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "MeetupHostChoiceGame" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupHostChoiceGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetupHostChoiceGame_meetupId_idx" ON "MeetupHostChoiceGame"("meetupId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupHostChoiceGame_meetupId_gameId_key" ON "MeetupHostChoiceGame"("meetupId", "gameId");

-- AddForeignKey
ALTER TABLE "Meetup" ADD CONSTRAINT "Meetup_hostForcedGameId_fkey" FOREIGN KEY ("hostForcedGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupHostChoiceGame" ADD CONSTRAINT "MeetupHostChoiceGame_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupHostChoiceGame" ADD CONSTRAINT "MeetupHostChoiceGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
