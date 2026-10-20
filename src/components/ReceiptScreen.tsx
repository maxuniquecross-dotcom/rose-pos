import { useState } from 'react'
import type { Sale } from '../types'
import { money } from '../lib/format'
import { receiptBlocks, receiptText, drawReceipt } from '../lib/receipt'
import { printOverBluetooth } from '../lib/bluetooth'
import { usePos } from '../state'
import { Confirm } from './overlays'

const PAYMENT = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод' } as const

export function ReceiptScreen() {
  const pos = usePos()
  const test = pos.route.name === 'test-receipt'
  const openedId = pos.route.name === 'receipt' ? pos.route.saleId : ''
  const sale = test
    ? testSale(pos.settings.staff)
    : pos.sales.find((item) => item.id === openedId) ?? (pos.preview?.id === openedId ? pos.preview : undefined)
  const [ask, setAsk] = useState(false)
  const fresh = pos.route.name === 'receipt' && pos.route.fresh

  if (!sale) {
    return (
      <div className="receipt-screen">
        <p className="empty">Чек не найден</p>
        <button type="button" className="btn primary" onClick={() => pos.setRoute({ name: 'pos' })}>
          В меню
        </button>
      </div>
    )
  }

  const print = async () => {
    if (pos.settings.printerType === 'Bluetooth' && pos.settings.printerName) {
      try {
        await printOverBluetooth(sale, pos.settings, test)
        pos.notify(`Отправлено на ${pos.settings.printerName}`)
        return
      } catch (error) {
        pos.notify(error instanceof Error ? error.message : 'Принтер недоступен')
      }
    } else if (pos.settings.printerType === 'Bluetooth') {
      pos.notify('Принтер не подключён — системная печать')
    }
    window.print()
  }

  const share = async () => {
    const text = receiptText(sale, pos.settings, test)
    const canvas = drawReceipt(sale, pos.settings, test)
    const file = await new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new File([blob], 'rose-check.png', { type: 'image/png' }))
      }, 'image/png')
    })
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Чек Rose', text })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: 'Чек Rose', text })
        return
      }
    } catch {
      return
    }
    await navigator.clipboard.writeText(text)
    pos.notify('Текст чека скопирован')
  }

  return (
    <div className="receipt-screen">
      <div className="waiter-strip no-print">
        {test ? (
          <span>Тест, в смену не записан</span>
        ) : (
          <span>
            {PAYMENT[sale.payment]}
            {sale.payment === 'cash' && sale.cashReceived != null
              ? ` · получено ${money(sale.cashReceived)} · сдача ${money(Math.max(0, sale.cashReceived - sale.total))}`
              : ''}
            {sale.cancelled ? ' · отменён' : ''}
          </span>
        )}
      </div>
      <div className="receipt-scroll">
        {Array.from({ length: Math.max(1, pos.settings.copies) }, (_, index) => (
          <div key={index} className={index === 0 ? 'paper-wrap' : 'paper-wrap print-copy'}>
            <ReceiptPaper sale={sale} />
          </div>
        ))}
      </div>
      <div className="receipt-actions no-print">
        <button type="button" className="btn primary" onClick={print}>
          Печать
        </button>
        <button type="button" className="btn ghost" onClick={share}>
          Поделиться
        </button>
        {fresh && (
          <button type="button" className="btn ghost" onClick={() => pos.setRoute({ name: 'pos' })}>
            Новый заказ
          </button>
        )}
        {!fresh && !test && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => pos.setRoute({ name: pos.preview?.id === sale.id ? 'admin' : 'history' })}
          >
            {pos.preview?.id === sale.id ? 'К сотруднику' : 'К чекам'}
          </button>
        )}
        {test && (
          <button type="button" className="btn ghost" onClick={() => pos.setRoute({ name: 'settings' })}>
            Назад
          </button>
        )}
        {!test && !sale.cancelled && (
          <button type="button" className="btn text" onClick={() => setAsk(true)}>
            Отменить чек
          </button>
        )}
      </div>
      {ask && (
        <Confirm
          text="Отменить чек? Сумма уйдёт из смены."
          onNo={() => setAsk(false)}
          onYes={() => {
            pos.cancelSale(sale.id)
            setAsk(false)
            pos.notify('Чек отменён')
          }}
        />
      )}
    </div>
  )
}

function ReceiptPaper({ sale }: { sale: Sale }) {
  const pos = usePos()
  const blocks = receiptBlocks(sale, pos.settings, pos.route.name === 'test-receipt')
  const size = (pos.settings.fontSize === 'Мелкий' ? 13 : pos.settings.fontSize === 'Крупный' ? 18 : 15) * (pos.settings.charWidth / 22)
  const spacing = pos.settings.lineSpacing === 'Узкий' ? 1.2 : pos.settings.lineSpacing === 'Широкий' ? 1.7 : 1.4

  return (
    <article
      className="paper"
      data-width={pos.settings.paperWidth}
      style={{ fontSize: `${size}px`, lineHeight: spacing }}
    >
      {blocks.map((block, index) => {
        if (block.type === 'title') return <h1 key={index}>{block.text}</h1>
        if (block.type === 'center') return <p key={index} className="center">{block.text}</p>
        if (block.type === 'left') return <p key={index}>{block.text}</p>
        if (block.type === 'dash') return <hr key={index} />
        if (block.type === 'gap') return <div key={index} className="gap" />
        if (block.type === 'note') return <p key={index} className="note">{block.text}</p>
        if (block.type === 'footer') return <p key={index} className="footer-text">{block.text}</p>
        if (block.type === 'total') {
          return (
            <p key={index} className={block.strong ? 'total strong' : 'total'}>
              <span>{block.label}</span>
              <b>{block.value}</b>
            </p>
          )
        }
        return (
          <p key={index} className={block.head ? 'cols head' : 'cols'}>
            <span>{block.name}</span>
            <span>{block.qty}</span>
            <span>{block.price}</span>
            <span>{block.sum}</span>
          </p>
        )
      })}
    </article>
  )
}

function testSale(staff: string): Sale {
  return {
    id: 'test',
    createdAt: new Date().toISOString(),
    staff: staff.trim() || 'Администратор',
    table: '',
    lines: [
      {
        id: 'test-line',
        itemId: 'espresso',
        name: 'Эспрессо',
        modifiers: [],
        unitPrice: 5,
        qty: 1,
        note: '',
      },
    ],
    discountType: 'none',
    discountValue: 0,
    subtotal: 5,
    discount: 0,
    total: 5,
    payment: 'card',
    cashReceived: null,
    cancelled: false,
  }
}
