export type GroupId =
  | 'wine'
  | 'pizza'
  | 'snacks'
  | 'salads'
  | 'raw'
  | 'mains'
  | 'soups'
  | 'sides'
  | 'desserts'
  | 'bar'
  | 'coffee'
  | 'tea'
  | 'drinks'

export type Variant = {
  id: string
  name: string
  price: number
}

export type Modifier = {
  id: string
  name: string
  price: number
}

export type MenuItem = {
  id: string
  group: GroupId
  section: string
  name: string
  price: number
  description?: string
  weight?: string
  variants?: Variant[]
  modifiers?: Modifier[]
  custom?: boolean
  edited?: boolean
}

export type CartLine = {
  id: string
  itemId: string
  name: string
  variantId?: string
  variantName?: string
  modifiers: Modifier[]
  unitPrice: number
  qty: number
  note: string
}

export type Payment = 'cash' | 'card' | 'transfer'
export type DiscountType = 'none' | 'percent' | 'amount'

export type Sale = {
  id: string
  createdAt: string
  staff: string
  table: string
  lines: CartLine[]
  discountType: DiscountType
  discountValue: number
  subtotal: number
  discount: number
  total: number
  payment: Payment
  cashReceived: number | null
  cancelled: boolean
  userId?: string
}

export type PrinterType = 'Bluetooth' | 'Системная печать'
export type PrintMethod = 'TXT' | 'Изображение'
export type PaperWidth = '58 mm' | '80 mm'
export type FontSize = 'Мелкий' | 'Обычный' | 'Крупный'
export type LineSpacing = 'Узкий' | 'По умолчанию' | 'Широкий'

export type Settings = {
  printerType: PrinterType
  printerName: string
  printMethod: PrintMethod
  paperWidth: PaperWidth
  widthCalibration: number
  charWidth: number
  encoding: string
  copies: number
  fontSize: FontSize
  lineSpacing: LineSpacing
  footerLength: number
  cashDrawer: boolean
  staff: string
  restaurantName: string
  address: string
  footer: string
}

export const DEFAULT_SETTINGS: Settings = {
  printerType: 'Bluetooth',
  printerName: '',
  printMethod: 'TXT',
  paperWidth: '80 mm',
  widthCalibration: 1,
  charWidth: 22,
  encoding: '中文(简体、繁体;English;한국어)',
  copies: 1,
  fontSize: 'Обычный',
  lineSpacing: 'По умолчанию',
  footerLength: 5,
  cashDrawer: false,
  staff: 'Администратор',
  restaurantName: 'Ресторан “Rose”',
  address: 'г. Минск, ул. Козлова 3',
  footer: 'Вознаграждение официанту приветствуется, но всегда остается на Ваше усмотрение',
}

export type Route =
  | { name: 'pos' }
  | { name: 'checkout' }
  | { name: 'settings' }
  | { name: 'history' }
  | { name: 'receipt'; saleId: string; fresh: boolean }
  | { name: 'test-receipt' }
  | { name: 'admin' }

export type ViewMode = 'cards' | 'list'
