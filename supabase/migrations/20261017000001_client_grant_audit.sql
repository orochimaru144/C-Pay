-- Migration: 20261017000001_client_grant_audit.sql
-- Issue: #125 — the retired App/supabase_schema.sql granted EXECUTE on three
-- merchant functions (and INSERT/UPDATE on merchant_contact_verifications) to
-- authenticated. 20260828000001 drops those objects on a clean replay, but a
-- deployment provisioned from the schema file can still carry them.
--
-- This migration re-asserts the post-migration privilege state so that every
-- deployment converges on it, whatever it was provisioned from:
--
--   * no merchant function exists, and no merchant row is reachable by a client;
--   * anon (the public anon key) holds no privilege on any public table or RPC;
--   * wallet_bindings, the relayer's wallet-ownership source, is written only by
--     the relayer (service_role) — clients can read their own bindings;
--   * no client role holds TRUNCATE, which bypasses RLS.
--
-- Supabase's default privileges grant ALL on new public tables and EXECUTE on
-- new public functions to anon and authenticated, so "REVOKE ... FROM PUBLIC"
-- alone never removed anon's access. Every revoke below names the roles.
--
-- Idempotent: safe on a clean replay and on schema-file-provisioned projects.

BEGIN;

-- 1. Merchant functions. Dropping a function drops its grants with it.
DROP TRIGGER IF EXISTS update_merchant_totals_on_transactions ON transactions;
DROP FUNCTION IF EXISTS get_public_merchant_by_id(UUID);
DROP FUNCTION IF EXISTS get_public_merchant_by_address(TEXT);
DROP FUNCTION IF EXISTS get_own_merchant_by_wallet(TEXT);
DROP FUNCTION IF EXISTS update_merchant_totals_from_transaction();
DROP FUNCTION IF EXISTS refresh_merchant_totals(UUID);

-- 2. resolve_cpay_id: the schema-file version also returned active merchants.
--    Re-assert the users-only definition (CREATE OR REPLACE keeps its ACL).
CREATE OR REPLACE FUNCTION resolve_cpay_id(p_cpay_id TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  cpay_id TEXT,
  display_name TEXT,
  account_type TEXT
) AS $$
  SELECT u.wallet_address, u.cpay_id, u.display_name, 'user'::TEXT
  FROM users u
  WHERE lower(u.cpay_id) = lower(p_cpay_id)
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Merchant tables that survive on a schema-file deployment: not reachable by
--    any client role. They are left in place (not dropped) so their data can
--    still go through 20260828000001's preserve-then-drop path.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['merchants', 'merchant_qr_codes', 'merchant_contact_verifications'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;

  IF to_regclass('public.merchant_contact_verifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "merchant_contact_verifications_insert_own" ON merchant_contact_verifications;
    DROP POLICY IF EXISTS "merchant_contact_verifications_update_own" ON merchant_contact_verifications;
  END IF;
END $$;

-- 4. Client RPCs: authenticated only, never anon.
REVOKE ALL ON FUNCTION current_wallet_address() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_public_wallet_profile(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION resolve_cpay_id(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION current_wallet_address() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_wallet_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_cpay_id(TEXT) TO authenticated;

-- 5. wallet_bindings: the relayer (service_role) is the only writer. The
--    previous INSERT/UPDATE policies let a client bind any wallet address to
--    itself, bypassing /accounts/prepare's ownership and sponsorship checks.
DROP POLICY IF EXISTS "wallet_bindings_insert_own" ON wallet_bindings;
DROP POLICY IF EXISTS "wallet_bindings_update_own" ON wallet_bindings;

REVOKE ALL ON wallet_bindings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON wallet_bindings TO authenticated;
GRANT ALL ON wallet_bindings TO service_role;

-- 6. Client-facing tables: nothing for anon, no TRUNCATE (bypasses RLS), and
--    no DELETE on users (no DELETE policy exists and the app never deletes).
REVOKE ALL ON users FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON users FROM authenticated;

REVOKE ALL ON wallet_backups FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON wallet_backups FROM authenticated;

REVOKE ALL ON transactions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON transactions FROM authenticated;

-- 7. Service-only tables: re-assert, including PUBLIC.
REVOKE ALL ON add_money_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON relayer_idempotency_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON contract_intent_cache FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ingest_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON payment_records FROM PUBLIC, anon, authenticated;

COMMIT;
