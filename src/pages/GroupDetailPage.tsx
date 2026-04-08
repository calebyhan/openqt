import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Copy, Check, Users } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import GroupFeed from '@/components/groups/GroupFeed'
import MemberList from '@/components/groups/MemberList'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/supabase'

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Tables<'groups'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Group not found.')
        else setGroup(data)
        setLoading(false)
      })
  }, [id])

  async function copyInviteLink() {
    if (!group) return
    const url = `${window.location.origin}/join/${group.invite_code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </AppLayout>
    )
  }

  if (error || !group || !id) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <p className="text-sm text-destructive">{error ?? 'Group not found.'}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="truncate font-semibold">{group.name}</h2>
            {group.description && (
              <p className="truncate text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={copyInviteLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{copied ? 'Copied!' : 'Invite'}</span>
          </Button>
        </div>

        {/* Tabs: Feed / Members */}
        <Tabs defaultValue="feed">
          <TabsList className="w-full rounded-none border-b bg-transparent px-4">
            <TabsTrigger value="feed" className="flex-1">Feed</TabsTrigger>
            <TabsTrigger value="members" className="flex-1">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-0">
            <GroupFeed groupId={id} />
          </TabsContent>

          <TabsContent value="members" className="mt-0 px-4 py-4">
            <MemberList groupId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
