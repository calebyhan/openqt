import { useEffect, useState } from 'react'
import { Share2, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/supabase'

type Visibility = 'reactions_only' | 'comments' | 'full'

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: 'reactions_only', label: 'Reactions only', description: 'Group can react, not read or comment' },
  { value: 'comments', label: 'Comments', description: 'Group can react and comment' },
  { value: 'full', label: 'Full', description: 'Group can read, react, and comment' },
]

interface GroupChoice {
  group: Tables<'groups'>
  visibility: Visibility
  alreadyShared: boolean
}

interface Props {
  entryId: string
  /** Controlled open state — optional */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** When passed, renders a Share button trigger */
  showTrigger?: boolean
}

export default function SharingDrawer({ entryId, open, onOpenChange, showTrigger = true }: Props) {
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<GroupChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    async function load() {
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name, description, invite_code, created_by, created_at)')
        .eq('user_id', user!.id)

      if (memberErr) {
        setLoading(false)
        return
      }

      const { data: shareRows, error: shareErr } = await supabase
        .from('qt_shares')
        .select('group_id, visibility')
        .eq('qt_entry_id', entryId)

      if (shareErr) {
        setLoading(false)
        return
      }

      const sharedGroupIds = new Set((shareRows ?? []).map((s) => s.group_id))

      const choices: GroupChoice[] = (memberRows ?? [])
        .filter((row) => row.groups)
        .map((row) => ({
          group: row.groups as unknown as Tables<'groups'>,
          visibility: (shareRows?.find((s) => s.group_id === (row.groups as { id: string }).id)?.visibility as Visibility) ?? 'reactions_only',
          alreadyShared: sharedGroupIds.has((row.groups as { id: string }).id),
        }))

      setGroups(choices)
      setLoading(false)
    }
    load()
  }, [user, entryId])

  function setVisibility(groupId: string, visibility: Visibility) {
    setGroups((prev) =>
      prev.map((g) => (g.group.id === groupId ? { ...g, visibility } : g)),
    )
  }

  function toggleGroup(groupId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.group.id === groupId ? { ...g, alreadyShared: !g.alreadyShared } : g,
      ),
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    const toShare = groups.filter((g) => g.alreadyShared)
    const toUnshare = groups.filter((g) => !g.alreadyShared)

    const upserts = toShare.map((g) => ({
      qt_entry_id: entryId,
      group_id: g.group.id,
      visibility: g.visibility,
    }))

    if (upserts.length > 0) {
      await supabase
        .from('qt_shares')
        .upsert(upserts, { onConflict: 'qt_entry_id,group_id' })
    }

    for (const g of toUnshare) {
      await supabase
        .from('qt_shares')
        .delete()
        .eq('qt_entry_id', entryId)
        .eq('group_id', g.group.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const content = (
    <div className="flex flex-col gap-4 py-2">
      {loading && <p className="text-sm text-muted-foreground">Loading groups…</p>}

      {!loading && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven't joined any groups yet.
        </p>
      )}

      {!loading && groups.length > 0 && (
        <>
          <div className="space-y-3">
            {groups.map((g) => (
              <div
                key={g.group.id}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  g.alreadyShared ? 'border-primary/50 bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{g.group.name}</p>
                  </div>
                  <button
                    onClick={() => toggleGroup(g.group.id)}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                      g.alreadyShared
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {g.alreadyShared && <Check className="h-3 w-3" />}
                  </button>
                </div>

                {g.alreadyShared && (
                  <div className="mt-2 flex gap-1.5">
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setVisibility(g.group.id, opt.value)}
                        title={opt.description}
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-xs transition-colors',
                          g.visibility === opt.value
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving || saved}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {saved && <Check className="mr-1.5 h-4 w-4" />}
            {saved ? 'Saved!' : 'Save sharing settings'}
          </Button>
        </>
      )}
    </div>
  )

  if (!showTrigger) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Share entry</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Share
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Share entry</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  )
}
