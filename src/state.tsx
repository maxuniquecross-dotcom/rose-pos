import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { GROUPS, MENU } from './data/menu'
import type { CartLine, DiscountType, GroupId, MenuItem, Modifier, Payment, Route, Sale, Settings, Variant, ViewMode } from './types'
import { DEFAULT_SETTINGS } from './types'
import { round2, totals } from './lib/format'
import { flushOutbox, mergeSales, pullMySales, pushCancel, pushSale, saveStaff } from './lib/cloud'
import { supabase } from './lib/supabase'

const STORAGE = {
  cart: 'rose-pos:cart',
  sales: 'rose-pos:sales',
  settings: 'rose-pos:settings',
  view: 'rose-pos:view',
  draft: 'rose-pos:draft',
  menu: 'rose-pos:menu',
  edits: 'rose-pos:edits',
}

type MenuEdit = {
  name: string
  price: number
  variants?: { id: string; price: number }[]
}

type Draft = {
  table: string
  discountType: DiscountType
  discountValue: number
}

type PosApi = {
  cart: CartLine[]
  sales: Sale[]
  settings: Settings
  view: ViewMode
  route: Route
  table: string
  discountType: DiscountType
  discountValue: number
  toast: string
  setRoute: (route: Route) => void
  setView: (view: ViewMode) => void
  updateSettings: (patch: Partial<Settings>) => void
  setTable: (table: string) => void
  setDiscount: (type: DiscountType, value: number) => void
  addItem: (item: MenuItem, options?: { variant?: Variant; modifiers?: Modifier[]; qty?: number; note?: string }) => void
  setQty: (lineId: string, qty: number) => void
  setNote: (lineId: string, note: string) => void
  replaceLine: (lineId: string, line: CartLine) => void
  removeLine: (lineId: string) => void
  clearCart: () => void
  checkout: (payment: Payment, cashReceived: number | null) => Sale
  cancelSale: (saleId: string) => void
  catalog: MenuItem[]
  addMenuItem: (input: { name: string; price: number; group: GroupId }) => void
  updateMenuItem: (itemId: string, patch: MenuEdit) => void
  resetMenuItem: (itemId: string) => void
  removeMenuItem: (itemId: string) => void
  notify: (text: string) => void
  preview: Sale | null
  showSale: (sale: Sale) => void
  qtyOf: (itemId: string) => number
}

const PosContext = createContext<PosApi | null>(null)

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function unitPrice(item: MenuItem, variant?: Variant, modifiers: Modifier[] = []) {
  const base = variant?.price ?? item.price
  return round2(base + modifiers.reduce((sum, modifier) => sum + modifier.price, 0))
}

export function PosProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(() => read(STORAGE.cart, []))
  const [sales, setSales] = useState<Sale[]>(() => read(STORAGE.sales, []))
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...read(STORAGE.settings, {}) }))
  const [view, setViewState] = useState<ViewMode>(() => read(STORAGE.view, 'cards'))
  const [draft, setDraft] = useState<Draft>(() =>
    read(STORAGE.draft, { table: '', discountType: 'none', discountValue: 0 }),
  )
  const [customItems, setCustomItems] = useState<MenuItem[]>(() => read(STORAGE.menu, []))
  const [edits, setEdits] = useState<Record<string, MenuEdit>>(() => read(STORAGE.edits, {}))
  const [route, setRoute] = useState<Route>({ name: 'pos' })
  const [toast, setToast] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Sale | null>(null)
  const catalog = useMemo(() => {
    const apply = (item: MenuItem): MenuItem => {
      const edit = edits[item.id]
      if (!edit) return item
      return {
        ...item,
        name: edit.name,
        price: edit.price,
        edited: true,
        variants: item.variants?.map((variant) => {
          const next = edit.variants?.find((entry) => entry.id === variant.id)
          return next ? { ...variant, price: next.price } : variant
        }),
      }
    }
    return [...customItems.map(apply), ...MENU.map(apply)]
  }, [customItems, edits])

  useEffect(() => write(STORAGE.cart, cart), [cart])
  useEffect(() => write(STORAGE.sales, sales), [sales])
  useEffect(() => write(STORAGE.settings, settings), [settings])
  useEffect(() => write(STORAGE.view, view), [view])
  useEffect(() => write(STORAGE.draft, draft), [draft])
  useEffect(() => write(STORAGE.menu, customItems), [customItems])
  useEffect(() => write(STORAGE.edits, edits), [edits])

  useEffect(() => {
    if (!supabase) return
    const apply = (userId: string | null) => {
      setAccountId(userId)
      if (!userId) return
      void pullMySales(userId).then((remote) => {
        setSales((current) => mergeSales(current, remote))
      })
      void flushOutbox()
    }
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const notify = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast((current) => (current === text ? '' : current)), 1800)
  }

  const api = useMemo<PosApi>(() => {
    const addItem: PosApi['addItem'] = (item, options) => {
      const variant = options?.variant
      const modifiers = options?.modifiers ?? []
      const note = options?.note?.trim() ?? ''
      const qty = Math.max(1, options?.qty ?? 1)
      const price = unitPrice(item, variant, modifiers)
      setCart((current) => {
        const index = current.findIndex(
          (line) =>
            line.itemId === item.id &&
            line.variantId === variant?.id &&
            line.note === note &&
            line.modifiers.map((modifier) => modifier.id).join() === modifiers.map((modifier) => modifier.id).join(),
        )
        if (index >= 0 && !options?.qty) {
          const next = [...current]
          next[index] = { ...next[index], qty: Math.min(99, next[index].qty + 1) }
          return next
        }
        if (index >= 0 && options?.qty) {
          const next = [...current]
          next[index] = { ...next[index], qty: Math.min(99, next[index].qty + qty), unitPrice: price }
          return next
        }
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            itemId: item.id,
            name: item.name,
            variantId: variant?.id,
            variantName: variant?.name,
            modifiers,
            unitPrice: price,
            qty: Math.min(99, qty),
            note,
          },
        ]
      })
      navigator.vibrate?.(12)
    }

    return {
      cart,
      sales: accountId ? sales.filter((sale) => sale.userId === accountId) : sales,
      settings,
      view,
      route,
      table: draft.table,
      discountType: draft.discountType,
      discountValue: draft.discountValue,
      toast,
      setRoute,
      setView: setViewState,
      updateSettings: (patch) => {
        setSettings((current) => ({ ...current, ...patch }))
        if (patch.staff !== undefined) void saveStaff(patch.staff)
      },
      setTable: (table) => setDraft((current) => ({ ...current, table })),
      setDiscount: (discountType, discountValue) => setDraft((current) => ({ ...current, discountType, discountValue })),
      addItem,
      setQty: (lineId, qty) =>
        setCart((current) =>
          qty <= 0 ? current.filter((line) => line.id !== lineId) : current.map((line) => (line.id === lineId ? { ...line, qty } : line)),
        ),
      setNote: (lineId, note) => setCart((current) => current.map((line) => (line.id === lineId ? { ...line, note } : line))),
      replaceLine: (lineId, line) =>
        setCart((current) => (line.qty <= 0 ? current.filter((item) => item.id !== lineId) : current.map((item) => (item.id === lineId ? line : item)))),
      removeLine: (lineId) => setCart((current) => current.filter((line) => line.id !== lineId)),
      clearCart: () => {
        setCart([])
        setDraft({ table: '', discountType: 'none', discountValue: 0 })
      },
      checkout: (payment, cashReceived) => {
        const summary = totals(cart, draft.discountType, draft.discountValue)
        const sale: Sale = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          staff: settings.staff.trim() || 'Администратор',
          table: draft.table,
          lines: cart,
          discountType: draft.discountType,
          discountValue: draft.discountValue,
          subtotal: summary.subtotal,
          discount: summary.discount,
          total: summary.total,
          payment,
          cashReceived,
          cancelled: false,
          userId: accountId ?? undefined,
        }
        setSales((current) => [sale, ...current])
        setCart([])
        setDraft({ table: '', discountType: 'none', discountValue: 0 })
        void pushSale(sale)
        return sale
      },
      cancelSale: (saleId) =>
        setSales((current) =>
          current.map((sale) => {
            if (sale.id !== saleId) return sale
            const next = { ...sale, cancelled: true }
            void pushCancel(next)
            return next
          }),
        ),
      catalog,
      addMenuItem: ({ name, price, group }) => {
        const section = GROUPS.find((entry) => entry.id === group)?.title ?? 'Своё'
        const item: MenuItem = {
          id: `custom-${crypto.randomUUID()}`,
          group,
          section,
          name: name.trim(),
          price: round2(price),
          custom: true,
        }
        setCustomItems((current) => [item, ...current])
        notify('Позиция добавлена в меню')
      },
      updateMenuItem: (itemId, patch) => {
        const name = patch.name.trim()
        const price = round2(patch.price)
        const variants = patch.variants?.map((variant) => ({ id: variant.id, price: round2(variant.price) }))
        const custom = customItems.some((item) => item.id === itemId)
        if (custom) {
          setCustomItems((current) =>
            current.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    name,
                    price,
                    variants: item.variants?.map((variant) => {
                      const next = variants?.find((entry) => entry.id === variant.id)
                      return next ? { ...variant, price: next.price } : variant
                    }),
                  }
                : item,
            ),
          )
        } else {
          setEdits((current) => ({ ...current, [itemId]: { name, price, variants } }))
        }
        setCart((current) =>
          current.map((line) => {
            if (line.itemId !== itemId) return line
            const variantPrice = variants?.find((variant) => variant.id === line.variantId)?.price
            const base = variantPrice ?? price
            const extra = line.modifiers.reduce((sum, modifier) => sum + modifier.price, 0)
            return { ...line, name, unitPrice: round2(base + extra) }
          }),
        )
        notify('Блюдо обновлено')
      },
      resetMenuItem: (itemId) => {
        const original = MENU.find((item) => item.id === itemId)
        setEdits((current) => {
          const next = { ...current }
          delete next[itemId]
          return next
        })
        if (original) {
          setCart((current) =>
            current.map((line) => {
              if (line.itemId !== itemId) return line
              const variant = original.variants?.find((entry) => entry.id === line.variantId)
              const extra = line.modifiers.reduce((sum, modifier) => sum + modifier.price, 0)
              return { ...line, name: original.name, unitPrice: round2((variant?.price ?? original.price) + extra) }
            }),
          )
        }
        notify('Вернул как в меню')
      },
      removeMenuItem: (itemId) => {
        setCustomItems((current) => current.filter((item) => item.id !== itemId))
        setEdits((current) => {
          if (!current[itemId]) return current
          const next = { ...current }
          delete next[itemId]
          return next
        })
        notify('Позиция убрана из меню')
      },
      notify,
      preview,
      showSale: (sale) => {
        setPreview(sale)
        setSales((current) => (current.some((item) => item.id === sale.id) ? current : [sale, ...current]))
        setRoute({ name: 'receipt', saleId: sale.id, fresh: false })
      },
      qtyOf: (itemId) => cart.filter((line) => line.itemId === itemId).reduce((sum, line) => sum + line.qty, 0),
    }
  }, [cart, sales, settings, view, route, draft, toast, catalog, accountId, preview])

  return <PosContext.Provider value={api}>{children}</PosContext.Provider>
}

export function usePos() {
  const value = useContext(PosContext)
  if (!value) throw new Error('usePos вне провайдера')
  return value
}
