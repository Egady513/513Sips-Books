import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { BankTransaction } from '../lib/types'

export function useBankTransactions(statusFilter?: string) {
  return useQuery({
    queryKey: ['bank_transactions', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as BankTransaction[]
    },
  })
}

export function useImportBankCSV() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (transactions: Omit<BankTransaction, 'id' | 'imported_at'>[]) => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .insert(transactions)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_transactions'] }),
  })
}

export function useMatchTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      transactionId,
      matchType,
      matchId,
    }: {
      transactionId: string
      matchType: 'ar' | 'ap' | 'expense'
      matchId: string
    }) => {
      const update: Record<string, string> = { status: 'matched' }
      if (matchType === 'ar') update.matched_ar_entry_id = matchId
      else if (matchType === 'ap') update.matched_ap_entry_id = matchId
      else update.matched_expense_id = matchId

      const { error } = await supabase
        .from('bank_transactions')
        .update(update)
        .eq('id', transactionId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_transactions'] }),
  })
}

export function useIgnoreTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: 'ignored' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_transactions'] }),
  })
}

// Parse CSV file into transaction objects
export function parseCSV(csvText: string, batchId: string): Omit<BankTransaction, 'id' | 'imported_at'>[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

  // Try to find date, description, amount columns
  const dateIdx = headers.findIndex(h =>
    h.includes('date') || h.includes('posted')
  )
  const descIdx = headers.findIndex(h =>
    h.includes('description') || h.includes('memo') || h.includes('payee')
  )
  const amountIdx = headers.findIndex(h =>
    h.includes('amount') || h.includes('total')
  )
  // Some banks split debit/credit
  const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'))
  const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'))

  return lines.slice(1).filter(line => line.trim()).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))

    let amount = 0
    if (amountIdx >= 0) {
      amount = parseFloat(cols[amountIdx]?.replace(/[$,]/g, '') || '0')
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitIdx >= 0 ? parseFloat(cols[debitIdx]?.replace(/[$,]/g, '') || '0') : 0
      const credit = creditIdx >= 0 ? parseFloat(cols[creditIdx]?.replace(/[$,]/g, '') || '0') : 0
      amount = credit - debit
    }

    return {
      import_batch: batchId,
      transaction_date: cols[dateIdx] || new Date().toISOString().split('T')[0],
      description: cols[descIdx] || '',
      amount,
      status: 'unmatched' as const,
    }
  })
}
