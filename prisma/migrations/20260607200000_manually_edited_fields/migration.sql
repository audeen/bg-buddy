-- AlterTable
ALTER TABLE "Game" ADD COLUMN "manuallyEditedFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
