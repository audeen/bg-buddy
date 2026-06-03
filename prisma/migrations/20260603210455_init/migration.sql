-- CreateEnum
CREATE TYPE "VoteMode" AS ENUM ('PICK', 'TINDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "description" TEXT,
    "image" TEXT,
    "thumbnail" TEXT,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "playingTime" INTEGER,
    "minPlaytime" INTEGER,
    "maxPlaytime" INTEGER,
    "weight" DOUBLE PRECISION,
    "bggRating" DOUBLE PRECISION,
    "rank" INTEGER,
    "ageRange" TEXT,
    "languageDependence" TEXT,
    "isExpansion" BOOLEAN NOT NULL DEFAULT false,
    "categories" TEXT[],
    "mechanics" TEXT[],
    "bestPlayerCounts" INTEGER[],
    "recommendedPlayerCounts" INTEGER[],
    "enriched" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meetup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "location" TEXT,
    "expectedPlayerCount" INTEGER NOT NULL DEFAULT 4,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "mode" "VoteMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE INDEX "Vote_meetupId_playerCount_idx" ON "Vote"("meetupId", "playerCount");

-- CreateIndex
CREATE INDEX "Vote_meetupId_gameId_playerCount_idx" ON "Vote"("meetupId", "gameId", "playerCount");

-- AddForeignKey
ALTER TABLE "Meetup" ADD CONSTRAINT "Meetup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
