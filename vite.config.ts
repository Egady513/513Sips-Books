import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_ACTIONS ? '/513Sips-Books/' : '/',
  define: {
    // Embed Supabase config at build time for GitHub Pages (anon key is safe to expose)
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || 'https://bixyltkdymoqjipaiujk.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeHlsdGtkeW1vcWppcGFpdWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTY0MTMsImV4cCI6MjA4OTM3MjQxM30.xqaK35aar9lSweeTA8ydeW8WT8ZiOrOl5NFa957MkjU'
    ),
  },
})
