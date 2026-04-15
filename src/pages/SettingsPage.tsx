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
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">App Access</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-cream/60">Books App URL</span>
            <a
              href="https://egady513.github.io/513Sips-Books/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-light underline text-xs"
            >
              egady513.github.io/513Sips-Books/ ↗
            </a>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-cream/60">Quote Calculator</span>
            <a href="https://www.513sips.com/tools/calculator.html" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light underline text-xs">
              513sips.com/tools/calculator.html ↗
            </a>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-cream/60">Contract Tool</span>
            <a href="https://www.513sips.com/tools/contract.html" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-light underline text-xs">
              513sips.com/tools/contract.html ↗
            </a>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-cream/60">Database</span>
            <span className="text-success text-xs">✓ Supabase connected</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Storage Buckets Setup</h3>
        <p className="text-xs text-cream/50 mb-3">
          Two Supabase storage buckets are needed for file uploads. Create them once in your Supabase dashboard
          (Storage → New Bucket → Public, allow image/* and application/pdf).
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-navy-lighter">
            <span className="text-gold mt-0.5">📁</span>
            <div>
              <p className="text-cream font-medium">receipts</p>
              <p className="text-xs text-cream/50">Used for expense receipt uploads (images, PDFs)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-navy-lighter">
            <span className="text-gold mt-0.5">📁</span>
            <div>
              <p className="text-cream font-medium">contracts</p>
              <p className="text-xs text-cream/50">Used for signed contract PDF uploads</p>
            </div>
          </div>
        </div>
        <a
          href="https://supabase.com/dashboard/project/bixyltkdymoqjipaiujk/storage/buckets"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs text-gold/60 hover:text-gold transition-colors"
        >
          Open Supabase Storage Dashboard ↗
        </a>
      </Card>

      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">About</h3>
        <p className="text-sm text-cream/60">
          513 Sips Books — A simplified financial management tool for mobile bartending businesses.
          Built to help track events, invoices, expenses, and taxes for a single-member LLC filing Schedule C.
        </p>
      </Card>
    </div>
  )
}
