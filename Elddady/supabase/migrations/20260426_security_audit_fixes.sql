-- ─────────────────────────────────────────────────────────────────────────────
-- Comprehensive Security Audit Fixes
-- ─────────────────────────────────────────────────────────────────────────────

-- ==============================================================================
-- 1. Fix: Data Exposure Vulnerability in `reports`
-- 
-- The `reports` table previously had a policy:
-- `CREATE POLICY "reports_select" ON public.reports FOR SELECT USING (true);`
-- This allowed ANY authenticated user to read all reports, leaking who reported whom.
-- By securing it, only the user who created the report OR a designated admin can see it.
-- ==============================================================================

DROP POLICY IF EXISTS "reports_select" ON public.reports;
-- If the older policy named "Enable read access for all users" still exists from the RPC migration, safely drop it too:
DROP POLICY IF EXISTS "Enable read access for all users" ON public.reports;

CREATE POLICY "Secure reports select" 
ON public.reports 
FOR SELECT 
TO authenticated 
USING (
    reporter_id = auth.uid() 
    OR 
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- ==============================================================================
-- 2. Clean Up: Redundant Service Role Misconfigurations
-- 
-- The `service_role` inherently bypasses Row Level Security.
-- Explicitly creating a policy for the `service_role` using `USING (true)` 
-- triggers cloud security warnings in Supabase because it appears to be a 
-- globally open policy.
--
-- We safely drop these without impacting backend functionality since the 
-- backend operates using the SUPABASE_SERVICE_ROLE_KEY.
-- ==============================================================================

DROP POLICY IF EXISTS "Service role full access on wallet_transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Service role full access on mpesa_requests" ON public.mpesa_requests;
DROP POLICY IF EXISTS "Service role full access on boost_clicks_log" ON public.boost_clicks_log;
