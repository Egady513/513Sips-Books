import { useState, useCallback } from 'react'
import { useBankTransactions, useImportBankCSV, useIgnoreTransaction, useMatchTransaction, parseCSV } from '../hooks/useBankReconciliation'
import { useAREntries } from '../hooks/useInvoices'
import { useBills } from '../hooks/useBills'
import { useExpenses } from '../hooks/useExpenses'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate } from '../utils/formatters'
import { Upload, EyeOff, Link2, CheckCircle2 } from 'lucide-react'
import type { BankTransaction } from '../lib/types'
import toast from 'react-hot-toast'

export default function BankPage() {
  const [filter, setFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [matchingTx, setMatchingTx] = useState<BankTransaction | null>(null)

  const { data: transactions, isLoading } = useBankTransactions(filter)
  const { data: arEntries } = useAREntries()
  const { data: bills } = useBills()
  const { data: expenses } = useExpenses()

  const importCSV = useImportBankCSV()
  const ignoreTransaction = useIgnoreTransaction()
  const matchTransaction = useMatchTransaction()

  const unmatched = transactions?.filter(t => t.status === 'unmatched') || []
  const matched = transactions?.filter(t => t.status === 'matched') || []

  // Compute match candidates sorted by amount proximity
  const matchCandidates = matchingTx ? (() => {
    const txAmt = Math.abs(matchingTx.amount)

    if (matchingTx.amount >= 0) {
      // Income: match to pending AR entries
      return (arEntries || [])
        .filter(e => e.status === 'pending')
        .map(e => ({
          type: 'ar' as const,
          id: e.id,
          label: `${e.events?.client_name || 'Unknown'} — ${e.entry_type}`,
          sublabel: e.events?.event_name,
          amount: Number(e.amount),
          date: e.due_date,
          diff: Math.abs(Number(e.amount) - txAmt),
        }))
        .sort((a, b) => a.diff - b.diff)
    } else {
      // Expense: match to pending AP bills + expenses
      const billCandidates = (bills || [])
        .filter(b => b.status === 'pending' && !b.is_owner_draw)
        .map(b => ({
          type: 'ap' as const,
          id: b.id,
          label: `${b.vendors?.name || 'No vendor'} — ${b.description}`,
          sublabel: b.category,
          amount: Number(b.amount),
          date: b.due_date,
          diff: Math.abs(Number(b.amount) - txAmt),
        }))

      const expenseCandidates = (expenses || [])
        .map(exp => ({
          type: 'expense' as const,
          id: exp.id,
          label: exp.description,
          sublabel: exp.category,
          amount: Number(exp.amount),
          date: exp.expense_date,
          diff: Math.abs(Number(exp.amount) - txAmt),
        }))

      return [...billCandidates, ...expenseCandidates].sort((a, b) => a.diff - b.diff)
    }
  })() : []

  const handleMatch = async (matchType: 'ar' | 'ap' | 'expense', matchId: string) => {
    if (!matchingTx) return
    try {
      await matchTransaction.mutateAsync({
        transactionId: matchingTx.id,
        matchType,
        matchId,
      })
      toast.success('Transaction matched')
      setMatchingTx(null)
    } catch {
      toast.error('Failed to match transaction')
    }
  }

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
      toast.success(`${preview.length} transactions imported`)
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
                  <div className="flex items-center gap-2 text-xs text-cream/40 mt-0.5">
                    <span>{formatDate(tx.transaction_date)}</span>
                    {tx.status === 'matched' && (
                      <>
                        <CheckCircle2 size={10} className="text-success" />
                        <span className="text-success">Reconciled</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${tx.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                  {tx.status === 'unmatched' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setMatchingTx(tx)}>
                        <Link2 size={14} /> Match
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => ignoreTransaction.mutate(tx.id)}>
                        <EyeOff size={14} /> Ignore
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Match Modal */}
      <Modal open={!!matchingTx} onClose={() => setMatchingTx(null)}
        title="Match Bank Transaction" wide>
        {matchingTx && (
          <div className="space-y-4">
            {/* Transaction being matched */}
            <div className="bg-navy-lighter rounded-lg px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-cream">{matchingTx.description || 'No description'}</p>
                <p className="text-xs text-cream/40 mt-0.5">{formatDate(matchingTx.transaction_date)}</p>
              </div>
              <span className={`font-bold text-lg ${matchingTx.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(matchingTx.amount)}
              </span>
            </div>

            <p className="text-xs text-cream/50 uppercase tracking-wider">
              {matchingTx.amount >= 0
                ? 'Select the AR entry this payment belongs to'
                : 'Select the bill or expense this withdrawal paid'}
            </p>

            {matchCandidates.length === 0 ? (
              <p className="text-cream/40 text-sm text-center py-8">
                No {matchingTx.amount >= 0 ? 'pending AR entries' : 'pending bills or expenses'} found.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {matchCandidates.slice(0, 15).map(candidate => (
                  <div key={`${candidate.type}-${candidate.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-navy-lighter rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cream truncate">{candidate.label}</p>
                      <div className="flex items-center gap-1.5 text-xs text-cream/40 mt-0.5">
                        {candidate.sublabel && (
                          <span className="capitalize">{candidate.sublabel}</span>
                        )}
                        {candidate.date && (
                          <span>{candidate.sublabel ? '·' : ''} {formatDate(candidate.date)}</span>
                        )}
                        {candidate.diff === 0 ? (
                          <span className="text-success font-semibold ml-1">· Exact match</span>
                        ) : (
                          <span className="text-warning ml-1">· Δ {formatCurrency(candidate.diff)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold text-gold">{formatCurrency(candidate.amount)}</span>
                      <Button size="sm"
                        onClick={() => handleMatch(candidate.type, candidate.id)}
                        disabled={matchTransaction.isPending}>
                        Match
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="secondary" onClick={() => setMatchingTx(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
