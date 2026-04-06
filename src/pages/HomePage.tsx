import AppLayout from '@/components/layout/AppLayout'
import { useAuthStore } from '@/store/authStore'

export default function HomePage() {
  const { user } = useAuthStore()

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-4">
        <h2 className="text-xl font-semibold">Good morning</h2>
        <p className="text-sm text-muted-foreground">
          Welcome, {user?.email}. Start your quiet time below.
        </p>
        {/* Phase 2+: Today's campaign prompt, group feed */}
      </div>
    </AppLayout>
  )
}
