-- Manuelles Cover-Override pro Spiel
ALTER TABLE "Game" ADD COLUMN "coverUrl" TEXT;

-- Eigenes hochgeladenes Cover-Bild
CREATE TABLE "GameCoverImage" (
    "gameId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCoverImage_pkey" PRIMARY KEY ("gameId")
);

ALTER TABLE "GameCoverImage" ADD CONSTRAINT "GameCoverImage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
