import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, ArrowDownToLine, ArrowUpFromLine,
  Receipt, Calculator, Landmark, Settings, X,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/events', icon: CalendarDays, label: 'Events' },
  { to: '/ar', icon: ArrowDownToLine, label: 'Receivables' },
  { to: '/ap', icon: ArrowUpFromLine, label: 'Payables' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/tax', icon: Calculator, label: 'Tax Helper' },
  { to: '/bank', icon: Landmark, label: 'Bank' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-64 bg-navy-light border-r border-gold-dim flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gold-dim flex items-center justify-between">
          <div>
            <h1 className="text-gold font-bold text-xl tracking-tight">513 Sips</h1>
            <p className="text-xs text-cream/50 mt-0.5">Books & Finance</p>
          </div>
          <button onClick={onClose} className="lg:hidden text-cream/50 hover:text-cream">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gold/15 text-gold'
                    : 'text-cream/60 hover:text-cream hover:bg-white/5'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gold-dim text-xs text-cream/30 text-center">
          513 Sips LLC
        </div>
      </aside>
    </>
  )
}
