-- Migration: Advanced Messaging
-- Adds support for editing messages and starring messages

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- Add a column to track users who have starred the message
-- We use a UUID array to easily toggle a user's star without a full junction table for light workloads
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS starred_by UUID[] DEFAULT '{}';
