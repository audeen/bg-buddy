-- Rename VoteMode TINDER to DUEL
CREATE TYPE "VoteMode_new" AS ENUM ('PICK', 'DUEL');

ALTER TABLE "Vote" ALTER COLUMN "mode" TYPE "VoteMode_new" USING (
  CASE "mode"::text
    WHEN 'TINDER' THEN 'DUEL'::"VoteMode_new"
    ELSE "mode"::text::"VoteMode_new"
  END
);

DROP TYPE "VoteMode";
ALTER TYPE "VoteMode_new" RENAME TO "VoteMode";
