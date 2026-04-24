interface FilterTabOption {
  value: string
  label: string
  count?: number
}

interface FilterTabsProps {
  options: FilterTabOption[]
  value: string
  onChange: (value: string) => void
  /** pill = rounded bg-gold buttons (default); underline = border-b gold underline */
  variant?: 'pill' | 'underline'
}

export default function FilterTabs({ options, value, onChange, variant = 'pill' }: FilterTabsProps) {
  if (variant === 'underline') {
    return (
      <div className="flex gap-1 border-b border-gold-dim">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              value === opt.value
                ? 'border-gold text-gold'
                : 'border-transparent text-cream/50 hover:text-cream'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className="ml-1.5 text-xs bg-navy-lighter px-1.5 py-0.5 rounded-full">{opt.count}</span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            value === opt.value ? 'bg-gold text-navy font-semibold' : 'bg-navy-lighter text-cream/60'
          }`}
        >
          {opt.label}
          {opt.count !== undefined && opt.count > 0 && (
            <span className="ml-1.5 text-xs opacity-70">({opt.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}
