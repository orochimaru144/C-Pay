-- Migration: 20260829000001_server_authoritative_transactions.sql
-- Description: Restrict transactions table writes to service_role for server-authoritative receipts.

BEGIN;

-- 1. Enable RLS on transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies on transactions
DROP POLICY IF EXISTS "transactions_select_participant" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_participant" ON transactions;
DROP POLICY IF EXISTS "transactions_update_participant" ON transactions;
DROP POLICY IF EXISTS "transactions_delete_participant" ON transactions;
DROP POLICY IF EXISTS "transactions_all_participant" ON transactions;
DROP POLICY IF EXISTS "transactions_service_all" ON transactions;

-- 3. Create SELECT policy for participants (authenticated users can read sent/received transactions)
CREATE POLICY "transactions_select_participant" ON transactions
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    from_address = current_wallet_address()
    OR to_address = current_wallet_address()
  )
);

-- 4. Create ALL policy for service_role (trusted backend / relayer / ingest worker)
CREATE POLICY "transactions_service_all" ON transactions
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 5. Explicitly grant and revoke permissions
REVOKE INSERT, UPDATE, DELETE ON transactions FROM anon, authenticated;
GRANT SELECT ON transactions TO authenticated;
GRANT ALL ON transactions TO service_role;

COMMIT;
