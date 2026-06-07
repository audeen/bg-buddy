-- AlterTable
ALTER TABLE "Game" ADD COLUMN "listedInCollection" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MeetupGuestGame" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupGuestGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetupGuestGame_meetupId_idx" ON "MeetupGuestGame"("meetupId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupGuestGame_meetupId_gameId_key" ON "MeetupGuestGame"("meetupId", "gameId");

-- AddForeignKey
ALTER TABLE "MeetupGuestGame" ADD CONSTRAINT "MeetupGuestGame_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupGuestGame" ADD CONSTRAINT "MeetupGuestGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupGuestGame" ADD CONSTRAINT "MeetupGuestGame_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
