import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 通过 Vercel 代理访问 Supabase，解决网络问题
const supabaseUrl = window.location.origin + '/sb'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'placeholder'
)
