import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Expense, MileageEntry } from '../lib/types'

export function useExpenses(year?: number) {
  return useQuery({
    queryKey: ['expenses', year],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*, events(*)')
        .order('expense_date', { ascending: false })

      if (year) {
        query = query
          .gte('expense_date', `${year}-01-01`)
          .lte('expense_date', `${year}-12-31`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Expense[]
    },
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Partial<Expense>) => {
      const { data, error } = await supabase.from('expenses').insert([expense]).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async ({ file, expenseId }: { file: File; expenseId: string }) => {
      const fileName = `receipts/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)

      const { error } = await supabase
        .from('expenses')
        .update({ receipt_url: publicUrl })
        .eq('id', expenseId)
      if (error) throw error

      return publicUrl
    },
  })
}

// Mileage
export function useMileage(year?: number) {
  return useQuery({
    queryKey: ['mileage', year],
    queryFn: async () => {
      let query = supabase
        .from('mileage_log')
        .select('*, events(*)')
        .order('trip_date', { ascending: false })

      if (year) {
        query = query
          .gte('trip_date', `${year}-01-01`)
          .lte('trip_date', `${year}-12-31`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as MileageEntry[]
    },
  })
}

export function useCreateMileage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: Partial<MileageEntry>) => {
      const { data, error } = await supabase.from('mileage_log').insert([entry]).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mileage'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
