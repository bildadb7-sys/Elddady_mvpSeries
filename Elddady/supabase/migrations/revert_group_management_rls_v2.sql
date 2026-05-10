-- ============================================================
-- REVERT: Undo 20260402_fix_group_management_rls_v2.sql
-- Run this in Supabase SQL Editor to restore the messaging system.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Drop all policies created by the v2 migration
-- ----------------------------------------------------------------

-- conversation_participants
DROP POLICY IF EXISTS "Members can view participants"           ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations"            ON public.conversation_participants;
DROP POLICY IF EXISTS "Admins can update participant roles"     ON public.conversation_participants;
DROP POLICY IF EXISTS "Members can leave or admins can remove"  ON public.conversation_participants;

-- conversations
DROP POLICY IF EXISTS "Participants can view conversations"          ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can update group info"                 ON public.conversations;

-- messages
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;

-- ----------------------------------------------------------------
-- 2. Drop the helper function
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_group_admin(uuid);

-- ----------------------------------------------------------------
-- 3. Restore the original permissive policies that allowed
--    the messaging system to work
-- ----------------------------------------------------------------

-- conversation_participants
CREATE POLICY "Allow participants to view"
ON public.conversation_participants FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow insert for authenticated"
ON public.conversation_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow delete own row"
ON public.conversation_participants FOR DELETE
USING (user_id = auth.uid());

-- conversations
CREATE POLICY "Allow participants to view conversations"
ON public.conversations FOR SELECT
USING (
    id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Allow authenticated to create"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow owner to update"
ON public.conversations FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- messages
CREATE POLICY "Allow participants to read messages"
ON public.messages FOR SELECT
USING (
    conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Allow participants to send messages"
ON public.messages FOR INSERT
WITH CHECK (
    conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
);
