import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useUploadContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leadId,
      file,
      isUnsigned = false,
    }: {
      leadId: string
      file: File
      isUnsigned?: boolean
    }) => {
      const timestamp = Date.now()
      const prefix = isUnsigned ? 'unsigned' : 'signed'
      const fileName = `contracts/${leadId}/${prefix}_${timestamp}.pdf`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('contracts')
        .getPublicUrl(fileName)

      // Update leads table
      const fieldToUpdate = isUnsigned ? 'unsigned_contract_url' : 'signed_contract_url'
      const { error: updateError } = await supabase
        .from('leads')
        .update({ [fieldToUpdate]: publicUrl })
        .eq('id', leadId)

      if (updateError) throw updateError

      return publicUrl
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['lead'] })
    },
  })
}

export function useUploadContractToEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      file,
      clientName,
      isUnsigned = false,
    }: {
      eventId: string
      file: File
      clientName: string
      isUnsigned?: boolean
    }) => {
      const timestamp = Date.now()
      const prefix = isUnsigned ? 'unsigned' : 'signed'
      const safeClientName = clientName.replace(/\s+/g, '_')
      const fileName = `contracts/${prefix}_${timestamp}_${safeClientName}.pdf`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('contracts')
        .getPublicUrl(fileName)

      // Update events table
      const fieldToUpdate = isUnsigned ? 'unsigned_contract_url' : 'signed_contract_url'
      const { error: updateError } = await supabase
        .from('events')
        .update({ [fieldToUpdate]: publicUrl })
        .eq('id', eventId)

      if (updateError) throw updateError

      return publicUrl
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['event'] })
    },
  })
}
