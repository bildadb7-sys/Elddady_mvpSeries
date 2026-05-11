-- Fix for Vroom Views and Followers to return the exact counts, and ensure they persist.

CREATE OR REPLACE FUNCTION increment_vroom_views(vroom_uuid UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_views BIGINT;
BEGIN
  UPDATE public.vrooms
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = vroom_uuid
  RETURNING views_count INTO new_views;
  
  RETURN new_views;
END;
$$;

CREATE OR REPLACE FUNCTION increment_vroom_followers(v_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_followers BIGINT;
BEGIN
  UPDATE public.vrooms
  SET followers_count = COALESCE(followers_count, 0) + 1
  WHERE id = v_id
  RETURNING followers_count INTO new_followers;
  
  RETURN new_followers;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_vroom_followers(v_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_followers BIGINT;
BEGIN
  UPDATE public.vrooms
  SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
  WHERE id = v_id
  RETURNING followers_count INTO new_followers;
  
  RETURN new_followers;
END;
$$;
