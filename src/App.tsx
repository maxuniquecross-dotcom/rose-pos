import { PosProvider, usePos } from './state'
import { PosScreen } from './components/PosScreen'
import { CheckoutScreen } from './components/CheckoutScreen'
import { ReceiptScreen } from './components/ReceiptScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { HistoryScreen } from './components/HistoryScreen'

export function App() {
  return (
    <PosProvider>
      <Shell />
    </PosProvider>
  )
}

function Shell() {
  const { route, toast } = usePos()
  return (
    <div className={`phone ${route.name === 'settings' ? 'light' : ''}`}>
      {route.name === 'pos' && <PosScreen />}
      {route.name === 'checkout' && <CheckoutScreen />}
      {route.name === 'history' && <HistoryScreen />}
      {route.name === 'settings' && <SettingsScreen />}
      {(route.name === 'receipt' || route.name === 'test-receipt') && <ReceiptScreen />}
      {toast && <div className="toast no-print">{toast}</div>}
    </div>
  )
}
