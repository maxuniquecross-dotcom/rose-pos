import { useEffect, useState, type ReactNode } from 'react'
import { GROUPS } from '../data/menu'
import { lineSum, lineTitle, menuPrice, money, plural, round2, totals } from '../lib/format'
import type { CartLine, GroupId, MenuItem } from '../types'
import { useAuth } from '../auth'
import { usePos } from '../state'

export function ItemSheet({
  item,
  line,
  onClose,
}: {
  item: MenuItem
  line?: CartLine
  onClose: () => void
}) {
  const pos = usePos()
  const [variantId, setVariantId] = useState(line?.variantId ?? item.variants?.[0]?.id ?? '')
  const [modifierIds, setModifierIds] = useState<string[]>(line?.modifiers.map((modifier) => modifier.id) ?? [])
  const [qty, setQty] = useState(line?.qty ?? 1)
  const [note, setNote] = useState(line?.note ?? '')

  const variant = item.variants?.find((entry) => entry.id === variantId)
  const modifiers = (item.modifiers ?? []).filter((modifier) => modifierIds.includes(modifier.id))
  const price = round2((variant?.price ?? item.price) + modifiers.reduce((sum, modifier) => sum + modifier.price, 0))

  const save = () => {
    if (line) {
      const next: CartLine = {
        ...line,
        variantId: variant?.id,
        variantName: variant?.name,
        modifiers,
        unitPrice: price,
        qty,
        note: note.trim(),
      }
      pos.replaceLine(line.id, next)
    } else {
      pos.addItem(item, { variant, modifiers, qty, note })
    }
    onClose()
  }

  return (
    <Sheet title={item.name} onClose={onClose}>
      {(item.description || item.weight) && (
        <p className="sheet-copy">
          {item.description}
          {item.weight ? ` · ${item.weight}` : ''}
        </p>
      )}
      {item.variants && (
        <div className="choices">
          {item.variants.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={entry.id === variantId ? 'choice on' : 'choice'}
              onClick={() => setVariantId(entry.id)}
            >
              <span>{entry.name}</span>
              <b>{menuPrice(entry.price)}</b>
            </button>
          ))}
        </div>
      )}
      {item.modifiers?.map((modifier) => (
        <label key={modifier.id} className="checkline">
          <input
            type="checkbox"
            checked={modifierIds.includes(modifier.id)}
            onChange={() =>
              setModifierIds((current) =>
                current.includes(modifier.id) ? current.filter((id) => id !== modifier.id) : [...current, modifier.id],
              )
            }
          />
          <span>
            {modifier.name}
            <small>+{money(modifier.price)}</small>
          </span>
        </label>
      ))}
      <label className="field">
        Комментарий
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="без лука, поострее" />
      </label>
      <div className="qty-row">
        <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Меньше">
          −
        </button>
        <strong>{qty}</strong>
        <button type="button" onClick={() => setQty((value) => Math.min(99, value + 1))} aria-label="Больше">
          +
        </button>
      </div>
      <div className="sheet-actions">
        {line && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              pos.removeLine(line.id)
              onClose()
            }}
          >
            Убрать
          </button>
        )}
        <button type="button" className="btn primary" onClick={save}>
          {line ? 'Сохранить' : 'Добавить'} · {money(round2(price * qty))}
        </button>
      </div>
    </Sheet>
  )
}

export function CartSheet({ onClose }: { onClose: () => void }) {
  const pos = usePos()
  const [edit, setEdit] = useState<CartLine | null>(null)
  const [ask, setAsk] = useState(false)
  const summary = totals(pos.cart, pos.discountType, pos.discountValue)
  const count = pos.cart.reduce((sum, line) => sum + line.qty, 0)
  const editingItem = edit ? pos.catalog.find((item) => item.id === edit.itemId) : undefined

  return (
    <Sheet title="Заказ" onClose={onClose}>
      {pos.cart.length === 0 && <p className="sheet-copy">Пока пусто. Нажмите блюдо в меню.</p>}
      <ul className="cart-list">
        {pos.cart.map((line) => (
          <li key={line.id}>
            <button type="button" className="cart-line" onClick={() => setEdit(line)}>
              <span>
                <strong>
                  {line.qty} × {lineTitle(line)}
                </strong>
                {line.note && <em>{line.note}</em>}
              </span>
              <b>{money(lineSum(line))}</b>
            </button>
            <div className="mini-step">
              <button type="button" aria-label="Меньше" onClick={() => pos.setQty(line.id, line.qty - 1)}>
                −
              </button>
              <button type="button" aria-label="Больше" onClick={() => pos.setQty(line.id, line.qty + 1)}>
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="sum-line">
        <span>
          {count} {plural(count, ['позиция', 'позиции', 'позиций'])}
        </span>
        <strong>{money(summary.total)}</strong>
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn ghost" disabled={!count} onClick={() => setAsk(true)}>
          Очистить
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!count}
          onClick={() => {
            onClose()
            pos.setRoute({ name: 'checkout' })
          }}
        >
          К оплате
        </button>
      </div>
      {edit && editingItem && <ItemSheet item={editingItem} line={edit} onClose={() => setEdit(null)} />}
      {ask && (
        <Confirm
          text="Очистить весь заказ?"
          onNo={() => setAsk(false)}
          onYes={() => {
            pos.clearCart()
            setAsk(false)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

export function CategorySheet({
  current,
  onPick,
  onClose,
}: {
  current: GroupId | 'all'
  onPick: (group: GroupId | 'all') => void
  onClose: () => void
}) {
  const pos = usePos()
  const counts = new Map<string, number>()
  for (const item of pos.catalog) counts.set(item.group, (counts.get(item.group) ?? 0) + 1)

  return (
    <Sheet title="Категории" onClose={onClose}>
      <div className="cat-list">
        <button type="button" className={current === 'all' ? 'cat on' : 'cat'} onClick={() => onPick('all')}>
          <span>Все</span>
          <b>{pos.catalog.length}</b>
        </button>
        {GROUPS.map((group) => (
          <button type="button" key={group.id} className={current === group.id ? 'cat on' : 'cat'} onClick={() => onPick(group.id)}>
            <span>
              <i style={{ background: group.accent }} />
              {group.title}
            </span>
            <b>{counts.get(group.id) ?? 0}</b>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function StaffSheet({ onClose }: { onClose: () => void }) {
  const pos = usePos()
  const auth = useAuth()
  const todayKey = new Date().toDateString()
  const today = pos.sales.filter((sale) => !sale.cancelled && new Date(sale.createdAt).toDateString() === todayKey)
  const sum = today.reduce((total, sale) => total + sale.total, 0)
  const by = (payment: 'cash' | 'card' | 'transfer') =>
    today.filter((sale) => sale.payment === payment).reduce((total, sale) => total + sale.total, 0)

  return (
    <Sheet title="Смена" onClose={onClose}>
      <label className="field">
        Имя на чеке
        <input
          value={pos.settings.staff}
          onChange={(event) => pos.updateSettings({ staff: event.target.value })}
          placeholder="Администратор"
        />
      </label>
      <div className="stats">
        <div>
          <span>Чеков сегодня</span>
          <strong>{today.length}</strong>
        </div>
        <div>
          <span>Сумма</span>
          <strong>{money(sum)}</strong>
        </div>
      </div>
      <ul className="pay-split">
        <li>
          <span>Наличные</span>
          <b>{money(by('cash'))}</b>
        </li>
        <li>
          <span>Карта</span>
          <b>{money(by('card'))}</b>
        </li>
        <li>
          <span>Перевод</span>
          <b>{money(by('transfer'))}</b>
        </li>
      </ul>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          onClose()
          pos.setRoute({ name: 'settings' })
        }}
      >
        Настройки принтера
      </button>
      {auth.profile?.role === 'admin' && (
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            onClose()
            pos.setRoute({ name: 'admin' })
          }}
        >
          Сотрудники
        </button>
      )}
      {auth.configured && (
        <button type="button" className="btn text" onClick={() => void auth.signOut()}>
          Выйти
        </button>
      )}
    </Sheet>
  )
}

export function AddMenuSheet({ group, onClose }: { group: GroupId; onClose: () => void }) {
  const pos = usePos()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [section, setSection] = useState<GroupId>(group)
  const amount = Number(price.replace(',', '.'))
  const ready = name.trim().length > 0 && Number.isFinite(amount) && amount > 0

  return (
    <Sheet title="Новая позиция" onClose={onClose}>
      <label className="field">
        Название
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, кетчуп" autoFocus />
      </label>
      <label className="field">
        Цена
        <input
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value.replace(/[^\d,.]/g, ''))}
          placeholder="0,00"
        />
      </label>
      <p className="label">Раздел</p>
      <div className="seg">
        {GROUPS.map((entry) => (
          <button type="button" key={entry.id} className={section === entry.id ? 'on' : ''} onClick={() => setSection(entry.id)}>
            {entry.title}
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!ready}
          onClick={() => {
            pos.addMenuItem({ name, price: amount, group: section })
            onClose()
          }}
        >
          Добавить в меню
        </button>
      </div>
    </Sheet>
  )
}

function priceField(value: string, onChange: (next: string) => void) {
  return (
    <input
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/[^\d,.]/g, ''))}
      placeholder="0,00"
    />
  )
}

function parsePrice(value: string) {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function EditMenuSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const pos = usePos()
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(money(item.price))
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((item.variants ?? []).map((variant) => [variant.id, money(variant.price)])),
  )
  const variantAmounts = (item.variants ?? []).map((variant) => parsePrice(variantPrices[variant.id] ?? ''))
  const amount = parsePrice(price)
  const ready = name.trim().length > 0 && (item.variants?.length ? variantAmounts.every((value) => value !== null) : amount !== null)

  return (
    <Sheet title="Изменить блюдо" onClose={onClose}>
      <label className="field">
        Название
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </label>
      {item.variants?.length ? (
        item.variants.map((variant) => (
          <label className="field" key={variant.id}>
            {variant.name}
            {priceField(variantPrices[variant.id] ?? '', (next) => setVariantPrices((current) => ({ ...current, [variant.id]: next })))}
          </label>
        ))
      ) : (
        <label className="field">
          Цена
          {priceField(price, setPrice)}
        </label>
      )}
      <div className="sheet-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!ready}
          onClick={() => {
            const variants = item.variants?.map((variant, index) => ({ id: variant.id, price: variantAmounts[index] ?? variant.price }))
            pos.updateMenuItem(item.id, {
              name,
              price: variants?.length ? Math.min(...variants.map((variant) => variant.price)) : (amount ?? item.price),
              variants,
            })
            onClose()
          }}
        >
          Сохранить
        </button>
        {item.edited && !item.custom && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              pos.resetMenuItem(item.id)
              onClose()
            }}
          >
            Как в меню
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function InstallHint() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    setHidden(Boolean(standalone || localStorage.getItem('rose-pos:install-hidden')))
  }, [])

  if (hidden) return null

  return (
    <>
      <div className="hint">
        <span>На экран «Домой»</span>
        <button type="button" onClick={() => setOpen(true)}>
          Как
        </button>
        <button
          type="button"
          aria-label="Скрыть"
          onClick={() => {
            localStorage.setItem('rose-pos:install-hidden', '1')
            setHidden(true)
          }}
        >
          ×
        </button>
      </div>
      {open && (
        <Sheet title="На экран «Домой»" onClose={() => setOpen(false)}>
          <p className="sheet-copy">iPhone: откройте эту страницу в Safari, нажмите «Поделиться» и выберите «На экран Домой».</p>
          <p className="sheet-copy">Android: откройте в Chrome, меню браузера, затем «Установить приложение» или «Добавить на главный экран».</p>
        </Sheet>
      )}
    </>
  )
}

export function Sheet({ title, onClose, children, light = false }: { title: string; onClose: () => void; children: ReactNode; light?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={light ? 'overlay light' : 'overlay'}>
      <button type="button" className="backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" />
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="overlay confirm">
      <button type="button" className="backdrop" aria-label="Отмена" onClick={onNo} />
      <div className="confirm-box" role="dialog" aria-modal="true">
        <p>{text}</p>
        <div>
          <button type="button" onClick={onNo}>
            Нет
          </button>
          <button type="button" className="danger" onClick={onYes}>
            Да
          </button>
        </div>
      </div>
    </div>
  )
}
