-- Entfernt den Legacy-Wert TINDER endgültig aus VoteMode.
-- Defensiv: vorhandene TINDER-Votes zuerst auf DUEL migrieren
-- (sollte durch 20260604130000_vote_mode_compat bereits geschehen sein).
UPDATE "Vote" SET mode = 'DUEL' WHERE mode::text = 'TINDER';

CREATE TYPE "VoteMode_new" AS ENUM ('PICK', 'DUEL', 'EXPANSION_DUEL');

ALTER TABLE "Vote" ALTER COLUMN "mode" TYPE "VoteMode_new" USING ("mode"::text::"VoteMode_new");

ALTER TYPE "VoteMode" RENAME TO "VoteMode_old";
ALTER TYPE "VoteMode_new" RENAME TO "VoteMode";
DROP TYPE "VoteMode_old";
