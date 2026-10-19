import { useEffect, useMemo, useRef, useState } from 'react'
import { GROUPS, SECTION_NOTES, groupOf } from '../data/menu'
import { money, norm, plural, priceLabel, totals } from '../lib/format'
import type { GroupId, MenuItem } from '../types'
import { usePos } from '../state'
import { IconCheck, IconGrid, IconList, IconMenu, IconPencil, IconPlus, IconReceipt, IconSearch, IconUser } from './icons'
import { AddMenuSheet, CartSheet, CategorySheet, Confirm, EditMenuSheet, InstallHint, ItemSheet, StaffSheet } from './overlays'

export function PosScreen() {
  const pos = usePos()
  const [group, setGroup] = useState<GroupId | 'all'>('all')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const summary = totals(pos.cart, pos.discountType, pos.discountValue)
  const count = pos.cart.reduce((sum, line) => sum + line.qty, 0)

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  const items = useMemo(() => {
    const q = norm(query.trim())
    return pos.catalog.filter((item) => {
      if (!q && group !== 'all' && item.group !== group) return false
      if (!q) return true
      const hay = norm(`${item.name} ${item.description ?? ''} ${item.section} ${item.weight ?? ''}`)
      return hay.includes(q)
    })
  }, [group, query, pos.catalog])

  const sections = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const item of items) {
      const list = map.get(item.section) ?? []
      list.push(item)
      map.set(item.section, list)
    }
    return [...map.entries()]
  }, [items])

  const openItem = (item: MenuItem) => {
    if (item.variants?.length || item.modifiers?.length) {
      setPicked(item)
      return
    }
    pos.addItem(item)
  }

  const goCheckout = () => {
    if (!count) {
      pos.notify('Сначала добавьте позиции')
      return
    }
    pos.setRoute({ name: 'checkout' })
  }

  return (
    <div className="pos">
      <div className="main">
      <header className="top">
        <div>
          <div className="brand">Rose</div>
          <div className="who">{pos.settings.staff}</div>
        </div>
        <div className="top-sum">
          <span>{count ? `${count} ${plural(count, ['позиция', 'позиции', 'позиций'])}` : 'Нет заказа'}</span>
          <strong>{money(summary.total)}</strong>
        </div>
      </header>

      <InstallHint />

      {searching ? (
        <div className="searchbar">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Блюдо, вино, напиток"
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={() => {
              setSearching(false)
              setQuery('')
            }}
          >
            Отмена
          </button>
        </div>
      ) : (
        <div className="chips" role="tablist" aria-label="Разделы меню">
          <button type="button" className={group === 'all' ? 'chip on' : 'chip'} onClick={() => setGroup('all')}>
            Все
          </button>
          {GROUPS.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={group === entry.id ? 'chip on' : 'chip'}
              onClick={() => setGroup(entry.id)}
            >
              {entry.title}
            </button>
          ))}
        </div>
      )}

      <div className="scroller">
        {sections.length === 0 && <div className="empty">Ничего не нашлось</div>}
        {sections.map(([title, list]) => (
          <section key={title} className="menu-section">
            <h2>
              {title}
              <span>{list.length}</span>
            </h2>
            {SECTION_NOTES[title] && <p className="section-note">{SECTION_NOTES[title]}</p>}
            <div className={pos.view === 'cards' ? 'cards' : 'rows'}>
              {list.map((item) =>
                pos.view === 'cards' ? (
                  <Card
                    key={item.id}
                    item={item}
                    qty={pos.qtyOf(item.id)}
                    onOpen={() => openItem(item)}
                    onEdit={() => setEditing(item)}
                    onRemove={() => setDropId(item.id)}
                  />
                ) : (
                  <Row
                    key={item.id}
                    item={item}
                    qty={pos.qtyOf(item.id)}
                    onOpen={() => openItem(item)}
                    onEdit={() => setEditing(item)}
                    onRemove={() => setDropId(item.id)}
                  />
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <button type="button" className="dock" onClick={() => (count ? setCartOpen(true) : pos.notify('Заказ пока пуст'))}>
        <span>{count ? 'Заказ' : 'Пусто'}</span>
        <strong>{money(summary.total)}</strong>
        <em>{count ? 'Открыть' : ''}</em>
      </button>
      </div>

      <aside className="rail">
        <button type="button" aria-label="Категории" onClick={() => setCategoriesOpen(true)}>
          <IconMenu />
        </button>
        <button type="button" aria-label="Сотрудник" onClick={() => setStaffOpen(true)}>
          <IconUser />
        </button>
        <button
          type="button"
          aria-label={pos.view === 'cards' ? 'Показать списком' : 'Показать карточками'}
          onClick={() => pos.setView(pos.view === 'cards' ? 'list' : 'cards')}
        >
          {pos.view === 'cards' ? <IconList /> : <IconGrid />}
        </button>
        <button type="button" aria-label="Поиск" onClick={() => setSearching(true)}>
          <IconSearch />
        </button>
        <button type="button" aria-label="Чеки" onClick={() => pos.setRoute({ name: 'history' })}>
          <IconReceipt />
        </button>
        <div className="rail-gap" />
        <button type="button" className="add" aria-label="Новая позиция" onClick={() => setAdding(true)}>
          <IconPlus />
        </button>
        <button type="button" className={count ? 'go on' : 'go'} aria-label="К оплате" onClick={goCheckout}>
          <IconCheck />
          {count > 0 && <i>{count}</i>}
        </button>
      </aside>

      {picked && <ItemSheet item={picked} onClose={() => setPicked(null)} />}
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
      {categoriesOpen && (
        <CategorySheet
          current={group}
          onPick={(next) => {
            setGroup(next)
            setSearching(false)
            setQuery('')
            setCategoriesOpen(false)
          }}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
      {staffOpen && <StaffSheet onClose={() => setStaffOpen(false)} />}
      {adding && <AddMenuSheet group={group === 'all' ? 'mains' : group} onClose={() => setAdding(false)} />}
      {editing && <EditMenuSheet item={editing} onClose={() => setEditing(null)} />}
      {dropId && (
        <Confirm
          text="Убрать эту позицию из меню?"
          onNo={() => setDropId(null)}
          onYes={() => {
            pos.removeMenuItem(dropId)
            setDropId(null)
          }}
        />
      )}
    </div>
  )
}

function Card({
  item,
  qty,
  onOpen,
  onEdit,
  onRemove,
}: {
  item: MenuItem
  qty: number
  onOpen: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const pos = usePos()
  const complex = Boolean(item.variants?.length || item.modifiers?.length)
  const accent = groupOf(item.group).accent

  const simpleLine = pos.cart.find((line) => line.itemId === item.id && !line.variantId && line.modifiers.length === 0 && !line.note)

  return (
    <article className={`${qty ? 'card in' : 'card'} has-tools${item.custom ? ' has-x' : ''}`} style={{ ['--accent' as string]: accent }}>
      <button type="button" className="card-hit" onClick={onOpen}>
        <span className="eyebrow">{item.custom ? 'Своё' : item.section}</span>
        <strong>{item.name}</strong>
        {(item.description || item.weight) && (
          <em>
            {item.description}
            {item.description && item.weight ? ' · ' : ''}
            {item.weight}
          </em>
        )}
      </button>
      <footer>
        {simpleLine && !complex ? (
          <div className="stepper">
            <button type="button" aria-label="Меньше" onClick={() => pos.setQty(simpleLine.id, simpleLine.qty - 1)}>
              −
            </button>
            <span>{simpleLine.qty}</span>
            <button type="button" aria-label="Больше" onClick={() => pos.addItem(item)}>
              +
            </button>
          </div>
        ) : (
          <span className="meta">{qty > 0 ? `в заказе ${qty}` : item.weight || ''}</span>
        )}
        <b>{priceLabel(item.price, item.variants)}</b>
      </footer>
      <div className="card-tools">
        <button type="button" className="card-tool" aria-label="Изменить блюдо" onClick={onEdit}>
          <IconPencil />
        </button>
        {item.custom && (
          <button type="button" className="card-tool" aria-label="Убрать из меню" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
    </article>
  )
}

function Row({
  item,
  qty,
  onOpen,
  onEdit,
  onRemove,
}: {
  item: MenuItem
  qty: number
  onOpen: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div className={qty ? 'line in' : 'line'}>
      <button type="button" onClick={onOpen}>
        {qty > 0 && <i>{qty}</i>}
        <span>{item.name}</span>
        <b>{priceLabel(item.price, item.variants)}</b>
      </button>
      <button type="button" className="line-x" aria-label="Изменить блюдо" onClick={onEdit}>
        <IconPencil />
      </button>
      {item.custom && (
        <button type="button" className="line-x" aria-label="Убрать из меню" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}
