import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactionBar from '@/components/groups/ReactionBar'
import CommentThread from '@/components/groups/CommentThread'
import type { Tables } from '@/types/supabase'

type ReactionRow = Tables<'reactions'>

interface CommentWithProfile extends Tables<'comments'> {
  profiles: { display_name: string; avatar_url: string | null } | null
}

export interface FeedEntry {
  shareId: string
  entryId: string
  visibility: 'reactions_only' | 'comments' | 'full'
  sharedAt: string
  author: { display_name: string; avatar_url: string | null }
  entryTitle: string | null
  entryCreatedAt: string
  /** First section of content as plain-text preview */
  preview: string | null
  reactions: ReactionRow[]
  comments: CommentWithProfile[]
}

interface Props {
  entry: FeedEntry
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export default function FeedEntryCard({ entry }: Props) {
  const [reactions, setReactions] = useState(entry.reactions)
  const [comments, setComments] = useState(entry.comments)
  const [showComments, setShowComments] = useState(false)

  const canComment = entry.visibility === 'comments' || entry.visibility === 'full'
  const canSeeContent = entry.visibility === 'full'

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {entry.author.display_name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{entry.author.display_name}</p>
            <p className="text-xs text-muted-foreground">{formatDate(entry.sharedAt)}</p>
          </div>
        </div>
        {canSeeContent && (
          <Link
            to={`/entries/${entry.entryId}`}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            View full
          </Link>
        )}
      </div>

      {/* Content preview */}
      {entry.preview && (
        <p className={cn('text-sm text-foreground', !canSeeContent && 'line-clamp-3')}>
          {entry.preview}
        </p>
      )}

      {/* Reactions */}
      <ReactionBar
        entryId={entry.entryId}
        reactions={reactions}
        onReactionsChange={setReactions}
      />

      {/* Comments toggle */}
      {(canComment || comments.length > 0) && (
        <div>
          <button
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comment'}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showComments && (
            <CommentThread
              entryId={entry.entryId}
              comments={comments}
              onCommentsChange={setComments}
              canComment={canComment}
            />
          )}
        </div>
      )}
    </div>
  )
}
