-- Product Boost Database Implementation

-- Update global PPC cost and add Zahidi balance to app settings
BEGIN;
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS zahidi_balance NUMERIC DEFAULT 0;

UPDATE public.app_settings 
SET ppc_cost = 15
WHERE id = 1;
COMMIT;

-- Create boosted products table
CREATE TABLE IF NOT EXISTS public.boosted_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    budget NUMERIC NOT NULL,
    amount_deducted NUMERIC NOT NULL DEFAULT 0,
    number_of_clicks INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'exhausted', 'paused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Click deduplication table
CREATE TABLE IF NOT EXISTS public.boost_clicks_log (
    boost_id UUID NOT NULL REFERENCES public.boosted_products(id) ON DELETE CASCADE,
    clicked_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (boost_id, clicked_by_user_id)
);

ALTER TABLE public.boosted_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read boosted_products" ON public.boosted_products FOR SELECT USING (true);
CREATE POLICY "Owner read/write boosted_products" ON public.boosted_products FOR ALL USING (user_id = auth.uid());

-- Service role access for RPC
CREATE POLICY "Service role full access on boost_clicks_log" ON public.boost_clicks_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Functions
CREATE OR REPLACE FUNCTION public.start_boost(
    p_user_id UUID,
    p_product_id UUID,
    p_budget NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_balance NUMERIC;
    v_cost NUMERIC;
BEGIN
    SELECT ppc_cost INTO v_cost FROM public.app_settings WHERE id = 1;
    IF v_cost IS NULL THEN v_cost := 15; END IF;

    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id;

    IF v_balance < v_cost THEN
        RAISE EXCEPTION 'Insufficient wallet balance to start boosting.';
    END IF;

    IF p_budget < v_cost THEN
         RAISE EXCEPTION 'Budget must be at least the cost of one click.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND owner_id = p_user_id) THEN
        RAISE EXCEPTION 'Product not found or not owned by user';
    END IF;
    
    -- Mark product as sponsored
    UPDATE public.products SET is_sponsored = TRUE, updated_at = NOW() WHERE id = p_product_id;

    -- Upsert boost
    IF EXISTS (SELECT 1 FROM public.boosted_products WHERE product_id = p_product_id AND user_id = p_user_id) THEN
        UPDATE public.boosted_products 
        SET budget = p_budget, status = 'active', updated_at = NOW() 
        WHERE product_id = p_product_id AND user_id = p_user_id;
    ELSE
        INSERT INTO public.boosted_products (user_id, product_id, budget, status)
        VALUES (p_user_id, p_product_id, p_budget, 'active');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.register_boost_click(
    p_product_id UUID,
    p_clicked_by_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_cost NUMERIC;
    v_balance NUMERIC;
    v_owner_id UUID;
    v_boost_id UUID;
    v_budget NUMERIC;
    v_spent NUMERIC;
    v_clicks INTEGER;
BEGIN
    -- Avoid self click
    SELECT owner_id INTO v_owner_id FROM public.products WHERE id = p_product_id;
    IF p_clicked_by_user_id = v_owner_id THEN
        RETURN; -- do nothing
    END IF;

    -- Get Boost details
    SELECT id, user_id, budget, amount_deducted, number_of_clicks 
    INTO v_boost_id, v_owner_id, v_budget, v_spent, v_clicks
    FROM public.boosted_products
    WHERE product_id = p_product_id AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN; -- not active or not boosted
    END IF;

    -- Try registering unique click log
    BEGIN
        INSERT INTO public.boost_clicks_log (boost_id, clicked_by_user_id)
        VALUES (v_boost_id, p_clicked_by_user_id);
    EXCEPTION WHEN unique_violation THEN
        RETURN; -- Already clicked
    END;

    -- Get cost
    SELECT ppc_cost INTO v_cost FROM public.app_settings WHERE id = 1;
    IF v_cost IS NULL THEN v_cost := 15; END IF;
    
    -- Check balance
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_owner_id FOR UPDATE;
    
    IF v_balance >= v_cost THEN
        -- Deduct from user wallet
        UPDATE public.profiles SET wallet_balance = wallet_balance - v_cost WHERE id = v_owner_id;
        
        -- Add to Zahidi account
        UPDATE public.app_settings SET zahidi_balance = COALESCE(zahidi_balance, 0) + v_cost WHERE id = 1;

        -- Record transaction in wallet_transactions
        INSERT INTO public.wallet_transactions (user_id, amount, type, source, reference, note)
        VALUES (v_owner_id, v_cost, 'debit', 'boost', v_boost_id::text, 'Boost Click Deduction');

        -- Update Boost record
        v_spent := v_spent + v_cost;
        v_clicks := v_clicks + 1;
        UPDATE public.boosted_products 
        SET amount_deducted = v_spent, number_of_clicks = v_clicks, updated_at = NOW() 
        WHERE id = v_boost_id;
        
        -- Check if exhausted (No funds left or Budget maxed)
        IF (v_balance - v_cost) < v_cost OR v_spent >= v_budget THEN
            UPDATE public.boosted_products SET status = 'exhausted' WHERE id = v_boost_id;
            UPDATE public.products SET is_sponsored = FALSE WHERE id = p_product_id;
        END IF;
    ELSE
        -- Mark as exhausted if not enough funds
        UPDATE public.boosted_products SET status = 'exhausted' WHERE id = v_boost_id;
        UPDATE public.products SET is_sponsored = FALSE WHERE id = p_product_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution
GRANT EXECUTE ON FUNCTION public.start_boost(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_boost_click(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_boost(UUID, UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_boost_click(UUID, UUID) TO service_role;
