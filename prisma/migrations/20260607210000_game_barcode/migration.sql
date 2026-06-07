ALTER TABLE "Game" ADD COLUMN "barcode" TEXT;

CREATE UNIQUE INDEX "Game_barcode_key" ON "Game"("barcode");
