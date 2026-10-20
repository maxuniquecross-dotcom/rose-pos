import type { Sale } from '../types'
import { supabase } from './supabase'

const OUTBOX = 'rose-pos:outbox'

function readOutbox(): Sale[] {
  try {
    const raw = localStorage.getItem(OUTBOX)
    return raw ? (JSON.parse(raw) as Sale[]) : []
  } catch {
    return []
  }
}

function writeOutbox(sales: Sale[]) {
  localStorage.setItem(OUTBOX, JSON.stringify(sales))
}

export async function pushSale(sale: Sale) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return
  const { error } = await supabase.from('sales').upsert({
    id: sale.id,
    user_id: userId,
    created_at: sale.createdAt,
    total: sale.total,
    payment: sale.payment,
    cancelled: sale.cancelled,
    staff: sale.staff,
    payload: sale,
  })
  const queued = readOutbox().filter((item) => item.id !== sale.id)
  if (error) writeOutbox([...queued, sale])
  else writeOutbox(queued)
}

export async function pushCancel(sale: Sale) {
  if (!supabase) return
  const next = { ...sale, cancelled: true }
  const { error } = await supabase.from('sales').update({ cancelled: true, payload: next }).eq('id', sale.id)
  if (error) await pushSale(next)
}

export async function flushOutbox() {
  const pending = readOutbox()
  for (const sale of pending) await pushSale(sale)
}

export async function pullMySales(userId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('sales').select('payload').eq('user_id', userId).order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => row.payload as Sale).filter((sale) => sale && typeof sale.id === 'string')
}

export function mergeSales(local: Sale[], remote: Sale[]) {
  const map = new Map<string, Sale>()
  for (const sale of remote) map.set(sale.id, sale)
  for (const sale of local) {
    const other = map.get(sale.id)
    if (!other) map.set(sale.id, sale)
    else map.set(sale.id, { ...other, ...sale, cancelled: sale.cancelled || other.cancelled })
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveStaff(staff: string) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return
  await supabase.from('profiles').update({ staff: staff.trim() || 'Администратор' }).eq('id', userId)
}
