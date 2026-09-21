import { createClient } from '@supabase/supabase-js'

// The separate local previews must never read or refresh the organizer's session.
// Vite eliminates this branch from the production build.
const localPreview = import.meta.env.DEV && ['/applicant-preview.html', '/admin-preview.html'].includes(window.location.pathname)
const supabaseUrl = localPreview ? 'https://applicant-preview.invalid' : import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = localPreview ? 'preview-only-key' : import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: !localPreview,
    persistSession: !localPreview,
    autoRefreshToken: !localPreview,
  },
})
