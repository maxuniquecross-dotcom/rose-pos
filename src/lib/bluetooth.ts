import type { Sale, Settings } from '../types'
import { canvasToEscPos, drawReceipt, textToEscPos, receiptText } from './receipt'

type PrintCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValue(data: BufferSource): Promise<void>
  writeValueWithoutResponse?(data: BufferSource): Promise<void>
}

type GattServer = {
  getPrimaryServices(): Promise<Array<{ getCharacteristics(): Promise<PrintCharacteristic[]> }>>
}

type PrintDevice = {
  id?: string
  name?: string
  gatt?: { connect(): Promise<GattServer> }
}

type BluetoothApi = {
  requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<PrintDevice>
  getDevices?: () => Promise<PrintDevice[]>
}

const UART_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
]

let cached: { id: string; name: string; characteristic: PrintCharacteristic } | null = null

function bluetooth() {
  return (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth
}

export function bluetoothAvailable() {
  return Boolean(bluetooth())
}

async function characteristicFrom(device: PrintDevice) {
  if (!device.gatt) throw new Error('У принтера нет GATT')
  const server = await device.gatt.connect()
  const services = await server.getPrimaryServices()
  for (const service of services) {
    const characteristics = await service.getCharacteristics()
    const writable =
      characteristics.find((item) => item.properties.writeWithoutResponse) ??
      characteristics.find((item) => item.properties.write)
    if (writable) return writable
  }
  throw new Error('Не нашли канал печати')
}

export async function connectPrinter() {
  const api = bluetooth()
  if (!api) {
    throw new Error('Этот браузер не умеет Bluetooth. На iPhone используйте системную печать или «Поделиться».')
  }
  const device = await api.requestDevice({ acceptAllDevices: true, optionalServices: UART_SERVICES })
  const characteristic = await characteristicFrom(device)
  const name = device.name || 'Printer001'
  const id = device.id || name
  cached = { id, name, characteristic }
  return { name, id }
}

async function restore(name: string, id: string) {
  if (cached && (cached.id === id || cached.name === name)) return cached.characteristic
  const api = bluetooth()
  const devices = (await api?.getDevices?.()) ?? []
  const device = devices.find((item) => (id && item.id === id) || item.name === name)
  if (!device) return null
  const characteristic = await characteristicFrom(device)
  cached = { id: device.id || id || name, name: device.name || name, characteristic }
  return characteristic
}

async function writeSlice(characteristic: PrintCharacteristic, slice: Uint8Array) {
  const bytes = new Uint8Array(slice)
  if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
    await characteristic.writeValueWithoutResponse(bytes)
    return
  }
  await characteristic.writeValue(bytes)
}

async function writeChunks(characteristic: PrintCharacteristic, data: Uint8Array) {
  let size = 180
  for (let offset = 0; offset < data.length; ) {
    const slice = data.slice(offset, Math.min(data.length, offset + size))
    try {
      await writeSlice(characteristic, slice)
      offset += slice.length
    } catch (error) {
      if (size === 20) throw error
      size = 20
      continue
    }
    await new Promise((resolve) => setTimeout(resolve, size === 20 ? 8 : 20))
  }
}

export async function printOverBluetooth(sale: Sale, settings: Settings, test = false) {
  const api = bluetooth()
  if (!api) throw new Error('Bluetooth недоступен в этом браузере')
  const name = settings.printerName
  if (!name) throw new Error('Сначала подключите принтер')
  const characteristic = await restore(name, settings.printerId)
  if (!characteristic) throw new Error('Принтер не на связи. Откройте настройки и подключите его снова.')

  const payload =
    settings.printMethod === 'Изображение'
      ? canvasToEscPos(drawReceipt(sale, settings, test), settings)
      : textToEscPos(receiptText(sale, settings, test), settings)

  const copies = Math.max(1, settings.copies)
  for (let copy = 0; copy < copies; copy += 1) {
    await writeChunks(characteristic, payload)
  }
}
