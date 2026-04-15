import clsx from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={clsx('bg-navy-light rounded-xl border border-gold-dim p-5', className)}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  color?: string
}

export function StatCard({ label, value, color = 'text-gold' }: StatCardProps) {
  return (
    <Card>
      <p className="text-xs text-cream/50 uppercase tracking-wider mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', color)}>{value}</p>
    </Card>
  )
}
