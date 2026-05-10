-- Promotions and Ads Logic
CREATE OR REPLACE FUNCTION public.start_promotion(
    p_user_id UUID,
    p_item_type TEXT,
    p_item_id UUID
) RETURNS VOID AS $$
DECLARE
    v_balance NUMERIC;
    v_cost NUMERIC;
BEGIN
    -- Validate item_type
    IF p_item_type NOT IN ('product', 'vroom') THEN
        RAISE EXCEPTION 'Invalid item_type. Must be product or vroom';
    END IF;

    -- Check if user has enough balance to even start (e.g. at least 1 click cost)
    SELECT ppc_cost INTO v_cost FROM public.app_settings WHERE id = 1;
    IF v_cost IS NULL THEN v_cost := 1.0; END IF;
    
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id;
    IF v_balance < v_cost THEN
        RAISE EXCEPTION 'Insufficient balance to start a promotion.';
    END IF;

    -- Verify ownership and Update the item
    IF p_item_type = 'product' THEN
        IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_item_id AND owner_id = p_user_id) THEN
            RAISE EXCEPTION 'Product not found or not owned by user';
        END IF;
        UPDATE public.products SET is_sponsored = TRUE, updated_at = NOW() WHERE id = p_item_id;
    ELSIF p_item_type = 'vroom' THEN
        IF NOT EXISTS (SELECT 1 FROM public.vrooms WHERE id = p_item_id AND owner_id = p_user_id) THEN
            RAISE EXCEPTION 'Vroom not found or not owned by user';
        END IF;
        UPDATE public.vrooms SET is_sponsored = TRUE, updated_at = NOW() WHERE id = p_item_id;
    END IF;

    -- Upsert promotion record
    IF EXISTS (SELECT 1 FROM public.promotions WHERE item_type = p_item_type AND item_id = p_item_id) THEN
        UPDATE public.promotions SET status = 'active' WHERE item_type = p_item_type AND item_id = p_item_id;
    ELSE
        INSERT INTO public.promotions (user_id, item_type, item_id, total_clicks, status)
        VALUES (p_user_id, p_item_type, p_item_id, 0, 'active');
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.register_ad_click(
    p_seller_id UUID,
    p_item_type TEXT,
    p_item_id UUID
) RETURNS VOID AS $$
DECLARE
    v_cost NUMERIC;
    v_balance NUMERIC;
BEGIN
    -- Get cost
    SELECT ppc_cost INTO v_cost FROM public.app_settings WHERE id = 1;
    IF v_cost IS NULL THEN v_cost := 1.0; END IF;
    
    -- Check user balance
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_seller_id FOR UPDATE;
    
    IF v_balance >= v_cost THEN
        -- Deduct balance
        UPDATE public.profiles SET wallet_balance = wallet_balance - v_cost WHERE id = p_seller_id;
        
        -- Increment clicks
        UPDATE public.promotions SET total_clicks = total_clicks + 1 WHERE item_type = p_item_type AND item_id = p_item_id;
        
        -- Check if exhausted now
        IF (v_balance - v_cost) < v_cost THEN
            UPDATE public.promotions SET status = 'exhausted' WHERE item_type = p_item_type AND item_id = p_item_id;
            IF p_item_type = 'product' THEN
                UPDATE public.products SET is_sponsored = FALSE WHERE id = p_item_id;
            ELSIF p_item_type = 'vroom' THEN
                UPDATE public.vrooms SET is_sponsored = FALSE WHERE id = p_item_id;
            END IF;
        END IF;
    ELSE
        -- Mark as exhausted if not enough funds
        UPDATE public.promotions SET status = 'exhausted' WHERE item_type = p_item_type AND item_id = p_item_id;
        IF p_item_type = 'product' THEN
            UPDATE public.products SET is_sponsored = FALSE WHERE id = p_item_id;
        ELSIF p_item_type = 'vroom' THEN
            UPDATE public.vrooms SET is_sponsored = FALSE WHERE id = p_item_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

ALTER FUNCTION public.start_promotion(UUID, TEXT, UUID) SET search_path = '';
ALTER FUNCTION public.register_ad_click(UUID, TEXT, UUID) SET search_path = '';
