-- AlterTable
ALTER TABLE "Game" ADD COLUMN "addedToCollectionAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Game_addedToCollectionAt_idx" ON "Game"("addedToCollectionAt");
