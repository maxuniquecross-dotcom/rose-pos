import type { Sale, Settings } from '../types'
import { formatStamp, lineSum, lineTitle, money } from './format'

export type ReceiptBlock =
  | { type: 'title'; text: string }
  | { type: 'center'; text: string }
  | { type: 'left'; text: string }
  | { type: 'dash' }
  | { type: 'cols'; name: string; qty: string; price: string; sum: string; head?: boolean }
  | { type: 'note'; text: string }
  | { type: 'total'; label: string; value: string; strong?: boolean }
  | { type: 'footer'; text: string }
  | { type: 'gap' }

export function receiptBlocks(sale: Sale, settings: Settings, test = false): ReceiptBlock[] {
  const blocks: ReceiptBlock[] = [
    { type: 'title', text: settings.restaurantName },
    { type: 'center', text: settings.address },
    { type: 'gap' },
    { type: 'left', text: `Персонал:${sale.staff}` },
    { type: 'left', text: `Дата и время:${formatStamp(sale.createdAt)}` },
  ]

  if (sale.table.trim()) blocks.push({ type: 'left', text: `Стол: ${sale.table.trim()}` })
  if (test) blocks.push({ type: 'center', text: 'ТЕСТОВАЯ ПЕЧАТЬ' })

  blocks.push({ type: 'dash' })
  blocks.push({ type: 'cols', head: true, name: 'Товар', qty: 'Кол-во', price: 'Цена', sum: 'Сумма' })

  for (const line of sale.lines) {
    blocks.push({
      type: 'cols',
      name: lineTitle(line),
      qty: String(line.qty),
      price: money(line.unitPrice),
      sum: money(lineSum(line)),
    })
    if (line.note.trim()) blocks.push({ type: 'note', text: line.note.trim() })
  }

  blocks.push({ type: 'dash' })

  if (sale.discount > 0) {
    blocks.push({ type: 'total', label: 'Сумма', value: money(sale.subtotal) })
    const discountLabel = sale.discountType === 'percent' ? `Скидка ${sale.discountValue}%` : 'Скидка'
    blocks.push({ type: 'total', label: discountLabel, value: `-${money(sale.discount)}` })
  }

  blocks.push({ type: 'total', label: 'Итого:', value: money(sale.total), strong: true })
  blocks.push({ type: 'gap' })
  blocks.push({ type: 'footer', text: settings.footer })
  blocks.push({ type: 'dash' })

  for (let index = 0; index < settings.footerLength; index += 1) blocks.push({ type: 'gap' })
  return blocks
}

export function receiptText(sale: Sale, settings: Settings, test = false) {
  const cols = settings.paperWidth === '58 mm' ? 32 : 48
  const width = Math.max(24, Math.round(cols * settings.widthCalibration))
  const lines: string[] = []

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2))
    lines.push(`${' '.repeat(pad)}${text}`)
  }
  const rule = () => lines.push('-'.repeat(width))
  const left = (text: string) => wrapText(text, width).forEach((row) => lines.push(row))

  for (const block of receiptBlocks(sale, settings, test)) {
    if (block.type === 'title' || block.type === 'center') center(block.text)
    if (block.type === 'left' || block.type === 'footer' || block.type === 'note') left(block.text)
    if (block.type === 'dash') rule()
    if (block.type === 'gap') lines.push('')
    if (block.type === 'cols') {
      const qty = block.qty.padStart(3)
      const price = block.price.padStart(7)
      const sum = block.sum.padStart(7)
      const nameWidth = Math.max(8, width - 19)
      const nameLines = wrapText(block.name, nameWidth)
      nameLines.forEach((name, index) => {
        if (index === 0) lines.push(name.padEnd(nameWidth) + ' ' + qty + price + sum)
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

export function drawReceipt(sale: Sale, settings: Settings, test = false) {
  const width = Math.max(280, Math.round((settings.paperWidth === '58 mm' ? 384 : 576) * settings.widthCalibration))
  const scale = fontScale(settings)
  const body = Math.round(22 * scale)
  const title = Math.round(32 * scale)
  const leading = lineGap(settings)
  const pad = Math.round(28 * scale)
  const blocks = receiptBlocks(sale, settings, test)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.font = `${body}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
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
    if (block.type === 'title') {
      const font = `700 ${title}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      for (const row of measureRows(block.text, font, contentWidth)) pushLine(row, font, 'center')
      continue
    }
    if (block.type === 'center') {
      const font = `500 ${body}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      for (const row of measureRows(block.text, font, contentWidth)) pushLine(row, font, 'center')
      continue
    }
    if (block.type === 'left' || block.type === 'footer' || block.type === 'note') {
      const font = `${block.type === 'note' ? 'italic ' : ''}${body}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      for (const row of measureRows(block.text, font, contentWidth)) pushLine(row, font, 'left')
      continue
    }
    if (block.type === 'total') {
      const font = `${block.strong ? 700 : 500} ${block.strong ? Math.round(body * 1.25) : body}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      height += Math.round(body * leading * (block.strong ? 1.2 : 1))
      drawn.push({ kind: 'text', text: block.label, x: pad, y: height, font, align: 'left' })
      drawn.push({ kind: 'text', text: block.value, x: width - pad, y: height, font, align: 'right' })
      continue
    }
    if (block.type === 'cols') {
      const font = `${block.head ? 600 : 500} ${Math.round(body * (block.head ? 0.92 : 1))}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      const qtyW = Math.round(70 * scale)
      const priceW = Math.round(100 * scale)
      const sumW = Math.round(110 * scale)
      const nameW = contentWidth - qtyW - priceW - sumW
      const rows = measureRows(block.name, font, nameW)
      rows.forEach((row, index) => {
        height += Math.round(body * leading)
        drawn.push({ kind: 'text', text: row, x: pad, y: height, font, align: 'left' })
        if (index === 0) {
          drawn.push({ kind: 'text', text: block.qty, x: pad + nameW + qtyW, y: height, font, align: 'right' })
          drawn.push({ kind: 'text', text: block.price, x: pad + nameW + qtyW + priceW, y: height, font, align: 'right' })
          drawn.push({ kind: 'text', text: block.sum, x: width - pad, y: height, font, align: 'right' })
        }
      })
      if (!block.head) height += Math.round(body * 0.45)
    }
  }

  height += pad
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
      ctx.strokeStyle = '#bdbdbd'
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

export function canvasToEscPos(canvas: HTMLCanvasElement) {
  const fitted = fitPrinterCanvas(canvas)
  const ctx = fitted.getContext('2d')
  if (!ctx) return new Uint8Array()
  const { width, height } = fitted
  const image = ctx.getImageData(0, 0, width, height)
  const widthBytes = Math.ceil(width / 8)
  const raster = new Uint8Array(widthBytes * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const luminance = image.data[index] * 0.3 + image.data[index + 1] * 0.59 + image.data[index + 2] * 0.11
      if (luminance < 170) raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ])
  return concat(new Uint8Array([0x1b, 0x40]), header, raster, new Uint8Array([0x1b, 0x64, 0x03]))
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
