-- AlterTable
ALTER TABLE "Vote" ADD COLUMN "opponentGameId" INTEGER;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_opponentGameId_fkey" FOREIGN KEY ("opponentGameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
