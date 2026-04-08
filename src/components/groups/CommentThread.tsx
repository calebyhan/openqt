import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Tables } from '@/types/supabase'

type CommentRow = Tables<'comments'>

interface CommentWithProfile extends CommentRow {
  profiles: { display_name: string; avatar_url: string | null } | null
}

interface Props {
  entryId: string
  comments: CommentWithProfile[]
  onCommentsChange: (comments: CommentWithProfile[]) => void
  canComment: boolean
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export default function CommentThread({ entryId, comments, onCommentsChange, canComment }: Props) {
  const { user } = useAuthStore()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || !user || submitting) return
    setSubmitting(true)

    const { data, error } = await supabase
      .from('comments')
      .insert({ qt_entry_id: entryId, user_id: user.id, body: body.trim() })
      .select('*, profiles(display_name, avatar_url)')
      .single()

    if (!error && data) {
      onCommentsChange([...comments, data as CommentWithProfile])
      setBody('')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-3 pt-2">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {c.profiles?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium">{c.profiles?.display_name ?? 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">{formatTime(c.created_at)}</span>
            </div>
            <p className="mt-0.5 text-sm">{c.body}</p>
          </div>
        </div>
      ))}

      {canComment && (
        <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={1}
            className="min-h-0 flex-1 resize-none py-1.5 text-sm"
          />
          <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
            Post
          </Button>
        </form>
      )}
    </div>
  )
}
