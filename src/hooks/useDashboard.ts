import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DashboardKPIs } from '../lib/types'

export function useDashboardKPIs(year?: number) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', year],
    queryFn: async () => {
      const y = year || new Date().getFullYear()

      // REVENUE: Received + Pending AR for the year
      const { data: arData } = await supabase
        .from('ar_entries')
        .select('amount, received_at, status, due_date')

      const receivedAR = (arData || [])
        .filter(e => e.status === 'received' && e.received_at && new Date(e.received_at).getFullYear() === y)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      const pendingARYear = (arData || [])
        .filter(e => e.status === 'pending' && e.due_date && new Date(e.due_date).getFullYear() === y)

      const outstandingAR = pendingARYear.reduce((sum, e) => sum + Number(e.amount), 0)

      // ACCRUAL REVENUE: Received + Pending for the year
      const accrualRevenue = receivedAR + outstandingAR

      // EXPENSES: For the year
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', `${y}-01-01`)
        .lte('expense_date', `${y}-12-31`)

      const totalExpenses = (expenseData || []).reduce((sum, e) => sum + Number(e.amount), 0)

      // MILEAGE: For the year (tax-deductible deduction)
      const { data: mileageData } = await supabase
        .from('mileage_log')
        .select('deduction_amount')
        .gte('trip_date', `${y}-01-01`)
        .lte('trip_date', `${y}-12-31`)

      const totalMileage = (mileageData || []).reduce((sum, e) => sum + Number(e.deduction_amount), 0)

      // ACCOUNTS PAYABLE: Paid + Pending — includes owner-draw entries (expenses Eddie fronted)
      const { data: paidAP } = await supabase
        .from('ap_entries')
        .select('amount, paid_at, is_owner_draw')
        .eq('status', 'paid')

      const paidAPTotal = (paidAP || [])
        .filter(e => e.paid_at && new Date(e.paid_at).getFullYear() === y)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      const { data: pendingAP } = await supabase
        .from('ap_entries')
        .select('amount, due_date, is_owner_draw')
        .eq('status', 'pending')

      const pendingAPTotal = (pendingAP || [])
        .filter(e => e.due_date && new Date(e.due_date).getFullYear() === y)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      // Owner reimbursement = pending entries where Eddie fronted the cost (is_owner_draw)
      const ownerReimbursementDue = (pendingAP || [])
        .filter(e => e.is_owner_draw)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      // ACCRUAL EXPENSES: All expenses + paid AP + pending AP + mileage
      const accrualExpenses = totalExpenses + paidAPTotal + pendingAPTotal + totalMileage

      // Active events
      const { data: activeEvents } = await supabase
        .from('events')
        .select('id')
        .in('status', ['signed', 'deposit_paid'])

      const kpis: DashboardKPIs = {
        totalRevenue: receivedAR,
        outstandingAR,
        accrualRevenue,
        outstandingAP: paidAPTotal + pendingAPTotal,
        ownerReimbursementDue,
        netProfit: accrualRevenue - accrualExpenses,
        activeEvents: activeEvents?.length || 0,
        totalExpenses: accrualExpenses,
      }

      return kpis
    },
  })
}

export function useOverdueAlerts() {
  return useQuery({
    queryKey: ['dashboard', 'overdue'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]

      const { data: overdueAR } = await supabase
        .from('ar_entries')
        .select('id, amount, events(client_name)')
        .eq('status', 'pending')
        .lt('due_date', today)

      const { data: overdueAP } = await supabase
        .from('ap_entries')
        .select('id, amount, description')
        .eq('status', 'pending')
        .eq('is_owner_draw', false)
        .lt('due_date', today)

      return {
        arCount: overdueAR?.length || 0,
        apCount: overdueAP?.length || 0,
        arTotal: (overdueAR || []).reduce((s, e) => s + Number(e.amount), 0),
        apTotal: (overdueAP || []).reduce((s, e) => s + Number(e.amount), 0),
      }
    },
    staleTime: 60_000,
  })
}

export function useUpcomingPayments() {
  return useQuery({
    queryKey: ['dashboard', 'upcoming_payments'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data } = await supabase
        .from('ar_entries')
        .select('id, amount, due_date, entry_type, events(client_name, client_phone, client_email)')
        .eq('status', 'pending')
        .gte('due_date', today)
        .lte('due_date', in7)
        .order('due_date', { ascending: true })

      return (data || []) as unknown as Array<{
        id: string
        amount: number
        due_date: string
        entry_type: string
        events: { client_name: string; client_phone?: string; client_email?: string } | null
      }>
    },
    staleTime: 60_000,
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
