import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export default function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const { user, loading } = useAuthStore()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'joining' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (loading) return
    if (!user) {
      // Store invite code in sessionStorage and redirect to login
      sessionStorage.setItem('pendingInviteCode', inviteCode ?? '')
      navigate('/login', { replace: true })
      return
    }

    async function joinGroup() {
      setStatus('joining')
      const { data: group, error: findErr } = await supabase
        .rpc('find_group_by_invite_code', { code: inviteCode })
        .single()

      if (findErr || !group) {
        setStatus('error')
        setMessage('Invalid or expired invite link.')
        return
      }

      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user!.id, role: 'member' })

      // 23505 = unique_violation (already a member) — treat as success
      if (joinErr && joinErr.code !== '23505') {
        setStatus('error')
        setMessage('Failed to join group. Please try again.')
        return
      }

      navigate(`/groups/${group.id}`, { replace: true })
    }

    void joinGroup()
  }, [user, loading, inviteCode, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'joining' && <p className="text-sm text-muted-foreground">Joining group…</p>}
      {status === 'error' && <p className="text-sm text-destructive">{message}</p>}
    </div>
  )
}
