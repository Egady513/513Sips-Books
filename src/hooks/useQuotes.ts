import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface QuoteVersion {
  versionNum: number
  total: number
  deposit: number
  balance: number
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  created_at: string
}

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
  version_history?: QuoteVersion[]  // Changelog of quote versions
}

export function useRecentQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, lead_id, total, deposit, balance, guest_count, hours, bartenders, event_date, breakdown, promo_code, addon_notes, valid_until, status, created_at, version_history')
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
      // Initialize version_history with the first version
      const firstVersion: QuoteVersion = {
        versionNum: 1,
        total: quote.total,
        deposit: quote.deposit,
        balance: quote.balance,
        status: quote.status,
        created_at: new Date().toISOString(),
      }

      const quoteWithHistory = {
        ...quote,
        version_history: [firstVersion],
      }

      const { data, error } = await supabase
        .from('quotes')
        .insert([quoteWithHistory])
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
      // Fetch current quote to capture version history
      const { data: currentQuote, error: fetchError } = await supabase
        .from('quotes')
        .select('total, deposit, balance, status, created_at, version_history')
        .eq('id', id)
        .single()
      if (fetchError) throw fetchError

      // Check if this is a meaningful update (one of the tracked fields changed)
      const trackedFields = ['total', 'deposit', 'balance', 'status']
      const isSignificantChange = trackedFields.some(
        field => field in updates && (updates as any)[field] !== (currentQuote as any)[field]
      )

      let newVersionHistory = currentQuote.version_history || []

      // If this is a significant update, append current state as a new version
      if (isSignificantChange && newVersionHistory.length >= 0) {
        const nextVersionNum = newVersionHistory.length + 1
        const newVersion: QuoteVersion = {
          versionNum: nextVersionNum,
          total: currentQuote.total,
          deposit: currentQuote.deposit,
          balance: currentQuote.balance,
          status: currentQuote.status,
          created_at: new Date().toISOString(),
        }
        newVersionHistory = [...newVersionHistory, newVersion]
      }

      // Update quote with new version history (if changed)
      const updatePayload = isSignificantChange
        ? { ...updates, version_history: newVersionHistory }
        : updates

      const { data, error } = await supabase
        .from('quotes')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}
