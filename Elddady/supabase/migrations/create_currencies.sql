-- Run this in the Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS public.currencies (
    code VARCHAR(3) PRIMARY KEY,
    rate_to_usd NUMERIC NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so the app frontend can view rates without logging in)
CREATE POLICY "Allow public read access to currencies" 
ON public.currencies 
FOR SELECT 
USING (true);
