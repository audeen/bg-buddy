-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN "duelFrozenAt" TIMESTAMP(3),
ADD COLUMN "duelFrozenData" JSONB;
