-- Idempotent compat for prod DBs that still have TINDER or already migrated to DUEL-only.

ALTER TYPE "VoteMode" ADD VALUE IF NOT EXISTS 'DUEL';
ALTER TYPE "VoteMode" ADD VALUE IF NOT EXISTS 'TINDER';

UPDATE "Vote" SET mode = 'DUEL' WHERE mode::text = 'TINDER';
