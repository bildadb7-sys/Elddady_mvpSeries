-- 20260419_storage_and_rpc_security_fix.sql

-- 1. Fix RPC search_path vulnerability
ALTER FUNCTION public.mark_conversation_status(UUID, VARCHAR) SET search_path = public;

-- 2. Restrict public bucket listing enumeration 
--    (These changes do not impact public URL image visibility for `getPublicUrl`, 
--     but prevent arbitrary selection across the `storage.objects` table)

-- Avatars
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
CREATE POLICY "Users can only view their own avatars list" ON storage.objects 
FOR SELECT USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Banners
DROP POLICY IF EXISTS "Public banners are viewable by everyone" ON storage.objects;
CREATE POLICY "Users can only view their own banners list" ON storage.objects 
FOR SELECT USING (bucket_id = 'banners' AND auth.uid() = owner);

-- Products
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON storage.objects;
CREATE POLICY "Users can only view their own products list" ON storage.objects 
FOR SELECT USING (bucket_id = 'products' AND auth.uid() = owner);
