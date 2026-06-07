-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN "initialExpectedPlayerCount" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Meetup" ADD COLUMN "registrationPeakCount" INTEGER NOT NULL DEFAULT 1;

-- Backfill from existing expectedPlayerCount
UPDATE "Meetup" SET "initialExpectedPlayerCount" = "expectedPlayerCount";

-- CreateTable
CREATE TABLE "MeetupRegistration" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetupRegistration_meetupId_idx" ON "MeetupRegistration"("meetupId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupRegistration_meetupId_userId_key" ON "MeetupRegistration"("meetupId", "userId");

-- AddForeignKey
ALTER TABLE "MeetupRegistration" ADD CONSTRAINT "MeetupRegistration_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupRegistration" ADD CONSTRAINT "MeetupRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
