import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const realSupabaseUrl = 'https://ltcouifrhmsmsicvsgz.supabase.co'

function proxyFetch(url, options) {
  var proxyUrl = '/api/proxy?url=' + encodeURIComponent(url.toString())
  return fetch(proxyUrl, options)
}

export const supabase = createClient(
  realSupabaseUrl,
  supabaseAnonKey || 'placeholder',
  { global: { fetch: proxyFetch } }
)
