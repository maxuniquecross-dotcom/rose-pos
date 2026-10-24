import type { MenuItem, Sale } from '../types'
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

export type MenuEditRecord = {
  name: string
  price: number
  variants?: { id: string; price: number }[]
  updatedAt?: string
}

export type MenuOverride = {
  id: string
  kind: 'edit' | 'custom' | 'gone'
  payload: MenuEditRecord | (MenuItem & { updatedAt?: string }) | Record<string, never>
  updated_at: string
}

export async function pullMenu() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const { data: rows, error } = await supabase.from('menu_overrides').select('id, kind, payload, updated_at')
  if (error || !rows) return null
  return rows as MenuOverride[]
}

export async function saveMenuOverride(id: string, kind: MenuOverride['kind'], payload: MenuOverride['payload'], updatedAt: string) {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  if (!data.session) return false
  const { error } = await supabase.from('menu_overrides').upsert({ id, kind, payload, updated_at: updatedAt })
  return !error
}

export async function clearMenuOverride(id: string) {
  const updatedAt = new Date().toISOString()
  return saveMenuOverride(id, 'gone', {}, updatedAt)
}

function newer(left?: string, right?: string) {
  if (!left) return false
  const first = Date.parse(left)
  const second = right ? Date.parse(right) : 0
  if (Number.isNaN(first)) return false
  if (Number.isNaN(second)) return true
  return first > second + 1000
}

export function mergeMenu(
  localEdits: Record<string, MenuEditRecord>,
  localCustom: Array<MenuItem & { updatedAt?: string }>,
  rows: MenuOverride[],
) {
  const nextEdits: Record<string, MenuEditRecord> = {}
  const nextCustom: Array<MenuItem & { updatedAt?: string }> = []
  const push: MenuOverride[] = []
  const remoteIds = new Set<string>()

  for (const row of rows) {
    remoteIds.add(row.id)
    if (row.kind === 'gone') {
      const localEdit = localEdits[row.id]
      const localCustomItem = localCustom.find((item) => item.id === row.id)
      const localAt = localEdit?.updatedAt || localCustomItem?.updatedAt
      if (newer(localAt, row.updated_at)) {
        if (localEdit) {
          nextEdits[row.id] = localEdit
          push.push({ id: row.id, kind: 'edit', payload: localEdit, updated_at: localEdit.updatedAt || row.updated_at })
        } else if (localCustomItem) {
          nextCustom.push(localCustomItem)
          push.push({ id: row.id, kind: 'custom', payload: localCustomItem, updated_at: localCustomItem.updatedAt || row.updated_at })
        }
      }
      continue
    }
    if (row.kind === 'edit') {
      const remote = row.payload as MenuEditRecord
      const local = localEdits[row.id]
      if (newer(local?.updatedAt, row.updated_at)) {
        nextEdits[row.id] = local
        push.push({ id: row.id, kind: 'edit', payload: local, updated_at: local.updatedAt || row.updated_at })
      } else {
        nextEdits[row.id] = { ...remote, updatedAt: row.updated_at }
      }
    }
    if (row.kind === 'custom') {
      const remote = row.payload as MenuItem & { updatedAt?: string }
      const local = localCustom.find((item) => item.id === row.id)
      if (newer(local?.updatedAt, row.updated_at)) {
        nextCustom.push(local as MenuItem & { updatedAt?: string })
        push.push({ id: row.id, kind: 'custom', payload: local as MenuOverride['payload'], updated_at: local?.updatedAt || row.updated_at })
      } else {
        nextCustom.push({ ...remote, updatedAt: row.updated_at })
      }
    }
  }

  for (const [id, edit] of Object.entries(localEdits)) {
    if (remoteIds.has(id)) continue
    const updatedAt = edit.updatedAt || new Date().toISOString()
    const payload = { ...edit, updatedAt }
    nextEdits[id] = payload
    push.push({ id, kind: 'edit', payload, updated_at: updatedAt })
  }

  for (const item of localCustom) {
    if (remoteIds.has(item.id)) continue
    const updatedAt = item.updatedAt || new Date().toISOString()
    const payload = { ...item, updatedAt }
    nextCustom.push(payload)
    push.push({ id: item.id, kind: 'custom', payload, updated_at: updatedAt })
  }

  nextCustom.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return { edits: nextEdits, custom: nextCustom, push }
}

export async function saveStaff(staff: string) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return
  await supabase.from('profiles').update({ staff: staff.trim() || 'Администратор' }).eq('id', userId)
}
