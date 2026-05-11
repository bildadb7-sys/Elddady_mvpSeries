-- Create table for storing deleted posts as an archive
CREATE TABLE IF NOT EXISTS public.deleted_posts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) on delete cascade,
    product_id UUID REFERENCES public.products(id) on delete cascade,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.deleted_posts ENABLE ROW LEVEL SECURITY;

-- Give standard read access if needed or only to admins
CREATE POLICY "Admins can view deleted posts" ON public.deleted_posts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    ) OR 
    -- Superadmin email / handle check fallback if is_admin is not relied upon
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.handle = '@elddadinc' OR profiles.email = 'eldady.inc@gmail.com')
    )
);

CREATE POLICY "Service Role full access to deleted posts" ON public.deleted_posts FOR ALL USING (true);
