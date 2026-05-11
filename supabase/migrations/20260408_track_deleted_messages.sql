-- Migration: Track Deleted Messages
-- Creates a history table for deleted messages to prevent permanent data loss
-- Adds a trigger to automatically archive deleted messages

CREATE TABLE IF NOT EXISTS deleted_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_message_id UUID NOT NULL,
    conversation_id UUID,
    sender_id UUID,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by UUID
);

-- Note: We only capture essential payload here. Add extra columns as needed.
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
        auth.uid() -- captures the user ID performing the deletion request
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_capture_deleted_message ON messages;
CREATE TRIGGER trg_capture_deleted_message
BEFORE DELETE ON messages
FOR EACH ROW EXECUTE FUNCTION capture_deleted_message();

-- Enable RLS and add basic security policy
ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read their own deleted messages"
  ON public.deleted_messages FOR SELECT
  TO authenticated
  USING (deleted_by = auth.uid());
