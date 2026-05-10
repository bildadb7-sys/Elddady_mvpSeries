-- Enable Realtime for messages table
-- Run this in your Supabase SQL Editor

-- First, check if realtime publication exists
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Also enable for conversations and profiles if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

-- Verify the setup
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('messages', 'conversations', 'profiles', 'conversation_participants')
    AND has_table_privilege('public', tablename, 'INSERT');

-- Check RLS policies are working
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('messages', 'conversations', 'profiles', 'conversation_participants');
