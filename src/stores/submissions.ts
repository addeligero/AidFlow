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
        const payload = {
          client_id: isNaN(Number(clientId)) ? clientId : Number(clientId),
          program_id: isNaN(Number(programId)) ? programId : Number(programId),
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase
          .from('client_submissions')
          .insert([payload])
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
        const bucket = options?.bucket || 'client-docs'
        const dir = options?.directory || 'uploads'

        // Upload file to Supabase Storage
        const ext = file.name.split('.').pop() || 'bin'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const storagePath = `${dir}/${submissionId}/${fileName}`
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, { upsert: true })
        if (uploadError) throw uploadError

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath)
        const publicUrl = pub.publicUrl

        // Insert client_documents row
        const insertPayload = {
          submission_id: isNaN(Number(submissionId)) ? submissionId : Number(submissionId),
          doc_type: docType,
          file_url: publicUrl,
          extracted_data: extractedData,
          verified: false,
          created_at: new Date().toISOString(),
        }
        const { data, error } = await supabase
          .from('client_documents')
          .insert([insertPayload])
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
