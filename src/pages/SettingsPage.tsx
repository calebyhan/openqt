import { Link } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <h2 className="text-xl font-semibold">Settings</h2>

        <div className="space-y-1">
          <Link
            to="/settings/templates"
            className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm hover:bg-muted"
          >
            Custom Templates
            <span className="text-muted-foreground">›</span>
          </Link>
        </div>

        <button
          onClick={() => void handleSignOut()}
          className="w-full rounded-md border border-destructive px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5"
        >
          Sign out
        </button>

        {/* Phase 7: profile prefs, notifications, translation, timezone picker */}
      </div>
    </AppLayout>
  )
}
