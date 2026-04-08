import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface Props {
  onDismiss: () => void
}

export default function NotificationPermissionPrompt({ onDismiss }: Props) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEnable() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        onDismiss()
        return
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured')
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ push_subscription: subscription.toJSON() })
        .eq('id', user.id)

      if (updateErr) throw updateErr
      onDismiss()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:left-auto md:right-4 md:bottom-4 md:max-w-sm">
      <div className="rounded-xl border bg-card p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Stay on track</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Get daily reminders and streak warnings to keep your quiet time consistent.
        </p>
        {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void handleEnable()} disabled={loading} className="flex-1">
            {loading ? 'Enabling…' : 'Enable notifications'}
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Convert a base64url string to a Uint8Array for the push subscription call. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
