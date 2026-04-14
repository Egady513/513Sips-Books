import { X } from 'lucide-react'
import clsx from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={clsx(
          'bg-navy-light rounded-xl border border-gold-dim p-6 max-h-[90vh] overflow-y-auto',
          wide ? 'w-full max-w-2xl' : 'w-full max-w-md'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gold">{title}</h3>
          <button onClick={onClose} className="text-cream/40 hover:text-cream">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
