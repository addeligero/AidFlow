import { defineStore } from 'pinia'
import supabase from '../lib/Supabase'

export type ClientSubmission = {
  id: string | number
  client_id: string | number
  program_id: string | number
  status: 'pending' | 'approved' | 'rejected' | string
  decision_tree_result?: string | null
  remarks?: string | null
  created_at?: string
  updated_at?: string
}

export type ClientDocument = {
  id: string | number
  submission_id: string | number
  doc_type: string
  file_url: string
  extracted_data: unknown
  verified: boolean
  created_at?: string
}

export const useSubmissionsStore = defineStore('submissions', {
  state: () => ({
    creating: false as boolean,
    uploading: false as boolean,
  }),
  actions: {
    async createSubmission(clientId: string | number, programId: string | number) {
      this.creating = true
      try {
        const { data, error } = await supabase
          .from('client_submissions')
          .insert([
            {
              client_id: Number(clientId),
              program_id: Number(programId),
              status: 'pending',
            },
          ])
          .select('id')
          .single()
        if (error) throw error
        return String(data.id)
      } finally {
        this.creating = false
      }
    },

    async addDocument(
      submissionId: string | number,
      docType: string,
      file: File,
      extractedData: unknown,
      options?: { bucket?: string; directory?: string },
    ) {
      this.uploading = true
      try {
        const bucket = (options?.bucket || 'client-submissions').trim() // prefer no space
        const dir = options?.directory || 'uploads' // ensure matches any storage policy

        if (!submissionId) throw new Error('Missing submissionId')
        if (!file) throw new Error('Missing file')

        const ext = file.name.split('.').pop() || 'bin'
        const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}.${ext}`
        const storagePath = `${dir}/${submissionId}/${fileName}`

        console.debug('[storage] uploading to', bucket, storagePath)

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, { upsert: false })

        if (uploadError) {
          console.error('[storage] uploadError', uploadError)
          throw new Error(uploadError.message || 'Upload failed')
        }

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath)
        const publicUrl = pub.publicUrl

        const { data, error } = await supabase
          .from('client_documents')
          .insert([
            {
              submission_id: Number(submissionId),
              doc_type: docType,
              file_url: publicUrl,
              extracted_data: extractedData,
              verified: false,
            },
          ])
          .select('id')
          .single()
        if (error) throw error
        return String(data.id)
      } finally {
        this.uploading = false
      }
    },
  },
})
