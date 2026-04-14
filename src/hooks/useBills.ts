import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { APEntry, Vendor } from '../lib/types'

export function useBills(statusFilter?: string) {
  return useQuery({
    queryKey: ['ap_entries', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('ap_entries')
        .select('*, vendors(*), events(*)')
        .order('due_date', { ascending: true })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as APEntry[]
    },
  })
}

export function useCreateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bill: Partial<APEntry>) => {
      const { data, error } = await supabase.from('ap_entries').insert([bill]).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap_entries'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useMarkBillPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, paymentMethod }: { id: string; paymentMethod?: string }) => {
      const { error } = await supabase
        .from('ap_entries')
        .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: paymentMethod })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap_entries'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').order('name')
      if (error) throw error
      return data as Vendor[]
    },
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vendor: Partial<Vendor>) => {
      const { data, error } = await supabase.from('vendors').insert([vendor]).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}
