-- Rollback Migration: 20261017000002_drop_users_phone_number_rollback.sql
-- Description: Re-add users.phone_number. Dropped values are not restored.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;

COMMIT;
