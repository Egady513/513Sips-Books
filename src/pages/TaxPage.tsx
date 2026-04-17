import { useState } from 'react'
import { useScheduleC, useTaxEstimate } from '../hooks/useTax'
import { Card, StatCard } from '../components/ui/Card'
import { formatCurrency, getCurrentYear } from '../utils/formatters'
import { SE_TAX_RATE } from '../lib/constants'
import { Download } from 'lucide-react'

export default function TaxPage() {
  const [year, setYear] = useState(getCurrentYear())
  const { data: scheduleCData, isLoading: loadingSC } = useScheduleC(year)
  const { data: taxEstimate, isLoading: loadingTax } = useTaxEstimate(year)

  function handleExportCSV() {
    const rows: string[][] = []

    // P&L Summary
    rows.push([`513 Sips — Tax Export — ${year}`])
    rows.push([])
    rows.push(['P&L SUMMARY'])
    rows.push(['Item', 'Amount'])
    rows.push(['Gross Revenue', taxEstimate ? String(taxEstimate.grossIncome) : '0'])
    rows.push(['Total Expenses', taxEstimate ? String(taxEstimate.totalExpenses) : '0'])
    rows.push(['Net Profit', taxEstimate ? String(taxEstimate.netProfit) : '0'])
    rows.push([])

    // Schedule C breakdown
    rows.push(['SCHEDULE C DEDUCTIONS'])
    rows.push(['Line', 'Description', 'Amount'])
    ;(scheduleCData || []).forEach(item => {
      rows.push([`Line ${item.line}`, item.label, String(item.amount)])
    })
    const totalDeductions = (scheduleCData || []).reduce((s, i) => s + i.amount, 0)
    rows.push(['', 'TOTAL DEDUCTIONS', String(totalDeductions)])
    rows.push([])

    // Self-employment tax estimate
    if (taxEstimate) {
      rows.push(['SELF-EMPLOYMENT TAX ESTIMATE'])
      rows.push(['Item', 'Amount'])
      rows.push(['SE Taxable Income (92.35% of net)', String(taxEstimate.seTaxableIncome)])
      rows.push([`SE Tax (${(SE_TAX_RATE * 100).toFixed(1)}%)`, String(taxEstimate.seTax)])
      rows.push(['SE Tax Deduction (50% of SE tax)', String(taxEstimate.seTaxDeduction)])
      rows.push(['Estimated Quarterly Payment', String(taxEstimate.estimatedQuarterlyPayment)])
      rows.push([])
      rows.push(['Quarterly due dates: Apr 15 / Jun 15 / Sep 15 / Jan 15 (next year)'])
    }

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `513sips-tax-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalDeductions = scheduleCData?.reduce((s, item) => s + item.amount, 0) || 0

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gold">Tax Helper</h1>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
            {Array.from({ length: 5 }, (_, i) => getCurrentYear() - 3 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExportCSV}
            disabled={!taxEstimate && !scheduleCData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-40 transition-colors"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {loadingTax ? (
        <div className="text-cream/50 text-center py-8">Calculating...</div>
      ) : taxEstimate && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Gross Income" value={formatCurrency(taxEstimate.grossIncome)} color="text-success" />
            <StatCard label="Total Deductions" value={formatCurrency(taxEstimate.totalExpenses)} color="text-danger" />
            <StatCard label="Net Profit" value={formatCurrency(taxEstimate.netProfit)} color={taxEstimate.netProfit >= 0 ? 'text-gold' : 'text-danger'} />
            <StatCard label="Est. Quarterly Payment" value={formatCurrency(taxEstimate.estimatedQuarterlyPayment)} color="text-warning" />
          </div>

          {/* Self-Employment Tax Breakdown */}
          <Card>
            <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Self-Employment Tax Estimate</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-cream/60">Net Profit (Schedule C)</span>
                <span className="text-cream">{formatCurrency(taxEstimate.netProfit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cream/60">SE Taxable Income (92.35% of net)</span>
                <span className="text-cream">{formatCurrency(taxEstimate.seTaxableIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cream/60">SE Tax ({(SE_TAX_RATE * 100).toFixed(1)}%)</span>
                <span className="text-danger font-medium">{formatCurrency(taxEstimate.seTax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-cream/60">SE Tax Deduction (50% of SE tax)</span>
                <span className="text-success">{formatCurrency(taxEstimate.seTaxDeduction)}</span>
              </div>
              <div className="border-t border-gold-dim pt-3 flex justify-between">
                <span className="text-cream font-medium">Estimated Quarterly Payment</span>
                <span className="text-warning font-bold text-lg">{formatCurrency(taxEstimate.estimatedQuarterlyPayment)}</span>
              </div>
              <p className="text-xs text-cream/30 mt-2">
                Quarterly due dates: Apr 15, Jun 15, Sep 15, Jan 15 (next year).
                This estimate includes SE tax + estimated income tax at ~22% effective rate.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* Schedule C Breakdown */}
      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Schedule C Deductions</h3>
        {loadingSC ? (
          <div className="text-cream/50 text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-2">
            {scheduleCData?.map(item => (
              <div key={item.line} className="flex items-center justify-between py-2 border-b border-gold-dim/50 last:border-0">
                <div>
                  <span className="text-sm text-cream">Line {item.line}: {item.label}</span>
                </div>
                <span className={`font-medium ${item.amount > 0 ? 'text-cream' : 'text-cream/30'}`}>
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-gold">
              <span className="text-cream font-semibold">Total Deductions</span>
              <span className="text-gold font-bold text-lg">{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* P&L Summary */}
      {taxEstimate && (
        <Card>
          <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Profit & Loss Summary — {year}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-cream/60">Gross Revenue</span>
              <span className="text-success font-medium">{formatCurrency(taxEstimate.grossIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-cream/60">Total Expenses</span>
              <span className="text-danger font-medium">({formatCurrency(taxEstimate.totalExpenses)})</span>
            </div>
            <div className="border-t border-gold pt-2 flex justify-between">
              <span className="text-cream font-semibold">Net Profit / (Loss)</span>
              <span className={`font-bold text-lg ${taxEstimate.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(taxEstimate.netProfit)}
              </span>
            </div>
            {taxEstimate.netProfit > 0 && (
              <p className="text-xs text-cream/40 mt-2">
                Profit margin: {((taxEstimate.netProfit / taxEstimate.grossIncome) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
