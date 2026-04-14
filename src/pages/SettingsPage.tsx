import { Card } from '../components/ui/Card'
import { MILEAGE_RATES, EXPENSE_CATEGORIES, SCHEDULE_C_LINES } from '../lib/constants'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gold">Settings</h1>

      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Business Info</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-cream/60">Business Name</span>
            <span className="text-cream">513 Sips LLC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cream/60">Owner</span>
            <span className="text-cream">Eddie</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cream/60">Entity Type</span>
            <span className="text-cream">Single-Member LLC (Schedule C)</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">IRS Mileage Rates</h3>
        <div className="space-y-2 text-sm">
          {Object.entries(MILEAGE_RATES).map(([year, rate]) => (
            <div key={year} className="flex justify-between">
              <span className="text-cream/60">{year}</span>
              <span className="text-cream">${rate.toFixed(2)} / mile</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Expense Categories → Schedule C Mapping</h3>
        <div className="space-y-2 text-sm">
          {EXPENSE_CATEGORIES.map(cat => (
            <div key={cat.value} className="flex justify-between">
              <span className="text-cream/60">{cat.label}</span>
              <span className="text-cream">
                Line {cat.scheduleCLine} — {SCHEDULE_C_LINES[cat.scheduleCLine as keyof typeof SCHEDULE_C_LINES]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">About</h3>
        <p className="text-sm text-cream/60">
          513 Sips Books — A simplified financial management tool for mobile bartending businesses.
          Built to help track events, invoices, expenses, and taxes for a single-member LLC filing Schedule C.
        </p>
        <p className="text-xs text-cream/30 mt-3">
          Supabase connected: {import.meta.env.VITE_SUPABASE_URL ? 'Yes' : 'No'}
        </p>
      </Card>
    </div>
  )
}
