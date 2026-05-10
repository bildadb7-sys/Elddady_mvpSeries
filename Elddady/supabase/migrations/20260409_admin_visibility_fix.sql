-- Admin Visibility Fix: Update RLS policies to allow admins to see all records
-- For disputes_detailed, orders, and order_items

-- 1. Updates for orders
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (
    buyer_id = auth.uid() OR seller_id = auth.uid() OR (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- 2. Updates for order_items
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true))
);

-- 3. Updates for disputes_detailed
DROP POLICY IF EXISTS "disputes_select" ON public.disputes_detailed;
CREATE POLICY "disputes_select" ON public.disputes_detailed FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- 4. Updates for reports
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select" ON public.reports FOR SELECT USING (true);
