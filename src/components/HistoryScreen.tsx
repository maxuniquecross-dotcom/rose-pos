import { dayLabel, formatTime, money, plural } from '../lib/format'
import { usePos } from '../state'
import { IconBack } from './icons'

const PAYMENT = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод' } as const

export function HistoryScreen() {
  const pos = usePos()
  const groups: { label: string; ids: string[] }[] = []
  for (const sale of pos.sales) {
    const label = dayLabel(sale.createdAt)
    const last = groups[groups.length - 1]
    if (!last || last.label !== label) groups.push({ label, ids: [sale.id] })
    else last.ids.push(sale.id)
  }

  return (
    <div className="history">
      <header className="subhead">
        <button type="button" onClick={() => pos.setRoute({ name: 'pos' })} aria-label="Назад">
          <IconBack />
        </button>
        <h1>Чеки</h1>
        <span />
      </header>
      <div className="history-scroll">
        {pos.sales.length === 0 && <div className="empty">Чеков ещё нет</div>}
        {groups.map((group) => (
          <section key={group.label}>
            <h2>{group.label}</h2>
            {group.ids.map((id) => {
              const sale = pos.sales.find((item) => item.id === id)
              if (!sale) return null
              const count = sale.lines.reduce((sum, line) => sum + line.qty, 0)
              return (
                <button
                  type="button"
                  key={sale.id}
                  className={sale.cancelled ? 'sale cancelled' : 'sale'}
                  onClick={() => pos.setRoute({ name: 'receipt', saleId: sale.id, fresh: false })}
                >
                  <span>
                    <strong>{formatTime(sale.createdAt)}</strong>
                    <em>
                      {PAYMENT[sale.payment]} · {count} {plural(count, ['поз.', 'поз.', 'поз.'])}
                      {sale.cancelled ? ' · отменён' : ''}
                    </em>
                  </span>
                  <b>{money(sale.total)}</b>
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
