import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardKPIs, useRevenueByMonth, useOverdueAlerts, useUpcomingPayments } from '../hooks/useDashboard'
import { useLeads } from '../hooks/useLeads'
import { useRecentQuotes } from '../hooks/useQuotes'
import { StatCard, Card } from '../components/ui/Card'
import { formatCurrency, getCurrentYear } from '../utils/formatters'
import { AlertTriangle, ChevronLeft, ChevronRight, Bell, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const [year, setYear] = useState(getCurrentYear())
  const { data: kpis, isLoading } = useDashboardKPIs(year)
  const { data: revenueData } = useRevenueByMonth(year)
  const { data: allLeads = [] } = useLeads()
  const { data: recentQuotes = [] } = useRecentQuotes()
  const { data: overdue } = useOverdueAlerts()
  const { data: upcomingPayments = [] } = useUpcomingPayments()

  const leadStats = {
    newCount:    allLeads.filter(l => l.status === 'new').length,
    quotedCount: allLeads.filter(l => l.status === 'quoted' || l.status === 'negotiating').length,
    pipeline:    allLeads.filter(l => l.status !== 'lost' && l.status !== 'booked').reduce((s, l) => {
      const quote = recentQuotes.find(q => q.lead_id === l.id)
      const amount = quote?.total ?? l.budget ?? 0
      const prob = l.probability ?? 50
      return s + Math.round(amount * prob / 100)
    }, 0),
  }

  // Dynamic year list: 3 years back through current year + 1
  const currentYear = getCurrentYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  if (isLoading) return <div className="text-cream/50 text-center py-20">Loading dashboard...</div>

  const hasOverdue = (overdue?.arCount || 0) + (overdue?.apCount || 0) > 0

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header with year toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => Math.max(yearOptions[0], y - 1))}
            className="p-1.5 rounded-lg bg-navy-lighter text-cream/50 hover:text-gold disabled:opacity-30"
            disabled={year <= yearOptions[0]}
          >
            <ChevronLeft size={16} />
          </button>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-navy-lighter border border-gold-dim rounded-lg px-3 py-1.5 text-cream text-sm focus:outline-none focus:border-gold/50"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setYear(y => Math.min(yearOptions[yearOptions.length - 1], y + 1))}
            className="p-1.5 rounded-lg bg-navy-lighter text-cream/50 hover:text-gold disabled:opacity-30"
            disabled={year >= yearOptions[yearOptions.length - 1]}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Overdue alert banner */}
      {hasOverdue && (
        <div className="flex items-start gap-3 bg-warning/10 border border-warning/40 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-warning mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-warning">Action needed — overdue items:</span>
            <div className="text-cream/70 mt-1 flex flex-wrap gap-4">
              {(overdue?.arCount || 0) > 0 && (
                <Link to="/ar?filter=overdue" className="hover:text-gold transition-colors">
                  {overdue!.arCount} overdue payment{overdue!.arCount > 1 ? 's' : ''} ({formatCurrency(overdue!.arTotal)} owed to you) →
                </Link>
              )}
              {(overdue?.apCount || 0) > 0 && (
                <Link to="/ap?filter=overdue" className="hover:text-gold transition-colors">
                  {overdue!.apCount} overdue bill{overdue!.apCount > 1 ? 's' : ''} ({formatCurrency(overdue!.apTotal)} you owe) →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming payments banner */}
      {upcomingPayments.length > 0 && (
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
          <Bell size={18} className="text-blue-300 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-blue-300">Payments due in the next 7 days:</span>
            <div className="text-cream/70 mt-1 flex flex-wrap gap-4">
              {upcomingPayments.map(p => {
                const daysLeft = Math.round((new Date(p.due_date).getTime() - Date.now()) / 86400000)
                const msg = `Hi ${p.events?.client_name || 'there'}! Just a reminder that your ${p.entry_type} payment of ${formatCurrency(p.amount)} is due ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`} (${p.due_date}). Payment accepted via Venmo, Zelle, cash, or check. Reach out with any questions!\n— Eddie @ 513 Sips`
                return (
                  <span key={p.id} className="flex items-center gap-1.5">
                    <Link to="/ar?filter=pending" className="hover:text-gold transition-colors capitalize">
                      {p.events?.client_name} — {p.entry_type} {formatCurrency(p.amount)}
                      {daysLeft === 0 ? ' (today!)' : ` (${daysLeft}d)`}
                    </Link>
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg); toast.success('Reminder copied to clipboard') }}
                      className="text-blue-300/50 hover:text-blue-300 transition-colors"
                      title="Copy reminder message"
                    ><Copy size={11} /></button>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(kpis?.totalRevenue || 0)} color="text-success" />
        <StatCard label="Outstanding AR" value={formatCurrency(kpis?.outstandingAR || 0)} color="text-warning" />
        <StatCard label="Outstanding AP" value={formatCurrency(kpis?.outstandingAP || 0)} color="text-danger" />
        <StatCard label="Net Profit" value={formatCurrency(kpis?.netProfit || 0)} color={kpis && kpis.netProfit >= 0 ? 'text-success' : 'text-danger'} />
        <StatCard label="Active Events" value={String(kpis?.activeEvents || 0)} color="text-gold" />
      </div>

      {/* Revenue Chart */}
      <Card>
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Monthly Revenue — {year}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243654" />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1A2B45', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8 }}
                labelStyle={{ color: '#D4AF37' }}
                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-3">P&L Summary — {year}</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-cream/60">Gross Revenue</span>
              <span className="text-success font-medium">{formatCurrency(kpis?.totalRevenue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cream/60">Total Expenses</span>
              <span className="text-danger font-medium">-{formatCurrency(kpis?.totalExpenses || 0)}</span>
            </div>
            <div className="border-t border-gold-dim pt-2 flex justify-between">
              <span className="text-cream font-medium">Net Profit</span>
              <span className={`font-bold ${(kpis?.netProfit || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(kpis?.netProfit || 0)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-3">Lead Pipeline</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-cream/60">New Inquiries</span>
              <span className="text-blue-300 font-medium">{leadStats.newCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cream/60">Quoted / Negotiating</span>
              <span className="text-yellow-300 font-medium">{leadStats.quotedCount}</span>
            </div>
            <div className="border-t border-gold-dim pt-2 flex justify-between">
              <span className="text-cream font-medium">Wtd. Pipeline</span>
              <span className="text-gold font-bold">{formatCurrency(leadStats.pipeline)}</span>
            </div>
          </div>
          <Link to="/leads" className="block mt-3 text-xs text-gold/60 hover:text-gold transition-colors">
            View all leads →
          </Link>
        </Card>

        <Card>
          <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link to="/leads" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + New Lead
            </Link>
            <Link to="/events" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + New Event
            </Link>
            <Link to="/expenses" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + Log Expense
            </Link>
            <Link to="/ar" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + Record Payment
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
