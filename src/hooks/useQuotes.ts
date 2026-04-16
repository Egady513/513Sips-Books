import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Quote {
  id: string
  lead_id?: string
  total: number
  deposit: number
  balance: number
  guest_count?: number
  hours?: number
  bartenders?: number
  event_date?: string
  breakdown?: any
  promo_code?: string
  addon_notes?: string
  valid_until?: string   // YYYY-MM-DD — quote expiration date
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  created_at: string
}

export function useRecentQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, lead_id, total, deposit, balance, guest_count, hours, bartenders, event_date, breakdown, promo_code, addon_notes, valid_until, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Quote[]
    },
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (quote: Omit<Quote, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert([quote])
        .select()
        .single()
      if (error) throw error
      return data as Quote
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useLinkQuoteToLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ quoteId, leadId }: { quoteId: string; leadId: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update({ lead_id: leadId })
        .eq('id', quoteId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quote> & { id: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}
