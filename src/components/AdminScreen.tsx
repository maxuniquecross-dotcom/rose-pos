import { useEffect, useMemo, useState } from 'react'
import type { Sale } from '../types'
import { dayLabel, formatTime, money, plural } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useAuth, type Profile } from '../auth'
import { usePos } from '../state'
import { IconBack } from './icons'

const PAYMENT = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод' } as const

type Person = Profile & { sales: Sale[] }

export function AdminScreen() {
  const auth = useAuth()
  const pos = usePos()
  const [people, setPeople] = useState<Person[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [login, setLogin] = useState('')
  const [staff, setStaff] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const person = people.find((item) => item.id === picked) ?? null

  const load = async () => {
    if (!supabase) return
    const [{ data: profiles, error: profileError }, { data: rows, error: salesError }] = await Promise.all([
      supabase.from('profiles').select('id, username, staff, role').order('created_at'),
      supabase.from('sales').select('user_id, payload').order('created_at', { ascending: false }),
    ])
    if (profileError || salesError) {
      setError('Не удалось загрузить смены')
      return
    }
    const sales = ((rows ?? []) as { user_id: string; payload: Sale }[])
      .map((row): Sale | null => {
        const sale = row.payload
        if (!sale?.id) return null
        return { ...sale, userId: sale.userId || row.user_id }
      })
      .filter((sale): sale is Sale => sale !== null)
    setPeople(
      ((profiles ?? []) as Profile[]).map((profile) => ({
        ...profile,
        sales: sales.filter((sale) => sale.userId === profile.id),
      })),
    )
    setError('')
  }

  useEffect(() => {
    void load()
  }, [])

  const todayKey = new Date().toDateString()
  const totals = useMemo(() => {
    return people.map((item) => {
      const today = item.sales.filter((sale) => !sale.cancelled && new Date(sale.createdAt).toDateString() === todayKey)
      return { id: item.id, count: today.length, sum: today.reduce((total, sale) => total + sale.total, 0) }
    })
  }, [people, todayKey])

  const call = async (body: { action: 'create' | 'password'; login: string; password: string; staff?: string }) => {
    if (!supabase || !auth.session) return 'Нет входа'
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) return payload?.error || 'Не получилось'
    return null
  }

  const createUser = async () => {
    setBusy(true)
    const message = await call({ action: 'create', login, password, staff: staff || login })
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    setLogin('')
    setStaff('')
    setPassword('')
    pos.notify('Сотрудник добавлен')
    await load()
  }

  const resetPassword = async () => {
    if (!person) return
    const next = window.prompt(`Новый пароль для ${person.username}`, '')
    if (!next) return
    if (next.length < 8) {
      setError('Пароль от 8 символов')
      return
    }
    const message = await call({ action: 'password', login: person.username, password: next })
    if (message) setError(message)
    else pos.notify('Пароль обновлён')
  }

  return (
    <div className="history light-admin">
      <header className="subhead">
        <button
          type="button"
          aria-label="Назад"
          onClick={() => (person ? setPicked(null) : pos.setRoute({ name: 'pos' }))}
        >
          <IconBack />
        </button>
        <h1>{person ? person.staff : 'Сотрудники'}</h1>
        <button type="button" onClick={() => void auth.signOut()}>
          Выйти
        </button>
      </header>
      <div className="history-scroll">
        {error && <p className="login-error">{error}</p>}
        {!person && (
          <>
            {people.map((item) => {
              const stat = totals.find((entry) => entry.id === item.id)
              return (
                <button type="button" key={item.id} className="sale" onClick={() => setPicked(item.id)}>
                  <span>
                    <strong>{item.staff}</strong>
                    <em>
                      {item.username}
                      {item.role === 'admin' ? ' · админ' : ''} · сегодня {stat?.count ?? 0}{' '}
                      {plural(stat?.count ?? 0, ['чек', 'чека', 'чеков'])}
                    </em>
                  </span>
                  <b>{money(stat?.sum ?? 0)}</b>
                </button>
              )
            })}
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!busy) void createUser()
              }}
            >
              <h2>Новый сотрудник</h2>
              <label className="field">
                Логин
                <input value={login} onChange={(event) => setLogin(event.target.value)} autoCapitalize="none" />
              </label>
              <label className="field">
                Имя на чеке
                <input value={staff} onChange={(event) => setStaff(event.target.value)} placeholder="Как в смене" />
              </label>
              <label className="field">
                Пароль
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button type="submit" className="btn primary" disabled={busy || login.trim().length < 2 || password.length < 8}>
                Добавить
              </button>
            </form>
          </>
        )}
        {person && (
          <>
            <button type="button" className="btn ghost admin-reset" onClick={() => void resetPassword()}>
              Сменить пароль
            </button>
            {person.sales.length === 0 && <div className="empty">Чеков ещё нет</div>}
            {person.sales.map((sale) => {
              const count = sale.lines.reduce((sum, line) => sum + line.qty, 0)
              return (
                <button
                  type="button"
                  key={sale.id}
                  className={sale.cancelled ? 'sale cancelled' : 'sale'}
                  onClick={() => pos.showSale(sale)}
                >
                  <span>
                    <strong>{formatTime(sale.createdAt)}</strong>
                    <em>
                      {dayLabel(sale.createdAt)} · {PAYMENT[sale.payment]} · {count}{' '}
                      {plural(count, ['поз.', 'поз.', 'поз.'])}
                      {sale.cancelled ? ' · отменён' : ''}
                    </em>
                  </span>
                  <b>{money(sale.total)}</b>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
