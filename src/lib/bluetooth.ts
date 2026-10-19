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
]

let cached: { name: string; characteristic: PrintCharacteristic } | null = null

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
    const writable = characteristics.find(
      (item) => item.properties.writeWithoutResponse || item.properties.write,
    )
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
  const name = device.name || 'Bluetooth-принтер'
  cached = { name, characteristic }
  return name
}

async function restore(name: string) {
  if (cached?.name === name) return cached.characteristic
  const api = bluetooth()
  const devices = (await api?.getDevices?.()) ?? []
  const device = devices.find((item) => item.name === name)
  if (!device) return null
  const characteristic = await characteristicFrom(device)
  cached = { name, characteristic }
  return characteristic
}

async function writeChunks(characteristic: PrintCharacteristic, data: Uint8Array) {
  const size = 180
  for (let offset = 0; offset < data.length; offset += size) {
    const slice = data.slice(offset, offset + size)
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(slice)
    } else {
      await characteristic.writeValue(slice)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

export async function printOverBluetooth(sale: Sale, settings: Settings, test = false) {
  const api = bluetooth()
  if (!api) throw new Error('Bluetooth недоступен в этом браузере')
  const name = settings.printerName
  if (!name) throw new Error('Сначала подключите принтер')
  const characteristic = await restore(name)
  if (!characteristic) throw new Error('Принтер не на связи. Откройте настройки и подключите его снова.')

  const payload =
    settings.printMethod === 'Изображение'
      ? canvasToEscPos(drawReceipt(sale, settings, test))
      : textToEscPos(receiptText(sale, settings, test), settings)

  const copies = Math.max(1, settings.copies)
  for (let copy = 0; copy < copies; copy += 1) {
    await writeChunks(characteristic, payload)
  }
}
