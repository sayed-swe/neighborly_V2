import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './styles/app.css'
import App from './App'
import SetupScreen from './pages/SetupScreen'
import { isConfigured } from './lib/supabase'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SettingsProvider, useSettings } from './context/SettingsContext'

// Changing the language remounts the screens so every label is re-read.
function Localized({ children }) {
  const { lang } = useSettings()
  return <React.Fragment key={lang}>{children}</React.Fragment>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfigured ? (
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <SettingsProvider>
          <ToastProvider>
            <AuthProvider>
              <Localized><App /></Localized>
            </AuthProvider>
          </ToastProvider>
        </SettingsProvider>
      </BrowserRouter>
    ) : (
      <SetupScreen />
    )}
  </React.StrictMode>,
)
