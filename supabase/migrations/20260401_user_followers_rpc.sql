-- Missing RPCs for User Follow Syncing

CREATE OR REPLACE FUNCTION increment_user_followers(u_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE profiles
  SET followers_count = COALESCE(followers_count, 0) + 1
  WHERE id = u_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_user_followers(u_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE profiles
  SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
  WHERE id = u_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_user_following(u_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE profiles
  SET following_count = COALESCE(following_count, 0) + 1
  WHERE id = u_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_user_following(u_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE profiles
  SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
  WHERE id = u_id;
END;
$$;
