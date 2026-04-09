import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, PenLine, Users, Trophy, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/entries', icon: BookOpen, label: 'Journal' },
  { to: '/write', icon: PenLine, label: 'Write' },
  { to: '/groups', icon: Users, label: 'Groups' },
  { to: '/campaigns', icon: Trophy, label: 'Campaigns' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar — respects iOS status bar (env safe-area-inset-top) */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top,0px)]">
        <span className="font-semibold tracking-tight">OpenQT</span>
        <Link to="/settings" aria-label="Settings">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Link>
      </header>

      {/* Page content — bottom padding accounts for nav + home indicator */}
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* Bottom nav — sits above home indicator on iOS */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-3 text-xs min-w-[44px]',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
