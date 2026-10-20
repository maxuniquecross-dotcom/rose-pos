import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function digest(text: string, seed: number) {
  let hash = seed
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function loginEmail(login: string) {
  const clean = login.trim().toLowerCase()
  if (/^[a-z0-9._-]{2,40}$/.test(clean)) return `${clean}@users.rose-pos.app`
  const bytes = new TextEncoder().encode(clean)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const token = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
  if (token.length <= 48) return `${token}@users.rose-pos.app`
  const folded = `${digest(clean, 2166136261)}${digest(clean, 2166136261 ^ clean.length)}${digest([...clean].reverse().join(''), 2166136261)}`
  return `u${folded}@users.rose-pos.app`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = request.headers.get('Authorization') ?? ''

  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Нужно войти' }, 401)

  const { data: profile } = await caller.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
  if (profile?.role !== 'admin') return json({ error: 'Только для администратора' }, 403)

  const body = (await request.json().catch(() => null)) as {
    action?: string
    login?: string
    password?: string
    staff?: string
  } | null
  const login = body?.login?.trim().toLowerCase() ?? ''
  const password = body?.password ?? ''
  const staff = body?.staff?.trim() || login
  if (login.length < 2 || login.length > 40 || /[\s@]/.test(login)) return json({ error: 'Логин: 2–40 символов, без пробелов' }, 400)
  if (password.length < 8) return json({ error: 'Пароль от 8 символов' }, 400)

  const admin = createClient(url, service)
  const email = loginEmail(login)

  if (body?.action === 'password') {
    const { data: target } = await caller.from('profiles').select('id').eq('username', login).maybeSingle()
    if (!target) return json({ error: 'Такого логина нет' }, 404)
    const { error } = await admin.auth.admin.updateUserById(target.id, { password })
    if (error) return json({ error: 'Не удалось сменить пароль' }, 400)
    return json({ ok: true })
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: login, staff },
  })
  if (error) {
    const taken = error.message.toLowerCase().includes('already')
    return json({ error: taken ? 'Такой логин уже есть' : 'Не удалось создать учётку' }, taken ? 409 : 400)
  }
  if (created.user) {
    await admin.from('profiles').update({ staff, username: login }).eq('id', created.user.id)
  }
  return json({ ok: true })
})
