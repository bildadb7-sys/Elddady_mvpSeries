-- ─────────────────────────────────────────────────────────────────────────────
-- Secure Wallet Withdrawal RPC
-- Prevents TOCTOU Race Conditions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.withdraw_wallet(
  user_uuid uuid,
  withdraw_amount numeric,
  w_method text,
  w_details text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_bal numeric;
  new_bal numeric;
BEGIN
  IF withdraw_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid withdrawal amount';
  END IF;

  -- Atomic Row Lock and Check
  SELECT wallet_balance INTO current_bal
  FROM public.profiles
  WHERE id = user_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF COALESCE(current_bal, 0) < withdraw_amount THEN
    RAISE EXCEPTION 'Insufficient funds: available % requested %', COALESCE(current_bal, 0), withdraw_amount;
  END IF;

  -- Deduct Balance
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - withdraw_amount
  WHERE id = user_uuid
  RETURNING wallet_balance INTO new_bal;

  -- Log Transaction securely
  INSERT INTO public.wallet_transactions (user_id, amount, type, source, reference, note)
  VALUES (user_uuid, withdraw_amount, 'debit', w_method, w_details, 'Wallet withdrawal');

  RETURN new_bal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_wallet(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_wallet(uuid, numeric, text, text) TO service_role;
