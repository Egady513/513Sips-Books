import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DashboardKPIs } from '../lib/types'

export function useDashboardKPIs(year?: number) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', year],
    queryFn: async () => {
      const y = year || new Date().getFullYear()

      // Total revenue: sum of received AR entries for the year
      const { data: arData } = await supabase
        .from('ar_entries')
        .select('amount, received_at')
        .eq('status', 'received')

      const totalRevenue = (arData || [])
        .filter(e => e.received_at && new Date(e.received_at).getFullYear() === y)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      // Outstanding AR
      const { data: pendingAR } = await supabase
        .from('ar_entries')
        .select('amount')
        .eq('status', 'pending')

      const outstandingAR = (pendingAR || []).reduce((sum, e) => sum + Number(e.amount), 0)

      // Outstanding AP
      const { data: pendingAP } = await supabase
        .from('ap_entries')
        .select('amount')
        .eq('status', 'pending')

      const outstandingAP = (pendingAP || []).reduce((sum, e) => sum + Number(e.amount), 0)

      // Total expenses for the year
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', `${y}-01-01`)
        .lte('expense_date', `${y}-12-31`)

      const totalExpenses = (expenseData || []).reduce((sum, e) => sum + Number(e.amount), 0)

      // Also add paid AP entries as expenses
      const { data: paidAP } = await supabase
        .from('ap_entries')
        .select('amount, paid_at')
        .eq('status', 'paid')

      const paidAPTotal = (paidAP || [])
        .filter(e => e.paid_at && new Date(e.paid_at).getFullYear() === y)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      const allExpenses = totalExpenses + paidAPTotal

      // Active events
      const { data: activeEvents } = await supabase
        .from('events')
        .select('id')
        .in('status', ['signed', 'deposit_paid'])

      const kpis: DashboardKPIs = {
        totalRevenue,
        outstandingAR,
        outstandingAP,
        netProfit: totalRevenue - allExpenses,
        activeEvents: activeEvents?.length || 0,
        totalExpenses: allExpenses,
      }

      return kpis
    },
  })
}

export function useRevenueByMonth(year?: number) {
  return useQuery({
    queryKey: ['dashboard', 'revenue_by_month', year],
    queryFn: async () => {
      const y = year || new Date().getFullYear()

      const { data: arData } = await supabase
        .from('ar_entries')
        .select('amount, received_at')
        .eq('status', 'received')

      const months = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(y, i, 1).toLocaleString('en-US', { month: 'short' }),
        revenue: 0,
      }))

      ;(arData || []).forEach(entry => {
        if (!entry.received_at) return
        const d = new Date(entry.received_at)
        if (d.getFullYear() !== y) return
        months[d.getMonth()].revenue += Number(entry.amount)
      })

      return months
    },
  })
}
