// Small shared UI pieces: Avatar, Modal, Empty, Dropdown, Pill, Spinner
import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { initials, labelize } from '../lib/format'
import { STATUS_PILL } from '../lib/constants'
import { t } from '../lib/i18n'

export function Avatar({ src, name, size = 40 }) {
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) }
  if (src && !broken) return <img className="avatar" src={src} alt={name || ''} style={style} onError={() => setBroken(true)} />
  return <div className="avatar" style={style} aria-label={name}>{initials(name)}</div>
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="icon-tile"><Icon size={26} /></div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  )
}

export function Spinner({ size = 22 }) {
  return <div className="center-load"><Loader2 className="spinner" size={size} /></div>
}

export function StatusPill({ value }) {
  if (!value) return null
  return <span className={`pill ${STATUS_PILL[value] || ''}`}>{labelize(value)}</span>
}

export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div className="dropdown-menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function ErrorText({ error }) {
  if (!error) return null
  return <div className="error-text">{error}</div>
}
