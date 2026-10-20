import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url, anonKey) : null

function digest(text: string, seed: number) {
  let hash = seed
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function loginEmail(login: string) {
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

export function authError(message: string) {
  const text = message.toLowerCase()
  if (text.includes('invalid login') || text.includes('invalid credentials')) return 'Неверный логин или пароль'
  if (text.includes('email not confirmed')) return 'Почта учётки ещё не подтверждена'
  if (text.includes('failed to fetch') || text.includes('network')) return 'Нет сети'
  return 'Не удалось войти'
}
