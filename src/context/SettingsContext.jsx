// Appearance (light / dark / system) and language (English / Bangla), saved on this device.
import { createContext, useContext, useEffect, useState } from 'react'
import { getLang, setLangValue } from '../lib/i18n'

const SettingsContext = createContext(null)
const readTheme = () => { try { return localStorage.getItem('nb-theme') || 'system' } catch { return 'system' } }
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme)
  const [lang, setLangState] = useState(getLang)
  const [resolved, setResolved] = useState(() => (theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme))

  useEffect(() => {
    const apply = () => {
      const r = theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = r
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', r === 'dark' ? '#0d0f12' : '#ffffff')
      setResolved(r)
    }
    apply()
    if (theme !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const setTheme = (next) => { setThemeState(next); try { localStorage.setItem('nb-theme', next) } catch { /* ignore */ } }
  const setLang = (next) => { setLangValue(next); setLangState(getLang()) }

  return (
    <SettingsContext.Provider value={{ theme, resolved, setTheme, lang, setLang }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
