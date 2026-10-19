import type { CartLine, DiscountType } from '../types'

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function money(value: number) {
  return round2(value).toFixed(2).replace('.', ',')
}

export function menuPrice(value: number) {
  if (Number.isInteger(round2(value))) return String(round2(value))
  return money(value)
}

export function plural(count: number, forms: [string, string, string]) {
  const n10 = count % 10
  const n100 = count % 100
  if (n10 === 1 && n100 !== 11) return forms[0]
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1]
  return forms[2]
}

export function formatStamp(iso: string) {
  const date = new Date(iso)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatTime(iso: string) {
  const date = new Date(iso)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function dayKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function dayKey(iso: string) {
  return dayKeyFromDate(new Date(iso))
}

export function dayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const key = dayKey(iso)
  if (key === dayKeyFromDate(today)) return 'Сегодня'
  if (key === dayKeyFromDate(yesterday)) return 'Вчера'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

export function lineTitle(line: CartLine) {
  const parts = [line.name]
  if (line.variantName) parts.push(line.variantName)
  for (const modifier of line.modifiers) parts.push(modifier.name)
  return parts.join(', ')
}

export function lineSum(line: CartLine) {
  return round2(line.unitPrice * line.qty)
}

export function totals(lines: CartLine[], discountType: DiscountType, discountValue: number) {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineSum(line), 0))
  let discount = 0
  if (discountType === 'percent') discount = round2((subtotal * discountValue) / 100)
  if (discountType === 'amount') discount = Math.min(subtotal, round2(discountValue))
  return { subtotal, discount, total: round2(subtotal - discount) }
}

export function norm(value: string) {
  return value.toLowerCase().replaceAll('ё', 'е').replaceAll('і', 'и').replaceAll('ї', 'и')
}

export function priceLabel(price: number, variants?: { price: number }[]) {
  if (!variants?.length) return menuPrice(price)
  const values = variants.map((variant) => variant.price)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return menuPrice(min)
  return `${menuPrice(min)}–${menuPrice(max)}`
}
