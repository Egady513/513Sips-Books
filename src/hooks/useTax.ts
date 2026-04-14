import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SCHEDULE_C_LINES } from '../lib/constants'
import { calculateTaxEstimate } from '../utils/taxCalc'

export function useScheduleC(year: number) {
  return useQuery({
    queryKey: ['tax', 'schedule_c', year],
    queryFn: async () => {
      // Get all expenses for the year
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, schedule_c_line, category')
        .gte('expense_date', `${year}-01-01`)
        .lte('expense_date', `${year}-12-31`)

      // Get mileage deductions
      const { data: mileage } = await supabase
        .from('mileage_log')
        .select('deduction_amount')
        .gte('trip_date', `${year}-01-01`)
        .lte('trip_date', `${year}-12-31`)

      // Get paid AP entries
      const { data: paidBills } = await supabase
        .from('ap_entries')
        .select('amount, schedule_c_line, category, paid_at')
        .eq('status', 'paid')

      // Aggregate by Schedule C line
      const lineItems: Record<string, number> = {}
      Object.keys(SCHEDULE_C_LINES).forEach(line => { lineItems[line] = 0 })

      ;(expenses || []).forEach(e => {
        const line = e.schedule_c_line || '27a'
        lineItems[line] = (lineItems[line] || 0) + Number(e.amount)
      })

      // Add mileage to line 10
      ;(mileage || []).forEach(m => {
        lineItems['10'] = (lineItems['10'] || 0) + Number(m.deduction_amount)
      })

      // Add paid bills
      ;(paidBills || []).forEach(b => {
        if (!b.paid_at || new Date(b.paid_at).getFullYear() !== year) return
        const line = b.schedule_c_line || '27a'
        lineItems[line] = (lineItems[line] || 0) + Number(b.amount)
      })

      return Object.entries(SCHEDULE_C_LINES).map(([line, label]) => ({
        line,
        label,
        amount: lineItems[line] || 0,
      }))
    },
  })
}

export function useTaxEstimate(year: number) {
  return useQuery({
    queryKey: ['tax', 'estimate', year],
    queryFn: async () => {
      // Gross income: sum of received AR entries
      const { data: arData } = await supabase
        .from('ar_entries')
        .select('amount, received_at')
        .eq('status', 'received')

      const grossIncome = (arData || [])
        .filter(e => e.received_at && new Date(e.received_at).getFullYear() === year)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      // Total expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', `${year}-01-01`)
        .lte('expense_date', `${year}-12-31`)

      const { data: mileage } = await supabase
        .from('mileage_log')
        .select('deduction_amount')
        .gte('trip_date', `${year}-01-01`)
        .lte('trip_date', `${year}-12-31`)

      const { data: paidBills } = await supabase
        .from('ap_entries')
        .select('amount, paid_at')
        .eq('status', 'paid')

      const totalExpenses =
        (expenses || []).reduce((s, e) => s + Number(e.amount), 0) +
        (mileage || []).reduce((s, m) => s + Number(m.deduction_amount), 0) +
        (paidBills || [])
          .filter(b => b.paid_at && new Date(b.paid_at).getFullYear() === year)
          .reduce((s, b) => s + Number(b.amount), 0)

      return calculateTaxEstimate(grossIncome, totalExpenses)
    },
  })
}
