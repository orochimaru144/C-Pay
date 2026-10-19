-- Migration: 20261017000002_drop_users_phone_number.sql
-- Issue: #126 — auth is email-only. The phone-OTP flow that populated
-- users.phone_number was removed (original #15), and no client or relayer code
-- path produces a phone number any more. The column only held legacy pilot PII.
--
-- Rollout Order:
--   1. Ship the App update that stops selecting/upserting users.phone_number
--      (ConfirmPIN, ProfileSetup, EmailVerification, cpayId). Older builds send
--      phone_number in their users upsert and would fail against this schema.
--   2. Apply this migration once that build is the minimum supported version.
--
-- Irreversible for data: the rollback re-adds the column empty.

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS phone_number;

COMMIT;
