import { createClient } from 'npm:@supabase/supabase-js@2'

/** Проверяет, что запрос от вошедшего администратора (JWT + строка в admins). */
export async function isAdmin(req: Request): Promise<boolean> {
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return false
  const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData } = await userDb.auth.getUser()
  if (!userData.user) return false
  // RLS: пользователь видит только свою строку в admins.
  const { data } = await userDb.from('admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
  return data !== null
}
