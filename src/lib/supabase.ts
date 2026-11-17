// Клиент Supabase — один на всё приложение.
// Во фронтенде только публичные URL и anon-ключ; права режут RLS и функции в базе.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY. Локально — в .env.local, на сайте — в настройках сборки Cloudflare.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'phone-market:auth',
  },
})
