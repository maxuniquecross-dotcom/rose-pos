import { useState } from 'react'
import { formatTime, money, plural, totals } from '../lib/format'
import type { Payment } from '../types'
import { usePos } from '../state'
import { IconBack } from './icons'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'] as const

export function CheckoutScreen() {
  const pos = usePos()
  const summary = totals(pos.cart, pos.discountType, pos.discountValue)
  const count = pos.cart.reduce((sum, line) => sum + line.qty, 0)
  const [payment, setPayment] = useState<Payment>('card')
  const [cash, setCash] = useState('')
  const [busy, setBusy] = useState(false)

  const received = cash === '' ? 0 : Number(cash.replace(',', '.'))
  const change = Math.max(0, Math.round((received - summary.total) * 100) / 100)
  const short = payment === 'cash' && received + 0.001 < summary.total

  const pushKey = (key: (typeof KEYS)[number]) => {
    if (key === '⌫') {
      setCash((value) => value.slice(0, -1))
      return
    }
    if (key === ',') {
      setCash((value) => (value.includes(',') ? value : `${value || '0'},`))
      return
    }
    setCash((value) => {
      const next = value + key
      const [, fraction] = next.split(',')
      if (fraction && fraction.length > 2) return value
      if (next.replace(',', '').length > 8) return value
      return next
    })
  }

  const issue = () => {
    if (busy || !count || short) return
    setBusy(true)
    const sale = pos.checkout(payment, payment === 'cash' ? received : null)
    pos.setRoute({ name: 'receipt', saleId: sale.id, fresh: true })
  }

  return (
    <div className="checkout">
      <header className="subhead">
        <button type="button" onClick={() => pos.setRoute({ name: 'pos' })} aria-label="Назад">
          <IconBack />
        </button>
        <h1>Оплата</h1>
        <span />
      </header>

      <div className="checkout-scroll">
        <button type="button" className="order-pill" onClick={() => pos.setRoute({ name: 'pos' })}>
          <span>
            {count} {plural(count, ['позиция', 'позиции', 'позиций'])}
          </span>
          <strong>{money(summary.subtotal)}</strong>
        </button>

        <p className="label">Скидка</p>
        <div className="seg">
          {[
            ['none', 'Нет'],
            ['percent:5', '5%'],
            ['percent:10', '10%'],
            ['percent:15', '15%'],
            ['amount', 'Сумма'],
          ].map(([id, title]) => {
            const active =
              (id === 'none' && pos.discountType === 'none') ||
              (id === 'amount' && pos.discountType === 'amount') ||
              (id.startsWith('percent') && pos.discountType === 'percent' && pos.discountValue === Number(id.split(':')[1]))
            return (
              <button
                type="button"
                key={id}
                className={active ? 'on' : ''}
                onClick={() => {
                  if (id === 'none') pos.setDiscount('none', 0)
                  else if (id === 'amount') pos.setDiscount('amount', pos.discountType === 'amount' ? pos.discountValue : 0)
                  else pos.setDiscount('percent', Number(id.split(':')[1]))
                }}
              >
                {title}
              </button>
            )
          })}
        </div>
        {pos.discountType === 'amount' && (
          <label className="field light-field">
            Сумма скидки
            <input
              inputMode="decimal"
              value={pos.discountValue ? String(pos.discountValue).replace('.', ',') : ''}
              onChange={(event) => pos.setDiscount('amount', Number(event.target.value.replace(',', '.')) || 0)}
            />
          </label>
        )}

        <div className="guest-row">
          <label className="field light-field">
            Стол
            <input value={pos.table} onChange={(event) => pos.setTable(event.target.value)} placeholder="не указывать" />
          </label>
          <label className="field light-field">
            Гостей
            <input
              inputMode="numeric"
              value={pos.guests ? String(pos.guests) : ''}
              onChange={(event) => pos.setGuests(Number(event.target.value.replace(/\D/g, '')) || 0)}
              placeholder="—"
            />
          </label>
        </div>
        <label className="field light-field">
          Время открытия
          <input
            type="time"
            value={formatTime(pos.openedAt || new Date().toISOString())}
            onChange={(event) => pos.setOpenedTime(event.target.value)}
          />
        </label>
        <div className="guest-row">
          <label className="field light-field">
            Кассир
            <input
              value={pos.cashier}
              placeholder={pos.settings.staff}
              onChange={(event) => pos.setCashier(event.target.value)}
            />
          </label>
          <label className="field light-field">
            Официант
            <input
              value={pos.waiter}
              placeholder={pos.settings.staff}
              onChange={(event) => pos.setWaiter(event.target.value)}
            />
          </label>
        </div>

        <p className="label">Оплата</p>
        <div className="seg pay">
          {(
            [
              ['cash', 'Наличные'],
              ['card', 'Карта'],
              ['transfer', 'Перевод'],
            ] as const
          ).map(([id, title]) => (
            <button type="button" key={id} className={payment === id ? 'on' : ''} onClick={() => setPayment(id)}>
              {title}
            </button>
          ))}
        </div>

        {payment === 'cash' && (
          <div className="cashbox">
            <div className="cash-readout">
              <span>Получено</span>
              <strong>{cash || '0'}</strong>
              <em>{short ? `Ещё ${money(summary.total - received)}` : `Сдача ${money(change)}`}</em>
            </div>
            <div className="quick-cash">
              <button type="button" onClick={() => setCash(money(summary.total))}>
                Точно
              </button>
              {[20, 50, 100].map((amount) => (
                <button type="button" key={amount} onClick={() => setCash(String(amount))}>
                  {amount}
                </button>
              ))}
            </div>
            <div className="pad">
              {KEYS.map((key) => (
                <button type="button" key={key} onClick={() => pushKey(key)}>
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {summary.discount > 0 && (
          <p className="discount-note">
            Скидка −{money(summary.discount)} · к оплате {money(summary.total)}
          </p>
        )}
      </div>

      <div className="checkout-bar">
        <button type="button" className="btn primary big" disabled={!count || short || busy} onClick={issue}>
          Выдать чек · {money(summary.total)}
        </button>
      </div>
    </div>
  )
}
