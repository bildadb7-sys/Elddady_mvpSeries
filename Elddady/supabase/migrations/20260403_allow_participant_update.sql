-- ============================================================
-- FIX: Allow participants to update their own read receipts
-- Run this in the Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "Allow update own row" ON public.conversation_participants;

CREATE POLICY "Allow update own row"
ON public.conversation_participants FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
