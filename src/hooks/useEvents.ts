import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/types'

export function useEvents(statusFilter?: string) {
  return useQuery({
    queryKey: ['events', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*, ar_entries(*)')
        .order('event_date', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Event[]
    },
  })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('events')
        .select('*, ar_entries(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Event
    },
    enabled: !!id,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (event: Partial<Event>) => {
      const { data, error } = await supabase.from('events').insert([event]).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from('events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['event'] })
    },
  })
}

export function useUploadContract() {
  return useMutation({
    mutationFn: async ({ eventId, file, clientName }: { eventId: string; file: File; clientName: string }) => {
      const fileName = `contracts/${Date.now()}_${clientName.replace(/\s+/g, '_')}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('contracts').getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('events')
        .update({ signed_contract_url: publicUrl })
        .eq('id', eventId)
      if (updateError) throw updateError

      return publicUrl
    },
  })
}
