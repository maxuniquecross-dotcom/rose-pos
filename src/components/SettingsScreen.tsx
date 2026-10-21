import { useState, type ReactNode } from 'react'
import type { Settings } from '../types'
import { bluetoothAvailable, connectPrinter } from '../lib/bluetooth'
import { usePos } from '../state'
import { IconBack, IconChevron } from './icons'

type Picker =
  | { kind: 'list'; title: string; key: keyof Settings; options: string[] }
  | { kind: 'number'; title: string; key: keyof Settings; min: number; max: number; step: number; digits: number }

const ENCODINGS = ['中文(简体、繁体;English;한국어)', 'UTF-8', 'CP1251 (кириллица)', 'CP866 (кириллица)']

export function SettingsScreen() {
  const pos = usePos()
  const { settings } = pos
  const [picker, setPicker] = useState<Picker | null>(null)
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    if (!bluetoothAvailable()) {
      pos.notify('На iPhone браузер не подключает Bluetooth. Печатайте через «Печать» или «Поделиться».')
      return
    }
    setBusy(true)
    try {
      const printer = await connectPrinter()
      pos.updateSettings({ printerName: printer.name, printerId: printer.id, printerType: 'Bluetooth' })
      pos.notify(`Подключён ${printer.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return
      pos.notify(error instanceof Error ? error.message : 'Не удалось подключить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <header className="settings-nav">
        <button type="button" className="left" onClick={() => pos.setRoute({ name: 'pos' })}>
          <IconBack /> Назад
        </button>
        <h1>Настройки принтера</h1>
        <button type="button" className="right" onClick={() => pos.setRoute({ name: 'test-receipt' })}>
          Тест печати
        </button>
      </header>

      <div className="settings-scroll">
        <Group>
          <Row label="Тип принтера" value={settings.printerType} onClick={() => setPicker({ kind: 'list', title: 'Тип принтера', key: 'printerType', options: ['Bluetooth', 'Системная печать'] })} />
          <Row label="Устройство печати" value={busy ? 'Поиск…' : settings.printerName || 'Не подключено'} onClick={connect} />
        </Group>
        <Group hint="Чек печатается узким светлым шрифтом, близким к Hypermarket Condensed Light.">
          <Row label="Способ печати" value={settings.printMethod} onClick={() => setPicker({ kind: 'list', title: 'Способ печати', key: 'printMethod', options: ['Изображение', 'TXT'] })} />
          <StepRow label="Ширина бумаги" value={settings.paperWidthMm} min={20} max={80} onChange={(paperWidthMm) => pos.updateSettings({ paperWidthMm })} />
          <StepRow label="Высота бумаги" value={settings.paperHeightMm} min={20} max={200} onChange={(paperHeightMm) => pos.updateSettings({ paperHeightMm })} />
          <ChoiceRow
            label="Направление печати"
            value={String(settings.printDirection)}
            options={['0', '90', '180', '270']}
            suffix="°"
            onChange={(value) => pos.updateSettings({ printDirection: Number(value) as 0 | 90 | 180 | 270 })}
          />
          <ChoiceRow
            label="Алгоритм обработки"
            value={settings.printAlgorithm}
            options={['1.0', '2.0']}
            onChange={(printAlgorithm) => pos.updateSettings({ printAlgorithm: printAlgorithm as '1.0' | '2.0' })}
          />
          <StepRow label="Количество копий" value={settings.copies} min={1} max={5} onChange={(copies) => pos.updateSettings({ copies })} />
        </Group>
        <Group>
          <Row label="Калибровка ширины" value={settings.widthCalibration.toFixed(2)} onClick={() => setPicker({ kind: 'number', title: 'Калибровка ширины', key: 'widthCalibration', min: 0.8, max: 1.3, step: 0.05, digits: 2 })} />
          <Row label="Калибровка ширины символов" value={String(settings.charWidth)} onClick={() => setPicker({ kind: 'number', title: 'Калибровка ширины символов', key: 'charWidth', min: 14, max: 32, step: 1, digits: 0 })} />
        </Group>
        <Group>
          <Row label="Кодировка языка" value={settings.encoding} clip onClick={() => setPicker({ kind: 'list', title: 'Кодировка языка', key: 'encoding', options: ENCODINGS })} />
        </Group>
        <Group>
          <Row label="Размер шрифта" value={settings.fontSize} onClick={() => setPicker({ kind: 'list', title: 'Размер шрифта', key: 'fontSize', options: ['Мелкий', 'Обычный', 'Крупный'] })} />
          <Row label="Межстрочный интервал" value={settings.lineSpacing} onClick={() => setPicker({ kind: 'list', title: 'Межстрочный интервал', key: 'lineSpacing', options: ['Узкий', 'По умолчанию', 'Широкий'] })} />
          <Row label="Длина нижнего колонтитула" value={String(settings.footerLength)} onClick={() => setPicker({ kind: 'number', title: 'Длина нижнего колонтитула', key: 'footerLength', min: 0, max: 10, step: 1, digits: 0 })} />
        </Group>
        <Group>
          <div className="set-row static">
            <span>Включить денежный ящик</span>
            <button
              type="button"
              className={settings.cashDrawer ? 'switch on' : 'switch'}
              role="switch"
              aria-checked={settings.cashDrawer}
              aria-label="Включить денежный ящик"
              onClick={() => pos.updateSettings({ cashDrawer: !settings.cashDrawer })}
            >
              <i />
            </button>
          </div>
        </Group>

        <h2 className="set-caption">Реквизиты чека</h2>
        <Group>
          <label className="set-field">
            Название
            <input value={settings.restaurantName} onChange={(event) => pos.updateSettings({ restaurantName: event.target.value })} />
          </label>
          <label className="set-field">
            Адрес
            <input value={settings.address} onChange={(event) => pos.updateSettings({ address: event.target.value })} />
          </label>
          <label className="set-field">
            Подпись
            <textarea value={settings.footer} rows={3} onChange={(event) => pos.updateSettings({ footer: event.target.value })} />
          </label>
        </Group>
      </div>

      {picker && (
        <div className="overlay light">
          <button type="button" className="backdrop" aria-label="Закрыть" onClick={() => setPicker(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={picker.title}>
            <header>
              <h2>{picker.title}</h2>
              <button type="button" onClick={() => setPicker(null)}>
                Готово
              </button>
            </header>
            <div className="sheet-body">
              {picker.kind === 'list' ? (
                <div className="cat-list">
                  {picker.options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={String(settings[picker.key]) === option ? 'cat on' : 'cat'}
                      onClick={() => {
                        pos.updateSettings({ [picker.key]: option })
                        setPicker(null)
                      }}
                    >
                      <span>{option}</span>
                      {String(settings[picker.key]) === option && <b>✓</b>}
                    </button>
                  ))}
                </div>
              ) : (
                <NumberStepper
                  value={Number(settings[picker.key])}
                  min={picker.min}
                  max={picker.max}
                  step={picker.step}
                  digits={picker.digits}
                  onChange={(value) => pos.updateSettings({ [picker.key]: value })}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <section className="set-group">
      {children}
      {hint && <p className="set-hint">{hint}</p>}
    </section>
  )
}

function Row({ label, value, onClick, clip = false }: { label: string; value: string; onClick: () => void; clip?: boolean }) {
  return (
    <button type="button" className="set-row" onClick={onClick}>
      <span>{label}</span>
      <span className={clip ? 'value clip' : 'value'}>
        {value}
        <IconChevron />
      </span>
    </button>
  )
}

function StepRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="set-row static">
      <span>{label}</span>
      <span className="stepper">
        <button type="button" aria-label="Меньше" onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <b>{value}</b>
        <button type="button" aria-label="Больше" onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </span>
    </div>
  )
}

function ChoiceRow({
  label,
  value,
  options,
  suffix = '',
  onChange,
}: {
  label: string
  value: string
  options: string[]
  suffix?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="set-row static choice-row">
      <span>{label}</span>
      <span className="choices-inline">
        {options.map((option) => (
          <button type="button" key={option} className={option === value ? 'on' : ''} onClick={() => onChange(option)}>
            {option}
            {suffix}
          </button>
        ))}
      </span>
    </div>
  )
}

function NumberStepper({
  value,
  min,
  max,
  step,
  digits,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  digits: number
  onChange: (value: number) => void
}) {
  const show = digits ? value.toFixed(digits) : String(value)
  const next = (dir: number) => {
    const raw = Math.round((value + dir * step) * 100) / 100
    onChange(Math.min(max, Math.max(min, raw)))
  }
  return (
    <div className="num-step">
      <button type="button" onClick={() => next(-1)} aria-label="Меньше">
        −
      </button>
      <strong>{show}</strong>
      <button type="button" onClick={() => next(1)} aria-label="Больше">
        +
      </button>
    </div>
  )
}
