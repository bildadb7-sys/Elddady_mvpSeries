-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Security Advisor Fixes
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Fix: RLS overly permissive expressions
-- Service role bypasses RLS naturally. We do not need an explicit policy
-- with USING(true) that triggers security warnings.
DROP POLICY IF EXISTS "Service Role full access to deleted posts" ON public.deleted_posts;

-- 2. Fix: pg_graphql introspection exposing tables to anon role.
-- Since the Elddady app forces authentication via <LandingPage />, the 'anon' role
-- does not legitimately query any tables. We can safely revoke SELECT from anon.
REVOKE SELECT ON public.wallet_transactions FROM anon;
REVOKE SELECT ON public.vrooms FROM anon;
REVOKE SELECT ON public.vroom_followers FROM anon;
REVOKE SELECT ON public.user_follows FROM anon;
REVOKE SELECT ON public.tags FROM anon;
REVOKE SELECT ON public.reports FROM anon;
REVOKE SELECT ON public.promotions FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_likes FROM anon;
REVOKE SELECT ON public.posts FROM anon;
REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.order_items FROM anon;
REVOKE SELECT ON public.mpesa_requests FROM anon;
REVOKE SELECT ON public.messages FROM anon;
REVOKE SELECT ON public.message_reactions FROM anon;
REVOKE SELECT ON public.escrow_balances FROM anon;
REVOKE SELECT ON public.disputes_detailed FROM anon;
REVOKE SELECT ON public.deleted_posts FROM anon;
REVOKE SELECT ON public.deleted_messages FROM anon;
REVOKE SELECT ON public.currency_rates FROM anon;
REVOKE SELECT ON public.currencies FROM anon;
REVOKE SELECT ON public.conversations FROM anon;
REVOKE SELECT ON public.conversation_participants FROM anon;
REVOKE SELECT ON public.comments FROM anon;
REVOKE SELECT ON public.comment_reactions FROM anon;
REVOKE SELECT ON public.boost_clicks_log FROM anon;
REVOKE SELECT ON public.bookmarks FROM anon;
REVOKE SELECT ON public.app_settings FROM anon;
REVOKE SELECT ON public.app_notifications FROM anon;
REVOKE SELECT ON public.boosted_products FROM anon;

-- Note: In PostgreSQL, if anon does not have SELECT privileges on a table,
-- pg_graphql will completely hide it from the GraphQL introspection schema.
