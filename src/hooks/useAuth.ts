import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { setSession, clearSession } = useAuthStore()

  useEffect(() => {
    // Hydrate session on mount. If the session JWT references a user that no
    // longer exists (e.g. after a local db reset), getUser() will return an
    // error and we clear the stale session so the user is redirected to login.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { clearSession(); return }
      const { error } = await supabase.auth.getUser()
      if (error) { await supabase.auth.signOut(); clearSession(); return }
      setSession(session)
    })

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session)
      } else {
        clearSession()
      }
    })

    return () => subscription.unsubscribe()
  }, [setSession, clearSession])
}
