-- Add visible_to column to messages table.
-- When NULL, the message is visible to all conversation participants (default behavior).
-- When set to a user UUID, ONLY that user can see the message.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS visible_to UUID REFERENCES auth.users(id);

-- Update RLS: participants can only see messages that are either:
--   (a) visible to everyone (visible_to IS NULL), or
--   (b) specifically targeted at them (visible_to = auth.uid())
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT
USING (
    conversation_id IN (
        SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
    AND (visible_to IS NULL OR visible_to = auth.uid())
);
