-- 20260426_admin_messaging.sql

CREATE OR REPLACE FUNCTION send_admin_message_to_user(p_recipient_id UUID, p_content TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_conversation_id UUID;
BEGIN
    -- 1. Find the Super Admin by handle or email
    SELECT id INTO v_admin_id FROM public.profiles 
    WHERE lower(handle) = '@elddadinc' OR lower(email) = 'eldady.inc@gmail.com' 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Super admin @elddadinc not found in the database. Cannot send message.';
    END IF;

    -- Avoid sending direct messages to self
    IF v_admin_id = p_recipient_id THEN
        RETURN;
    END IF;

    -- 2. Find existing direct conversation between admin and recipient
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.is_group = false 
      AND cp1.user_id = v_admin_id 
      AND cp2.user_id = p_recipient_id
    LIMIT 1;

    -- 3. If no conversation, create one
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations(is_group) VALUES (false) RETURNING id INTO v_conversation_id;
        
        INSERT INTO conversation_participants(conversation_id, user_id) VALUES 
        (v_conversation_id, v_admin_id),
        (v_conversation_id, p_recipient_id);
    END IF;

    -- 4. Send the message from the admin
    INSERT INTO messages(conversation_id, sender_id, content) 
    VALUES (v_conversation_id, v_admin_id, p_content);

    -- 5. Update conversation timestamp
    UPDATE conversations SET last_message_at = now() WHERE id = v_conversation_id;

END;
$$;
