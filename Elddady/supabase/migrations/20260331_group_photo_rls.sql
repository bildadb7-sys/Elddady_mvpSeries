-- ============================================================
-- Allow GROUP ADMINS to update group_photo on conversations
-- ============================================================
-- The existing policy only allows the conversation owner (owner_id = auth.uid())
-- to UPDATE. This adds a second UPDATE policy for participants who are admins.

-- 1. Drop the old blanket UPDATE policy if it exists (rename to match yours if different)
-- DROP POLICY IF EXISTS "Conversation owner can update" ON public.conversations;

-- 2. Owner can update anything on their conversation (preserve existing behavior)
CREATE POLICY "Owner can update conversation"
ON public.conversations
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 3. Admins can update group_photo only
--    Checks that the current user has is_admin = true in conversation_participants
--    for this specific conversation.
CREATE POLICY "Group admins can update group_photo"
ON public.conversations
FOR UPDATE
USING (
  is_group = true
  AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
      AND cp.is_admin = true
  )
)
WITH CHECK (
  is_group = true
  AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
      AND cp.is_admin = true
  )
);
