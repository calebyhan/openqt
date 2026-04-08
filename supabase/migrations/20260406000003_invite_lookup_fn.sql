-- Allows any authenticated user to look up a group by invite code.
-- SECURITY DEFINER bypasses the members-only RLS SELECT policy, which would
-- otherwise block non-members from finding a group they're trying to join.
CREATE OR REPLACE FUNCTION public.find_group_by_invite_code(code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name
  FROM public.groups g
  WHERE g.invite_code = code
    AND auth.uid() IS NOT NULL;
$$;
