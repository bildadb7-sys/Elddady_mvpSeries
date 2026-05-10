-- ─────────────────────────────────────────────────────────────────────────────
-- MPesa Wallet Integration Migration
-- Creates:
--   1. wallet_transactions  — audit log of all wallet credits/debits
--   2. mpesa_requests       — persists checkoutRequestId→userId so callbacks
--                             can credit the wallet even if Redis is down
--   3. fund_wallet()        — RPC to safely credit a user's wallet balance
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Wallet transaction log
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        numeric     NOT NULL,
  type          text        NOT NULL CHECK (type IN ('credit', 'debit')),
  source        text        NOT NULL DEFAULT 'mpesa',
  reference     text,                      -- CheckoutRequestID or order ID
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (used by the API server) can do everything
CREATE POLICY "Service role full access on wallet_transactions"
  ON public.wallet_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. MPesa request tracking table (fallback for when Redis is unavailable)
CREATE TABLE IF NOT EXISTS public.mpesa_requests (
  checkout_request_id  text        PRIMARY KEY,
  user_id              uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount               numeric,
  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz
);

ALTER TABLE public.mpesa_requests ENABLE ROW LEVEL SECURITY;

-- Only service role (API server) accesses this table
CREATE POLICY "Service role full access on mpesa_requests"
  ON public.mpesa_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own requests (for polling from client)
CREATE POLICY "Users can view their own mpesa requests"
  ON public.mpesa_requests FOR SELECT
  USING (auth.uid() = user_id);

-- 3. fund_wallet() RPC — atomically credits the wallet and logs the transaction
CREATE OR REPLACE FUNCTION public.fund_wallet(
  user_uuid   uuid,
  amount      numeric,
  reference   text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  -- Atomic increment of wallet_balance on the profiles table
  UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + amount
  WHERE id = user_uuid
  RETURNING wallet_balance INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', user_uuid;
  END IF;

  -- Log the transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, source, reference, note)
  VALUES (user_uuid, amount, 'credit', 'mpesa', reference, 'MPesa STK Push deposit');

  -- Mark the mpesa_request as completed (if it exists)
  IF reference IS NOT NULL THEN
    UPDATE public.mpesa_requests
      SET status = 'completed', completed_at = now()
    WHERE checkout_request_id = reference AND status = 'pending';
  END IF;

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fund_wallet(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_wallet(uuid, numeric, text) TO service_role;
