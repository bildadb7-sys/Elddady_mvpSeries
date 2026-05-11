CREATE OR REPLACE FUNCTION public.create_secure_order(
    buyer_id UUID,
    seller_id UUID,
    amount_in_buyer_currency NUMERIC,
    buyer_currency_code TEXT,
    shipping_details JSONB,
    item_quantity INT,
    item_name TEXT,
    product_id UUID
) RETURNS UUID AS $$
DECLARE
    new_order_id UUID;
    buyer_current_balance NUMERIC;
    buyer_cur TEXT;
    seller_cur TEXT;
    escrow_amount_in_seller_currency NUMERIC;
    v_product_price NUMERIC;
    v_product_currency TEXT;
BEGIN
    -- 1. Get buyer balance
    SELECT wallet_balance, currency INTO buyer_current_balance, buyer_cur 
    FROM public.profiles WHERE id = buyer_id FOR UPDATE;

    -- Validate currency passed matches buyer wallet
    IF buyer_cur != buyer_currency_code THEN
        RAISE EXCEPTION 'Currency mismatch error.';
    END IF;

    -- 2. Check funds
    IF buyer_current_balance < amount_in_buyer_currency THEN
        RAISE EXCEPTION 'Insufficient Cashy Wallet funds.';
    END IF;

    -- 3. Deduct from buyer
    UPDATE public.profiles 
    SET wallet_balance = wallet_balance - amount_in_buyer_currency,
        updated_at = NOW()
    WHERE id = buyer_id;

    -- 4. Create Order
    INSERT INTO public.orders (buyer_id, seller_id, status, amount_paid, buyer_currency, shipping_address)
    VALUES (buyer_id, seller_id, 'Processing', amount_in_buyer_currency, buyer_currency_code, shipping_details)
    RETURNING id INTO new_order_id;

    -- 5. Track Escrow
    -- Convert strictly what the buyer paid into the seller's preferred currency for escrow storage.
    SELECT currency INTO seller_cur FROM public.profiles WHERE id = seller_id;
    escrow_amount_in_seller_currency := public.convert_currency(amount_in_buyer_currency, buyer_cur, seller_cur);

    INSERT INTO public.escrow_balances (order_id, seller_id, buyer_id, amount, currency, status)
    VALUES (new_order_id, seller_id, buyer_id, escrow_amount_in_seller_currency, seller_cur, 'Held');

    -- 6. Insert Order Items
    SELECT price, currency INTO v_product_price, v_product_currency FROM public.products WHERE id = product_id;
    
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase, currency)
    VALUES (new_order_id, product_id, item_quantity, COALESCE(v_product_price, amount_in_buyer_currency / NULLIF(item_quantity, 0)), COALESCE(v_product_currency, buyer_cur));

    RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

