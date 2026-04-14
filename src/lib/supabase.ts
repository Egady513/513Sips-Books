import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bixyltkdymoqjipaiujk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeHlsdGtkeW1vcWppcGFpdWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTY0MTMsImV4cCI6MjA4OTM3MjQxM30.xqaK35aar9lSweeTA8ydeW8WT8ZiOrOl5NFa957MkjU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
