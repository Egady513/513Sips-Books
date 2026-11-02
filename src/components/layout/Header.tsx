import { Menu } from 'lucide-react'
import Button from '../ui/Button'
import { useAuth } from '../../lib/auth/useAuth'

interface HeaderProps {
  onMenuClick: () => void
  title: string
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { status, email, signOut } = useAuth()

  return (
    <header className="h-16 border-b border-gold-dim flex items-center px-6 bg-navy/80 backdrop-blur-sm sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        className="lg:hidden mr-4 text-cream/60 hover:text-cream"
      >
        <Menu size={22} />
      </button>
      <h2 className="text-lg font-semibold text-cream">{title}</h2>
      {status === 'signed-in' && (
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-cream/60">{email}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      )}
    </header>
  )
}
