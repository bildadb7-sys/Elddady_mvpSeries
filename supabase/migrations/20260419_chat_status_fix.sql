-- 20260419_chat_status_fix.sql

-- 1. Add status column to messages for Read Receipts
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'sent';

-- 2. Add an UPDATE policy for messages so that edits, deletes, stars, and status updates work.
-- Currently, there are only INSERT and SELECT policies on 'messages'.

DROP POLICY IF EXISTS "Allow participants to update messages" ON public.messages;
CREATE POLICY "Allow participants to update messages"
ON public.messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = public.messages.conversation_id
        AND cp.user_id = auth.uid()
    )
);

-- 3. Create helper RPC functions to safely and efficiently bulk-update receipt statuses
CREATE OR REPLACE FUNCTION mark_conversation_status(p_conversation_id UUID, p_status VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Update all messages in the conversation that were NOT sent by the current user
    -- and where the status is 'less' than the new status.
    -- Assuming progression: sent -> delivered -> read
    IF p_status = 'delivered' THEN
        UPDATE public.messages
        SET status = 'delivered'
        WHERE conversation_id = p_conversation_id 
          AND sender_id != auth.uid() 
          AND status = 'sent';
    ELSIF p_status = 'read' THEN
        UPDATE public.messages
        SET status = 'read'
        WHERE conversation_id = p_conversation_id 
          AND sender_id != auth.uid() 
          AND (status = 'sent' OR status = 'delivered');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
