import clsx from 'clsx'

const colorMap: Record<string, string> = {
  // Event statuses
  draft: 'bg-gray-600/30 text-gray-300',
  sent: 'bg-info/20 text-info',
  signed: 'bg-blue-500/20 text-blue-400',
  deposit_paid: 'bg-warning/20 text-warning',
  completed: 'bg-purple-500/20 text-purple-400',
  paid_full: 'bg-success/20 text-success',
  cancelled: 'bg-danger/20 text-danger',
  // AR/AP statuses
  pending: 'bg-warning/20 text-warning',
  received: 'bg-success/20 text-success',
  paid: 'bg-success/20 text-success',
  overdue: 'bg-danger/20 text-danger',
  // Bank reconciliation
  unmatched: 'bg-warning/20 text-warning',
  matched: 'bg-success/20 text-success',
  ignored: 'bg-gray-600/30 text-gray-400',
}

const labelMap: Record<string, string> = {
  draft: 'Draft',
  sent: 'Quoted',
  signed: 'Signed',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  paid_full: 'Paid in Full',
  cancelled: 'Cancelled',
  pending: 'Pending',
  received: 'Received',
  paid: 'Paid',
  overdue: 'Overdue',
  unmatched: 'Unmatched',
  matched: 'Matched',
  ignored: 'Ignored',
  pending_deposit: 'Pending Deposit',
  pending_balance: 'Pending Balance',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        colorMap[status] || 'bg-gray-600/30 text-gray-300',
        className
      )}
    >
      {labelMap[status] || status}
    </span>
  )
}
