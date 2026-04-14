import { useState, useCallback } from 'react'
import { useBankTransactions, useImportBankCSV, useIgnoreTransaction, parseCSV } from '../hooks/useBankReconciliation'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import { formatCurrency, formatDate } from '../utils/formatters'
import { Upload, EyeOff } from 'lucide-react'

export default function BankPage() {
  const [filter, setFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any[] | null>(null)
  const { data: transactions, isLoading } = useBankTransactions(filter)
  const importCSV = useImportBankCSV()
  const ignoreTransaction = useIgnoreTransaction()

  const unmatched = transactions?.filter(t => t.status === 'unmatched') || []
  const matched = transactions?.filter(t => t.status === 'matched') || []

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const batchId = `import_${Date.now()}`
      const parsed = parseCSV(text, batchId)
      setPreview(parsed)
    }
    reader.readAsText(file)
  }, [])

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      await importCSV.mutateAsync(preview)
      setPreview(null)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gold">Bank Reconciliation</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Unmatched" value={String(unmatched.length)} color="text-warning" />
        <StatCard label="Matched" value={String(matched.length)} color="text-success" />
        <StatCard label="Total Imported" value={String(transactions?.length || 0)} color="text-gold" />
      </div>

      {/* Upload Section */}
      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-3">Import Bank Statement</h3>
        <div className="border-2 border-dashed border-gold-dim rounded-lg p-8 text-center">
          <Upload size={32} className="mx-auto text-gold mb-3" />
          <p className="text-cream/60 mb-3">Upload a CSV bank statement</p>
          <label className="cursor-pointer">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            <span className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gold-light">
              Choose CSV File
            </span>
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-cream/60">{preview.length} transactions found</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>Cancel</Button>
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing...' : 'Import All'}
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {preview.slice(0, 20).map((tx, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 px-3 bg-navy-lighter rounded">
                  <span className="text-cream/60">{tx.transaction_date}</span>
                  <span className="text-cream flex-1 mx-3 truncate">{tx.description}</span>
                  <span className={tx.amount >= 0 ? 'text-success' : 'text-danger'}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
              {preview.length > 20 && (
                <p className="text-xs text-cream/40 text-center">...and {preview.length - 20} more</p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {['all', 'unmatched', 'matched', 'ignored'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-gold text-navy font-semibold' : 'bg-navy-lighter text-cream/60'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="text-cream/50 text-center py-12">Loading...</div>
      ) : !transactions?.length ? (
        <Card className="text-center py-12 text-cream/50">
          No bank transactions imported yet. Upload a CSV above.
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <Card key={tx.id} className="py-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-cream truncate">{tx.description || 'No description'}</span>
                    <StatusBadge status={tx.status} />
                  </div>
                  <div className="text-xs text-cream/40 mt-0.5">
                    {formatDate(tx.transaction_date)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${tx.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                  {tx.status === 'unmatched' && (
                    <Button size="sm" variant="ghost"
                      onClick={() => ignoreTransaction.mutate(tx.id)}>
                      <EyeOff size={14} /> Ignore
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
