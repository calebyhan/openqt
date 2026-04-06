-- ============================================================
-- RLS Policies
-- ============================================================

-- Helper: check if calling user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

-- Helper: check if calling user can see a qt_entry (owner or shared to a group they're in)
CREATE OR REPLACE FUNCTION public.can_see_entry(eid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qt_entries WHERE id = eid AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.qt_shares qs
    JOIN public.group_members gm ON gm.group_id = qs.group_id
    WHERE qs.qt_entry_id = eid AND gm.user_id = auth.uid()
  );
$$;

-- Helper: check if calling user can comment on an entry (shared with 'comments' or 'full')
CREATE OR REPLACE FUNCTION public.can_comment_on_entry(eid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qt_shares qs
    JOIN public.group_members gm ON gm.group_id = qs.group_id
    WHERE qs.qt_entry_id = eid
      AND gm.user_id = auth.uid()
      AND qs.visibility IN ('comments', 'full')
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
CREATE POLICY "profiles: own read/update"
  ON public.profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: group members can read display_name and avatar_url"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
  );

-- ============================================================
-- qt_templates
-- ============================================================
CREATE POLICY "qt_templates: system templates readable by all auth"
  ON public.qt_templates FOR SELECT
  USING (is_system = true AND auth.uid() IS NOT NULL);

CREATE POLICY "qt_templates: creator can CRUD own"
  ON public.qt_templates FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============================================================
-- qt_entries
-- ============================================================
CREATE POLICY "qt_entries: owner can CRUD"
  ON public.qt_entries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "qt_entries: shared entry visible to group members"
  ON public.qt_entries FOR SELECT
  USING (public.can_see_entry(id));

-- ============================================================
-- qt_shares
-- ============================================================
CREATE POLICY "qt_shares: entry owner can insert/delete"
  ON public.qt_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.qt_entries WHERE id = qt_entry_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qt_entries WHERE id = qt_entry_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "qt_shares: group members can read"
  ON public.qt_shares FOR SELECT
  USING (public.is_group_member(group_id));

-- ============================================================
-- reactions
-- ============================================================
CREATE POLICY "reactions: group members can insert/delete own"
  ON public.reactions FOR ALL
  USING (
    user_id = auth.uid() AND public.can_see_entry(qt_entry_id)
  )
  WITH CHECK (
    user_id = auth.uid() AND public.can_see_entry(qt_entry_id)
  );

CREATE POLICY "reactions: readable if can see entry"
  ON public.reactions FOR SELECT
  USING (public.can_see_entry(qt_entry_id));

-- ============================================================
-- comments
-- ============================================================
CREATE POLICY "comments: insert if can comment on entry"
  ON public.comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND public.can_comment_on_entry(qt_entry_id)
  );

CREATE POLICY "comments: author or entry owner can delete"
  ON public.comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.qt_entries WHERE id = qt_entry_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "comments: readable if can see entry"
  ON public.comments FOR SELECT
  USING (public.can_see_entry(qt_entry_id));

-- ============================================================
-- groups
-- ============================================================
CREATE POLICY "groups: members can read"
  ON public.groups FOR SELECT
  USING (public.is_group_member(id));

CREATE POLICY "groups: owner/admin can update"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "groups: any auth user can insert (create)"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- ============================================================
-- group_members
-- ============================================================
CREATE POLICY "group_members: members can read own group's member list"
  ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id));

CREATE POLICY "group_members: owner can insert"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role = 'owner'
    )
    OR user_id = auth.uid() -- allow self-join via invite link
  );

CREATE POLICY "group_members: owner can delete; user can leave"
  ON public.group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id AND gm2.user_id = auth.uid() AND gm2.role = 'owner'
    )
  );

-- ============================================================
-- campaigns
-- ============================================================
CREATE POLICY "campaigns: creator can CRUD"
  ON public.campaigns FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "campaigns: published readable by members of attached groups"
  ON public.campaigns FOR SELECT
  USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.campaign_groups cg
      JOIN public.group_members gm ON gm.group_id = cg.group_id
      WHERE cg.campaign_id = campaigns.id AND gm.user_id = auth.uid()
    )
  );

-- ============================================================
-- campaign_days
-- ============================================================
CREATE POLICY "campaign_days: creator can CRUD"
  ON public.campaign_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns WHERE id = campaign_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns WHERE id = campaign_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "campaign_days: readable same as campaign"
  ON public.campaign_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.campaign_groups cg ON cg.campaign_id = c.id
      JOIN public.group_members gm ON gm.group_id = cg.group_id
      WHERE c.id = campaign_id AND c.is_published = true AND gm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns WHERE id = campaign_id AND created_by = auth.uid()
    )
  );

-- ============================================================
-- campaign_groups
-- ============================================================
CREATE POLICY "campaign_groups: campaign creator can manage"
  ON public.campaign_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns WHERE id = campaign_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns WHERE id = campaign_id AND created_by = auth.uid()
    )
    -- Attaching to a group requires caller to be owner or admin of that group
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = campaign_groups.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- campaign_members
-- ============================================================
CREATE POLICY "campaign_members: user can insert/delete self"
  ON public.campaign_members FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "campaign_members: members of attached groups can read"
  ON public.campaign_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_groups cg
      JOIN public.group_members gm ON gm.group_id = cg.group_id
      WHERE cg.campaign_id = campaign_members.campaign_id AND gm.user_id = auth.uid()
    )
  );
