-- ============================================================
-- Migration: 20260410_escrow_security_fix.sql
-- Purpose:   Prevent the buyer-facing release_escrow RPC from
--            releasing funds for orders that are Disputed.
--            During a dispute ONLY the admin endpoints
--            (/api/admin/refund, /api/admin/release) may move escrow.
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_escrow(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
    escrow_rec  RECORD;
    order_status TEXT;
BEGIN
    -- Block if a dispute is active on this order
    SELECT status INTO order_status
    FROM public.orders
    WHERE id = order_uuid;

    IF order_status = 'Disputed' THEN
        RAISE EXCEPTION
            'Cannot confirm order %: a dispute is pending. '
            'Only an administrator may release or refund disputed escrow funds.',
            order_uuid;
    END IF;

    -- Fetch the held escrow entry
    SELECT * INTO escrow_rec
    FROM public.escrow_balances
    WHERE order_id = order_uuid AND status = 'Held'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pending escrow found for order %', order_uuid;
    END IF;

    -- 1. Credit seller
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + escrow_rec.amount,
        updated_at     = NOW()
    WHERE id = escrow_rec.seller_id;

    -- 2. Mark escrow released
    UPDATE public.escrow_balances
    SET status      = 'Released',
        released_at = NOW()
    WHERE id = escrow_rec.id;

    -- 3. Mark order completed
    UPDATE public.orders
    SET status     = 'Completed',
        updated_at = NOW()
    WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
