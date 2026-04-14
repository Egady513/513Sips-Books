import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardKPIs, useRevenueByMonth } from '../hooks/useDashboard'
import { StatCard, Card } from '../components/ui/Card'
import { formatCurrency, getCurrentYear } from '../utils/formatters'


export default function DashboardPage() {
  const [year] = useState(getCurrentYear())
  const { data: kpis, isLoading } = useDashboardKPIs(year)
  const { data: revenueData } = useRevenueByMonth(year)

  if (isLoading) return <div className="text-cream/50 text-center py-20">Loading dashboard...</div>

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Dashboard</h1>
        <span className="text-cream/50 text-sm">{year}</span>
      </div>

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
        <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-4">Monthly Revenue</h3>
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-3">P&L Summary</h3>
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
          <h3 className="text-sm text-cream/50 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <a href="/events" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + New Event
            </a>
            <a href="/expenses" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + Log Expense
            </a>
            <a href="/ar" className="block px-4 py-2 bg-navy-lighter rounded-lg text-sm text-cream/80 hover:text-gold transition-colors">
              + Record Payment
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}
