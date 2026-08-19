import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RecurringExpenseTemplate } from '../lib/types'
import { getScheduleCLine } from '../utils/taxCalc'
import toast from 'react-hot-toast'

/** Advances a YYYY-MM-DD date string by one billing period. */
export function advanceDate(dateStr: string, frequency: RecurringExpenseTemplate['frequency']): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export function useRecurringTemplates() {
  return useQuery({
    queryKey: ['recurring_expense_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expense_templates')
        .select('*')
        .order('is_active', { ascending: false })
        .order('next_due_date', { ascending: true })
      if (error) throw error
      return data as RecurringExpenseTemplate[]
    },
  })
}

export function useCreateRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (template: Partial<RecurringExpenseTemplate>) => {
      const { data, error } = await supabase
        .from('recurring_expense_templates')
        .insert([template])
        .select()
        .single()
      if (error) throw error
      return data as RecurringExpenseTemplate
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_expense_templates'] }),
  })
}

export function useUpdateRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringExpenseTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('recurring_expense_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as RecurringExpenseTemplate
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_expense_templates'] }),
  })
}

export function useDeleteRecurringTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_expense_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_expense_templates'] }),
  })
}

/**
 * Logs one occurrence of a recurring template as a real expense row, then advances
 * next_due_date by the template's frequency. If occurrences_remaining is set, it's
 * decremented and the template goes inactive once it hits 0 (e.g. a prepaid final
 * month means there are only N more charges left, not an indefinite recurrence).
 */
export function useLogRecurringExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (template: RecurringExpenseTemplate) => {
      const { error: expenseError } = await supabase.from('expenses').insert([{
        description: template.description,
        category: template.category,
        amount: template.amount,
        expense_date: template.next_due_date,
        vendor: template.vendor,
        is_tax_deductible: template.is_tax_deductible,
        schedule_c_line: template.is_tax_deductible ? getScheduleCLine(template.category) : undefined,
        notes: template.notes,
      }])
      if (expenseError) throw expenseError

      const occurrencesRemaining = template.occurrences_remaining != null
        ? template.occurrences_remaining - 1
        : undefined
      const goingInactive = occurrencesRemaining != null && occurrencesRemaining <= 0

      const { error: templateError } = await supabase
        .from('recurring_expense_templates')
        .update({
          next_due_date: advanceDate(template.next_due_date, template.frequency),
          occurrences_remaining: occurrencesRemaining,
          is_active: goingInactive ? false : template.is_active,
        })
        .eq('id', template.id)
      if (templateError) throw templateError

      return { goingInactive }
    },
    onSuccess: ({ goingInactive }) => {
      qc.invalidateQueries({ queryKey: ['recurring_expense_templates'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(goingInactive ? 'Logged — that was the last occurrence, template deactivated' : 'Expense logged from template')
    },
    onError: () => toast.error('Could not log expense'),
  })
}
