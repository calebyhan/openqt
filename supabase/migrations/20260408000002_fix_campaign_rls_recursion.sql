-- Fix infinite RLS recursion between campaigns and campaign_groups.
--
-- The cycle:
--   campaigns SELECT policy → queries campaign_groups
--   campaign_groups policy  → queries campaigns (triggers campaigns RLS again)
--
-- Fix: introduce a SECURITY DEFINER helper that bypasses RLS when checking
-- campaigns.created_by, then use it in the campaign_groups policy.

CREATE OR REPLACE FUNCTION public.is_campaign_creator(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = p_campaign_id AND created_by = auth.uid()
  );
$$;

-- Replace the campaign_groups policy to use the helper instead of a direct
-- subquery on campaigns (which would re-enter campaigns RLS).
DROP POLICY IF EXISTS "campaign_groups: campaign creator can manage" ON public.campaign_groups;

CREATE POLICY "campaign_groups: campaign creator can manage"
  ON public.campaign_groups
  FOR ALL
  USING (public.is_campaign_creator(campaign_id));
