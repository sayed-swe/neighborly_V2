import { Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { t } from '../lib/i18n'

export default function Settings() {
  const { theme, resolved, setTheme, lang, setLang } = useSettings()
  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ]
  return (
    <div className="page page-narrow">
      <div className="page-head"><div><h2>{t('Settings')}</h2><p>{t('These settings are saved on this device.')}</p></div></div>

      <div className="card card-pad mb-16">
        <div className="card-title mb-12"><Sun size={18} /> {t('Appearance')}</div>
        <div className="seg">
          {themes.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`seg-btn ${theme === id ? 'active' : ''}`} onClick={() => setTheme(id)}>
              <Icon size={18} /> {t(label)}
            </button>
          ))}
        </div>
        <p className="hint mt-8">{t('System follows the light or dark setting of your phone or computer.')} {theme === 'system' && <b>{t('Right now: ')}{t(resolved === 'dark' ? 'Dark' : 'Light')}</b>}</p>
      </div>

      <div className="card card-pad">
        <div className="card-title mb-12"><Languages size={18} /> {t('Language')}</div>
        <div className="seg">
          <button className={`seg-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>{t('English')}</button>
          <button className={`seg-btn ${lang === 'bn' ? 'active' : ''}`} onClick={() => setLang('bn')}>বাংলা</button>
        </div>
        <p className="hint mt-8">{t('Posts and messages written by people stay in the language they were written in.')}</p>
      </div>
    </div>
  )
}
