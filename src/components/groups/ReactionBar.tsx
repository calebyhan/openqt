import { useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'

type Emoji = '👍' | '🙏' | '❤️' | '🔥'
const EMOJIS: Emoji[] = ['👍', '🙏', '❤️', '🔥']

type ReactionRow = Tables<'reactions'>

interface Props {
  entryId: string
  reactions: ReactionRow[]
  onReactionsChange: (reactions: ReactionRow[]) => void
}

export default function ReactionBar({ entryId, reactions, onReactionsChange }: Props) {
  const { user } = useAuthStore()
  const [pending, setPending] = useState<Emoji | null>(null)

  const counts = EMOJIS.reduce<Record<Emoji, number>>((acc, e) => {
    acc[e] = reactions.filter((r) => r.emoji === e).length
    return acc
  }, { '👍': 0, '🙏': 0, '❤️': 0, '🔥': 0 })

  const myReaction = reactions.find((r) => r.user_id === user?.id)?.emoji as Emoji | undefined

  async function handleReact(emoji: Emoji) {
    if (!user || pending) return
    setPending(emoji)

    if (myReaction === emoji) {
      // toggle off
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('qt_entry_id', entryId)
        .eq('user_id', user.id)
      if (!error) {
        onReactionsChange(reactions.filter((r) => r.user_id !== user.id))
      }
    } else {
      if (myReaction) {
        // switch reaction
        const { data, error } = await supabase
          .from('reactions')
          .update({ emoji })
          .eq('qt_entry_id', entryId)
          .eq('user_id', user.id)
          .select()
          .single()
        if (!error && data) {
          onReactionsChange(reactions.map((r) => (r.user_id === user.id ? data : r)))
        }
      } else {
        // new reaction
        const { data, error } = await supabase
          .from('reactions')
          .insert({ qt_entry_id: entryId, user_id: user.id, emoji })
          .select()
          .single()
        if (!error && data) {
          onReactionsChange([...reactions, data])
        }
      }
    }

    setPending(null)
  }

  return (
    <div className="flex gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
          disabled={!!pending}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
            myReaction === emoji
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
            pending && 'opacity-50',
          )}
        >
          <span>{emoji}</span>
          {counts[emoji] > 0 && <span>{counts[emoji]}</span>}
        </button>
      ))}
    </div>
  )
}
