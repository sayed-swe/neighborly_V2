// Tiny i18n: English text is the key, src/lib/bn.js holds the Bangla for it.
// Usage: t('Home Feed')  or  t('{n} comments', { n: 4 })
import bn from './bn'

const read = () => { try { return localStorage.getItem('nb-lang') } catch { return null } }
let lang = read() === 'bn' ? 'bn' : 'en'

export const getLang = () => lang
export function setLangValue(next) {
  lang = next === 'bn' ? 'bn' : 'en'
  try { localStorage.setItem('nb-lang', lang) } catch { /* private mode */ }
  document.documentElement.lang = lang
}

export function t(text, vars) {
  if (typeof text !== 'string') return text
  let out = (lang === 'bn' && bn[text]) || text
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}
