import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FeedEntryCard, { type FeedEntry } from '@/components/groups/FeedEntryCard'

interface Props {
  groupId: string
}

// Shape returned by the Supabase join query.
// reactions and comments are nested under qt_entries because their FKs point to qt_entries, not qt_shares.
interface ShareRow {
  id: string
  visibility: 'reactions_only' | 'comments' | 'full'
  shared_at: string
  qt_entries: {
    id: string
    title: string | null
    content: unknown
    created_at: string
    profiles: { display_name: string; avatar_url: string | null } | null
    reactions: Array<{
      id: string
      qt_entry_id: string
      user_id: string
      emoji: '👍' | '🙏' | '❤️' | '🔥'
      created_at: string
    }>
    comments: Array<{
      id: string
      qt_entry_id: string
      user_id: string
      body: string
      created_at: string
      updated_at: string
      profiles: { display_name: string; avatar_url: string | null } | null
    }>
  } | null
}

function extractPreview(content: unknown): string | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null
  const values = Object.values(content as Record<string, unknown>)
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) {
      // Strip basic HTML tags from Tiptap output
      return v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    }
  }
  return null
}

function toFeedEntry(row: ShareRow): FeedEntry {
  return {
    shareId: row.id,
    entryId: row.qt_entries?.id ?? '',
    visibility: row.visibility,
    sharedAt: row.shared_at,
    author: row.qt_entries?.profiles ?? { display_name: 'Unknown', avatar_url: null },
    entryTitle: row.qt_entries?.title ?? null,
    entryCreatedAt: row.qt_entries?.created_at ?? '',
    preview: extractPreview(row.qt_entries?.content),
    reactions: row.qt_entries?.reactions ?? [],
    comments: (row.qt_entries?.comments ?? []) as FeedEntry['comments'],
  }
}

export default function GroupFeed({ groupId }: Props) {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Keep a ref so realtime callbacks can access latest state
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error: err } = await supabase
        .from('qt_shares')
        .select(
          `id, visibility, shared_at,
           qt_entries(id, title, content, created_at, profiles(display_name, avatar_url),
             reactions(id, qt_entry_id, user_id, emoji, created_at),
             comments(id, qt_entry_id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))
           )`,
        )
        .eq('group_id', groupId)
        .order('shared_at', { ascending: false })

      if (cancelled) return
      if (err) {
        setError('Could not load feed.')
      } else {
        setEntries((data ?? []).map((row) => toFeedEntry(row as unknown as ShareRow)))
      }
      setLoading(false)
    }

    load()

    // Realtime: new shares in this group
    const channel = supabase
      .channel(`group-feed-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'qt_shares', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          // Fetch full row with joins
          const { data } = await supabase
            .from('qt_shares')
            .select(
              `id, visibility, shared_at,
               qt_entries(id, title, content, created_at, profiles(display_name, avatar_url)),
               reactions(id, qt_entry_id, user_id, emoji, created_at),
               comments(id, qt_entry_id, user_id, body, created_at, updated_at, profiles(display_name, avatar_url))`,
            )
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setEntries((prev) => [toFeedEntry(data as unknown as ShareRow), ...prev])
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [groupId])

  if (loading) return <p className="px-4 py-6 text-sm text-muted-foreground">Loading feed…</p>
  if (error) return <p className="px-4 py-6 text-sm text-destructive">{error}</p>
  if (entries.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">No entries shared yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Write an entry and share it with this group.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {entries.map((e) => (
        <FeedEntryCard key={e.shareId} entry={e} />
      ))}
    </div>
  )
}
