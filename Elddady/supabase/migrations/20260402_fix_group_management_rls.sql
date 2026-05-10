-- ============================================================
-- Fix Group Management RLS Policies
-- Allows group owners and admins to:
--   1. Update is_admin on conversation_participants (make/revoke admin)
--   2. Delete members from conversation_participants (remove member)
--   3. Update conversations (group name, description, photo)
-- ============================================================

-- Helper function: returns true if the calling user is an owner or admin of a group conversation
CREATE OR REPLACE FUNCTION public.is_group_admin(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversations c
        LEFT JOIN public.conversation_participants cp
            ON cp.conversation_id = c.id AND cp.user_id = auth.uid()
        WHERE c.id = p_conversation_id
          AND c.is_group = true
          AND (c.owner_id = auth.uid() OR cp.is_admin = true)
    );
$$;

-- ----------------------------------------------------------------
-- conversation_participants: Policies
-- ----------------------------------------------------------------

-- Allow members to view all participants in their groups / DMs
DROP POLICY IF EXISTS "Members can view participants" ON public.conversation_participants;
CREATE POLICY "Members can view participants"
ON public.conversation_participants
FOR SELECT
USING (
    conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
);

-- Allow any authenticated user to join (INSERT themselves) into a conversation
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;
CREATE POLICY "Users can join conversations"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
);

-- Allow group admins/owners to UPDATE is_admin for any participant
DROP POLICY IF EXISTS "Admins can update participant roles" ON public.conversation_participants;
CREATE POLICY "Admins can update participant roles"
ON public.conversation_participants
FOR UPDATE
USING (
    is_group_admin(conversation_id)
)
WITH CHECK (
    is_group_admin(conversation_id)
);

-- Allow users to leave a group (delete their own row) OR admins to remove other members
DROP POLICY IF EXISTS "Members can leave or admins can remove" ON public.conversation_participants;
CREATE POLICY "Members can leave or admins can remove"
ON public.conversation_participants
FOR DELETE
USING (
    user_id = auth.uid()        -- leaving yourself
    OR is_group_admin(conversation_id) -- admin removing someone else
);

-- ----------------------------------------------------------------
-- conversations: Policies
-- ----------------------------------------------------------------

-- Allow participants to view their conversations
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
ON public.conversations
FOR SELECT
USING (
    id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
);

-- Allow any authenticated user to create a conversation
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow group owner or admin to update group info (name, description, photo)
DROP POLICY IF EXISTS "Admins can update group info" ON public.conversations;
CREATE POLICY "Admins can update group info"
ON public.conversations
FOR UPDATE
USING (
    -- Owner can always update
    owner_id = auth.uid()
    -- Admins can update group info
    OR is_group_admin(id)
)
WITH CHECK (
    owner_id = auth.uid() OR is_group_admin(id)
);

-- ----------------------------------------------------------------
-- messages: Basic Policies (if not exists)
-- ----------------------------------------------------------------

-- Allow participants to insert messages into their conversations
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
    conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
    OR sender_id IS NULL  -- System messages
);

-- Allow participants to read messages from their conversations
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages"
ON public.messages
FOR SELECT
USING (
    conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
);

-- ----------------------------------------------------------------
-- Enable RLS on all tables (safe to re-run)
-- ----------------------------------------------------------------
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
