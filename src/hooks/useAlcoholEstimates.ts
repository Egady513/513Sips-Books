import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useAlcoholEstimatesByLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['alcohol-estimates', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return null
      const { data, error } = await supabase
        .from('alcohol_estimates')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    },
    enabled: !!leadId,
  })
}

export function useAlcoholEstimatesByEvent(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['alcohol-estimates', 'event', eventId],
    queryFn: async () => {
      if (!eventId) return null
      const { data, error } = await supabase
        .from('alcohol_estimates')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    },
    enabled: !!eventId,
  })
}

export function useDeleteAlcoholEstimate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (estimateId: string) => {
      const { error } = await supabase
        .from('alcohol_estimates')
        .delete()
        .eq('id', estimateId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alcohol-estimates'] })
    },
  })
}
