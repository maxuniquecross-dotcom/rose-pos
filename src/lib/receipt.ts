import type { Sale, Settings } from '../types'
import { formatTime, lineSum, lineTitle, receiptDate, receiptMoney } from './format'

// Узкий светлый гротеск: открытый аналог Hypermarket Condensed Light, с кириллицей.
const FAMILY = '"Sofia Sans Condensed", "Arial Narrow", sans-serif'

export function readyReceiptFont() {
  return document.fonts.load(`300 16px ${FAMILY}`, 'Ресторан Rose 142.00')
}

function face(size: number) {
  return `300 ${size}px ${FAMILY}`
}

export type ReceiptBlock =
  | { type: 'title'; text: string }
  | { type: 'center'; text: string }
  | { type: 'left'; text: string }
  | { type: 'trio'; cells: [string, string, string] }
  | { type: 'pair'; label: string; value: string }
  | { type: 'dash' }
  | { type: 'cols'; name: string; qty: string; price: string; sum: string; head?: boolean }
  | { type: 'note'; text: string }
  | { type: 'total'; label: string; value: string; strong?: boolean }
  | { type: 'footer'; text: string }
  | { type: 'gap' }

function checkLabel(sale: Sale) {
  if (sale.checkNo) return `#${sale.checkNo}`
  let hash = 2166136261
  for (let index = 0; index < sale.id.length; index += 1) {
    hash ^= sale.id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `#${100000 + ((hash >>> 0) % 900000)}`
}

export function receiptBlocks(sale: Sale, settings: Settings, test = false): ReceiptBlock[] {
  const opened = sale.openedAt || sale.createdAt
  const blocks: ReceiptBlock[] = [
    { type: 'title', text: settings.restaurantName },
    { type: 'center', text: settings.address },
    { type: 'gap' },
    { type: 'trio', cells: [`Чек ${checkLabel(sale)}`, `Стол # ${sale.table.trim() || '—'}`, `Гостей ${sale.guests || '—'}`] },
    { type: 'trio', cells: [receiptDate(sale.createdAt), `Открыт ${formatTime(opened)}`, `Печать ${formatTime(sale.createdAt)}`] },
    { type: 'pair', label: 'Кассир:', value: sale.cashier?.trim() || sale.staff },
    { type: 'pair', label: 'Официант:', value: sale.waiter?.trim() || sale.staff },
    { type: 'gap' },
  ]

  if (test) blocks.push({ type: 'center', text: 'ТЕСТОВАЯ ПЕЧАТЬ' })

  blocks.push({ type: 'cols', head: true, name: 'Блюдо', price: 'Цена', qty: 'Кол-во', sum: 'Сумма' })
  blocks.push({ type: 'dash' })

  for (const line of sale.lines) {
    blocks.push({
      type: 'cols',
      name: lineTitle(line),
      price: receiptMoney(line.unitPrice),
      qty: receiptMoney(line.qty),
      sum: receiptMoney(lineSum(line)),
    })
    if (line.note.trim()) blocks.push({ type: 'note', text: line.note.trim() })
  }

  blocks.push({ type: 'dash' })
  blocks.push({ type: 'total', label: 'Всего:', value: receiptMoney(sale.subtotal) })
  if (sale.discount > 0) {
    const discountLabel = sale.discountType === 'percent' ? `Скидка ${sale.discountValue}%` : 'Скидка'
    blocks.push({ type: 'total', label: discountLabel, value: `-${receiptMoney(sale.discount)}` })
  }
  blocks.push({ type: 'dash' })
  blocks.push({ type: 'total', label: 'Итого к оплате:', value: receiptMoney(sale.total) })
  blocks.push({ type: 'dash' })
  blocks.push({ type: 'gap' })
  blocks.push({ type: 'footer', text: settings.footer })

  for (let index = 0; index < settings.footerLength; index += 1) blocks.push({ type: 'gap' })
  return blocks
}

export function receiptText(sale: Sale, settings: Settings, test = false) {
  const cols = Math.max(16, Math.round(settings.paperWidthMm * 0.55))
  const width = Math.max(24, Math.round(cols * settings.widthCalibration))
  const lines: string[] = []

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2))
    lines.push(`${' '.repeat(pad)}${text}`)
  }
  const rule = () => lines.push('-'.repeat(width))
  const left = (text: string) => wrapText(text, width).forEach((row) => lines.push(row))

  for (const block of receiptBlocks(sale, settings, test)) {
    if (block.type === 'title' || block.type === 'center' || block.type === 'footer') center(block.text)
    if (block.type === 'left' || block.type === 'note') left(block.text)
    if (block.type === 'trio') {
      const [a, b, c] = block.cells
      const side = Math.max(8, Math.floor(width * 0.36))
      const mid = Math.max(6, width - side * 2)
      lines.push(a.slice(0, side).padEnd(side) + b.slice(0, mid).padStart(Math.floor((mid + b.length) / 2)).padEnd(mid) + c.slice(0, side).padStart(side))
    }
    if (block.type === 'pair') {
      const value = block.value
      const gap = Math.max(1, width - block.label.length - value.length)
      lines.push(block.label + ' '.repeat(Math.min(gap, 12)) + value)
    }
    if (block.type === 'dash') rule()
    if (block.type === 'gap') lines.push('')
    if (block.type === 'cols') {
      const price = block.price.padStart(6)
      const qty = block.qty.padStart(5)
      const sum = block.sum.padStart(6)
      const nameWidth = Math.max(8, width - 19)
      const nameLines = wrapText(block.name, nameWidth)
      nameLines.forEach((name, index) => {
        if (index === 0) lines.push(name.padEnd(nameWidth) + ' ' + price + ' ' + qty + ' ' + sum)
        else lines.push(name)
      })
    }
    if (block.type === 'total') {
      const value = block.value
      const label = block.label
      const gap = Math.max(1, width - label.length - value.length)
      lines.push(label + ' '.repeat(gap) + value)
    }
  }

  return lines.join('\n')
}

function wrapText(text: string, width: number) {
  if (text.length <= width) return [text]
  const words = text.split(' ')
  const rows: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width && current) {
      rows.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) rows.push(current)
  return rows.length ? rows : ['']
}

function fontScale(settings: Settings) {
  const size = settings.fontSize === 'Мелкий' ? 0.85 : settings.fontSize === 'Крупный' ? 1.22 : 1
  return size * (settings.charWidth / 22)
}

function lineGap(settings: Settings) {
  if (settings.lineSpacing === 'Узкий') return 1.15
  if (settings.lineSpacing === 'Широкий') return 1.7
  return 1.38
}

function printerDots(mm: number, calibration = 1) {
  const dots = Math.round(mm * 8 * calibration)
  return Math.max(8, dots - (dots % 8))
}

export function drawReceipt(sale: Sale, settings: Settings, test = false) {
  const width = printerDots(settings.paperWidthMm, settings.widthCalibration)
  const scale = fontScale(settings) * (width / 320)
  const body = Math.round(14 * scale)
  const title = body
  const leading = lineGap(settings)
  const pad = Math.max(8, Math.round(10 * scale))
  const blocks = receiptBlocks(sale, settings, test)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.font = face(body)
  const contentWidth = width - pad * 2
  let height = pad

  const measureRows = (text: string, font: string, maxWidth: number) => {
    ctx.font = font
    const words = text.split(' ')
    const rows: string[] = []
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (ctx.measureText(next).width > maxWidth && current) {
        rows.push(current)
        current = word
      } else current = next
    }
    if (current) rows.push(current)
    return rows.length ? rows : ['']
  }

  type Drawn =
    | { kind: 'text'; text: string; x: number; y: number; font: string; align: CanvasTextAlign }
    | { kind: 'dash'; y: number }

  const drawn: Drawn[] = []
  const pushLine = (text: string, font: string, align: CanvasTextAlign) => {
    height += Math.round(body * leading)
    const x = align === 'center' ? width / 2 : align === 'right' ? width - pad : pad
    drawn.push({ kind: 'text', text, x, y: height, font, align })
  }

  for (const block of blocks) {
    if (block.type === 'gap') {
      height += Math.round(body * 0.8)
      continue
    }
    if (block.type === 'dash') {
      height += Math.round(body * 0.7)
      drawn.push({ kind: 'dash', y: height })
      height += Math.round(body * 0.35)
      continue
    }
    const font = face(body)
    const titleFont = face(title)
    if (block.type === 'title') {
      for (const row of measureRows(block.text, titleFont, contentWidth)) pushLine(row, titleFont, 'center')
      continue
    }
    if (block.type === 'center' || block.type === 'footer') {
      for (const row of measureRows(block.text, font, contentWidth)) pushLine(row, font, 'center')
      continue
    }
    if (block.type === 'left' || block.type === 'note') {
      for (const row of measureRows(block.text, font, contentWidth)) pushLine(row, font, 'left')
      continue
    }
    if (block.type === 'trio') {
      height += Math.round(body * leading)
      const [left, middle, right] = block.cells
      drawn.push({ kind: 'text', text: left, x: pad, y: height, font, align: 'left' })
      drawn.push({ kind: 'text', text: middle, x: width / 2, y: height, font, align: 'center' })
      drawn.push({ kind: 'text', text: right, x: width - pad, y: height, font, align: 'right' })
      continue
    }
    if (block.type === 'pair') {
      height += Math.round(body * leading)
      drawn.push({ kind: 'text', text: block.label, x: pad, y: height, font, align: 'left' })
      drawn.push({ kind: 'text', text: block.value, x: pad + contentWidth * 0.42, y: height, font, align: 'left' })
      continue
    }
    if (block.type === 'total') {
      height += Math.round(body * leading)
      drawn.push({ kind: 'text', text: block.label, x: pad, y: height, font, align: 'left' })
      drawn.push({ kind: 'text', text: block.value, x: width - pad, y: height, font, align: 'right' })
      continue
    }
    if (block.type === 'cols') {
      const priceW = Math.round(contentWidth * 0.2)
      const qtyW = Math.round(contentWidth * 0.18)
      const sumW = Math.round(contentWidth * 0.2)
      const nameW = contentWidth - priceW - qtyW - sumW
      const rows = measureRows(block.name, font, nameW)
      rows.forEach((row, index) => {
        height += Math.round(body * leading)
        drawn.push({ kind: 'text', text: row, x: pad, y: height, font, align: 'left' })
        if (index === 0) {
          drawn.push({ kind: 'text', text: block.price, x: pad + nameW + priceW, y: height, font, align: 'right' })
          drawn.push({ kind: 'text', text: block.qty, x: pad + nameW + priceW + qtyW, y: height, font, align: 'right' })
          drawn.push({ kind: 'text', text: block.sum, x: width - pad, y: height, font, align: 'right' })
        }
      })
      if (!block.head) height += Math.round(body * 0.12)
    }
  }

  height = Math.max(height + pad, Math.round(settings.paperHeightMm * 8))
  const pixelRatio = 3
  canvas.width = width * pixelRatio
  canvas.height = Math.max(height, 200) * pixelRatio
  sharpCanvas(canvas).printerWidth = width
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'alphabetic'

  for (const op of drawn) {
    if (op.kind === 'dash') {
      ctx.save()
      ctx.strokeStyle = '#000000'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(pad, op.y)
      ctx.lineTo(width - pad, op.y)
      ctx.stroke()
      ctx.restore()
      continue
    }
    ctx.font = op.font
    ctx.textAlign = op.align
    ctx.fillText(op.text, op.x, op.y)
  }

  return canvas
}

type SharpCanvas = HTMLCanvasElement & { printerWidth?: number }

function sharpCanvas(canvas: HTMLCanvasElement) {
  return canvas as SharpCanvas
}

function fitPrinterCanvas(canvas: HTMLCanvasElement) {
  const targetWidth = sharpCanvas(canvas).printerWidth
  if (!targetWidth || canvas.width === targetWidth) return canvas
  const targetHeight = Math.max(1, Math.round(canvas.height * (targetWidth / canvas.width)))
  const fitted = document.createElement('canvas')
  fitted.width = targetWidth
  fitted.height = targetHeight
  const ctx = fitted.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
  return fitted
}

function rotateCanvas(canvas: HTMLCanvasElement, degrees: number) {
  if (degrees === 0) return canvas
  const turned = document.createElement('canvas')
  const quarter = degrees === 90 || degrees === 270
  turned.width = quarter ? canvas.height : canvas.width
  turned.height = quarter ? canvas.width : canvas.height
  const ctx = turned.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, turned.width, turned.height)
  ctx.translate(turned.width / 2, turned.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return turned
}

function padWidth(canvas: HTMLCanvasElement) {
  if (canvas.width % 8 === 0) return canvas
  const width = canvas.width + (8 - (canvas.width % 8))
  const padded = document.createElement('canvas')
  padded.width = width
  padded.height = canvas.height
  const ctx = padded.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, canvas.height)
  ctx.drawImage(canvas, 0, 0)
  return padded
}

export function canvasToEscPos(canvas: HTMLCanvasElement, settings: Settings) {
  const prepared = padWidth(rotateCanvas(fitPrinterCanvas(canvas), settings.printDirection))
  const ctx = prepared.getContext('2d')
  if (!ctx) return new Uint8Array()
  const { width, height } = prepared
  const image = ctx.getImageData(0, 0, width, height)
  const widthBytes = Math.ceil(width / 8)
  const raster = new Uint8Array(widthBytes * height)
  const gray = new Float32Array(width * height)

  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    gray[index] = image.data[offset] * 0.3 + image.data[offset + 1] * 0.59 + image.data[offset + 2] * 0.11
  }

  const mark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
  }

  if (settings.printAlgorithm === '1.0') {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (gray[y * width + x] < 160) mark(x, y)
      }
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        const old = gray[index]
        const next = old < 128 ? 0 : 255
        if (next === 0) mark(x, y)
        const error = old - next
        const spread = (dx: number, dy: number, weight: number) => {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
          gray[ny * width + nx] += (error * weight) / 16
        }
        spread(1, 0, 7)
        spread(-1, 1, 3)
        spread(0, 1, 5)
        spread(1, 1, 1)
      }
    }
  }

  const parts: Uint8Array[] = [new Uint8Array([0x1b, 0x40])]
  const band = 200
  for (let y = 0; y < height; y += band) {
    const rows = Math.min(band, height - y)
    parts.push(
      new Uint8Array([
        0x1d, 0x76, 0x30, 0x00,
        widthBytes & 0xff,
        (widthBytes >> 8) & 0xff,
        rows & 0xff,
        (rows >> 8) & 0xff,
      ]),
      raster.slice(y * widthBytes, (y + rows) * widthBytes),
    )
  }
  parts.push(new Uint8Array([0x1b, 0x64, 0x03]))
  return concat(...parts)
}

export function textToEscPos(text: string, settings: Settings) {
  const encoded = encodeText(text, settings.encoding)
  const mode = settings.fontSize === 'Крупный' ? 0x11 : settings.fontSize === 'Мелкий' ? 0x01 : 0x00
  const parts = [
    new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x00, 0x1d, 0x21, mode]),
    encoded,
    new Uint8Array([0x0a, 0x1b, 0x64, settings.footerLength]),
  ]
  if (settings.cashDrawer) parts.push(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]))
  return concat(...parts)
}

function encodeText(text: string, encoding: string) {
  if (encoding.startsWith('CP1251')) return encodeCyrillic(text, '1251')
  if (encoding.startsWith('CP866')) return encodeCyrillic(text, '866')
  return new TextEncoder().encode(text + '\n')
}

function encodeCyrillic(text: string, codepage: '1251' | '866') {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63
    if (code < 128) {
      bytes.push(code)
      continue
    }
    if (codepage === '1251') {
      if (code >= 0x0410 && code <= 0x044f) bytes.push(code - 0x0410 + 0xc0)
      else if (code === 0x0401) bytes.push(0xa8)
      else if (code === 0x0451) bytes.push(0xb8)
      else bytes.push(0x3f)
      continue
    }
    if (code >= 0x0410 && code <= 0x042f) bytes.push(code - 0x0410 + 0x80)
    else if (code >= 0x0430 && code <= 0x043f) bytes.push(code - 0x0430 + 0xa0)
    else if (code >= 0x0440 && code <= 0x044f) bytes.push(code - 0x0440 + 0xe0)
    else if (code === 0x0401) bytes.push(0xf0)
    else if (code === 0x0451) bytes.push(0xf1)
    else bytes.push(0x3f)
  }
  bytes.push(0x0a)
  return new Uint8Array(bytes)
}

function concat(...chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}
