import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseUrl = window.location.origin + '/sb'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'placeholder'
)
