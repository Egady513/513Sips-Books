import { Menu } from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
  title: string
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  return (
    <header className="h-16 border-b border-gold-dim flex items-center px-6 bg-navy/80 backdrop-blur-sm sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        className="lg:hidden mr-4 text-cream/60 hover:text-cream"
      >
        <Menu size={22} />
      </button>
      <h2 className="text-lg font-semibold text-cream">{title}</h2>
    </header>
  )
}
