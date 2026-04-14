import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AREntry } from '../lib/types'

export function useAREntries(statusFilter?: string) {
  return useQuery({
    queryKey: ['ar_entries', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('ar_entries')
        .select('*, events(*)')
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as AREntry[]
    },
  })
}

export function useCreateAREntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: Partial<AREntry>) => {
      const { data, error } = await supabase.from('ar_entries').insert([entry]).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar_entries'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      entryId,
      paymentMethod,
      eventId,
      entryType,
    }: {
      entryId: string
      paymentMethod: string
      eventId: string
      entryType: string
    }) => {
      // Mark AR entry as received
      const { error: arError } = await supabase
        .from('ar_entries')
        .update({
          status: 'received',
          payment_method: paymentMethod,
          received_at: new Date().toISOString(),
        })
        .eq('id', entryId)
      if (arError) throw arError

      // Check if all AR entries for this event are received
      const { data: remaining } = await supabase
        .from('ar_entries')
        .select('id')
        .eq('event_id', eventId)
        .eq('status', 'pending')

      // Update event status
      let newStatus = 'deposit_paid'
      if (entryType === 'balance' || (remaining && remaining.length === 0)) {
        newStatus = 'paid_full'
      }

      await supabase
        .from('events')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', eventId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar_entries'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
