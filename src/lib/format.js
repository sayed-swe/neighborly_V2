import { t } from './i18n'

export function timeAgo(date) {
  if (!date) return ''
  const d = new Date(date)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 45) return t('Just now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('{n}m', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('{n}h', { n: h })
  const days = Math.floor(h / 24)
  if (days < 7) return t('{n}d', { n: days })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

export function formatDate(date, opts = {}) {
  if (!date) return ''
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...opts })
}

export function formatDateTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function formatPrice(price, type) {
  if (type === 'free') return t('Free')
  if (price === null || price === undefined || price === '') return t(type === 'exchange' ? 'Exchange' : type === 'buy' ? 'Wanted' : 'Ask price')
  return '৳' + Number(price).toLocaleString('en-IN')
}

export function compactNumber(n) {
  if (n == null) return '0'
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'K'
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

export function labelize(s = '') {
  return t(String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
}

export function toLocalInput(date) {
  const d = date ? new Date(date) : new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
