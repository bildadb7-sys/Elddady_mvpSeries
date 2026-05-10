-- 20260409_fix_rls_security.sql
-- Fixes security linter warnings from Supabase

-- 1. Fix search_path on capture_deleted_message
CREATE OR REPLACE FUNCTION capture_deleted_message()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO deleted_messages (
        original_message_id,
        conversation_id,
        sender_id,
        content,
        image_url,
        created_at,
        deleted_by
    ) VALUES (
        OLD.id,
        OLD.conversation_id,
        OLD.sender_id,
        OLD.content,
        OLD.image_url,
        OLD.created_at,
        auth.uid()
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Enable RLS and add policy for deleted_messages
ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only select their own deleted messages" ON public.deleted_messages;
CREATE POLICY "Users can only select their own deleted messages"
  ON public.deleted_messages FOR SELECT
  TO authenticated
  USING (deleted_by = auth.uid());

-- 3. Fix wallet_transactions overly permissive "Service role" policy
DROP POLICY IF EXISTS "Service role full access on wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Service role full access on wallet_transactions"
  ON public.wallet_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Fix mpesa_requests overly permissive "Service role" policy
DROP POLICY IF EXISTS "Service role full access on mpesa_requests" ON public.mpesa_requests;
CREATE POLICY "Service role full access on mpesa_requests"
  ON public.mpesa_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
