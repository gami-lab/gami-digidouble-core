-- 002_avatar_adjustments.sql
-- Adds the adjustments column to avatars so that creation-time persona style
-- adjustments are persisted and survive server restarts.
-- adjustments is an ordered list of strings appended to the assembled persona prompt.

ALTER TABLE avatars ADD COLUMN IF NOT EXISTS adjustments TEXT[];
