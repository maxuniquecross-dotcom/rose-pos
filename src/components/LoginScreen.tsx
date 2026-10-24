import { useState } from 'react'
import { useAuth } from '../auth'

export function LoginScreen() {
  const auth = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    const message = await auth.signIn(login, password)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <form
      className="login"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy) void submit()
      }}
    >
      <div className="brand">Rose</div>
      <p>Вход для смены</p>
      <label className="field">
        Логин
        <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" autoCapitalize="none" />
      </label>
      <label className="field">
        Пароль
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {(error || auth.notice) && <p className="login-error">{error || auth.notice}</p>}
      <button type="submit" className="btn primary" disabled={busy || login.trim().length < 2 || password.length < 8}>
        {busy ? 'Входим…' : 'Войти'}
      </button>
    </form>
  )
}
