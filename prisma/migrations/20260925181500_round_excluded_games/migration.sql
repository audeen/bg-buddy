-- CreateTable
CREATE TABLE "MeetupExcludedGame" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupExcludedGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetupExcludedGame_roundId_idx" ON "MeetupExcludedGame"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupExcludedGame_roundId_gameId_key" ON "MeetupExcludedGame"("roundId", "gameId");

-- AddForeignKey
ALTER TABLE "MeetupExcludedGame" ADD CONSTRAINT "MeetupExcludedGame_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "MeetupRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupExcludedGame" ADD CONSTRAINT "MeetupExcludedGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
