import { useEffect } from 'react'
import { AuthProvider, useAuth } from './auth'
import { PosProvider, usePos } from './state'
import { PosScreen } from './components/PosScreen'
import { CheckoutScreen } from './components/CheckoutScreen'
import { ReceiptScreen } from './components/ReceiptScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { HistoryScreen } from './components/HistoryScreen'
import { LoginScreen } from './components/LoginScreen'
import { AdminScreen } from './components/AdminScreen'

export function App() {
  return (
    <AuthProvider>
      <PosProvider>
        <Gate />
      </PosProvider>
    </AuthProvider>
  )
}

function Gate() {
  const auth = useAuth()
  const pos = usePos()

  useEffect(() => {
    if (auth.profile?.staff) pos.updateSettings({ staff: auth.profile.staff })
  }, [auth.profile?.id])

  if (auth.configured && auth.loading) {
    return (
      <div className="phone">
        <div className="boot">Вход…</div>
      </div>
    )
  }
  if (auth.configured && !auth.session) {
    return (
      <div className="phone">
        <LoginScreen />
      </div>
    )
  }
  return <Shell />
}

function Shell() {
  const { route, toast } = usePos()
  const light = route.name === 'settings' || route.name === 'admin'
  return (
    <div className={`phone ${light ? 'light' : ''}`}>
      {route.name === 'pos' && <PosScreen />}
      {route.name === 'checkout' && <CheckoutScreen />}
      {route.name === 'history' && <HistoryScreen />}
      {route.name === 'settings' && <SettingsScreen />}
      {route.name === 'admin' && <AdminScreen />}
      {(route.name === 'receipt' || route.name === 'test-receipt') && <ReceiptScreen />}
      {toast && <div className="toast no-print">{toast}</div>}
    </div>
  )
}
