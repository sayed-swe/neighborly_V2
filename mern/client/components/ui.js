'use client';
import { forwardRef, useId, useState, createContext, useCallback, useContext } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, TriangleAlert } from 'lucide-react';
import { passwordStrength } from '@/lib/schemas';
import { initials } from '@/lib/format';

export const Spinner = ({ size = 16 }) => <Loader2 className="spin" size={size} aria-hidden="true" />;

export function Button({ loading, children, className = 'btn btn-primary', disabled, ...props }) {
  return (
    <button className={className} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Label + control + error/hint, wired up with aria attributes. */
export const Field = forwardRef(function Field({ label, error, hint, as = 'input', children, aside, ...props }, ref) {
  const id = useId();
  const Comp = as;
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const cls = as === 'select' ? 'select' : as === 'textarea' ? 'textarea' : 'input';
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}{aside}</label>
      <Comp id={id} ref={ref} className={cls} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props}>
        {children}
      </Comp>
      {hint && !error && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-err`} role="alert"><AlertCircle size={15} style={{ marginTop: 2, flex: 'none' }} />{error}</p>}
    </div>
  );
});

export const PasswordField = forwardRef(function PasswordField({ label = 'Password', error, showStrength, value, aside, ...props }, ref) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const s = passwordStrength(value);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}{aside}</label>
      <div className="input-wrap">
        <input id={id} ref={ref} type={visible ? 'text' : 'password'} className="input" aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : showStrength ? `${id}-str` : undefined} {...props} />
        <button type="button" className="input-action" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showStrength && value && (
        <div id={`${id}-str`} aria-live="polite">
          <div className="strength" data-score={s.score}><span /><span /><span /><span /></div>
          <p className="field-hint" style={{ marginTop: 6 }}><strong>{s.label}</strong> · {s.hint}</p>
        </div>
      )}
      {error && <p className="field-error" id={`${id}-err`} role="alert"><AlertCircle size={15} style={{ marginTop: 2, flex: 'none' }} />{error}</p>}
    </div>
  );
});

const ALERT_ICONS = { error: AlertCircle, info: Info, success: CheckCircle2, warn: TriangleAlert };
export function Alert({ kind = 'info', title, children, actions }) {
  const Icon = ALERT_ICONS[kind];
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} />
      <div>
        {title && <strong style={{ display: 'block' }}>{title}</strong>}
        {children}
        {actions && <div className="alert-actions">{actions}</div>}
      </div>
    </div>
  );
}

const AVATAR_COLORS = ['#1f4d3a', '#c8553a', '#4f7fb8', '#7a4f86', '#b07a16', '#2d6a50'];
export function Avatar({ user, size = 40 }) {
  const seed = [...(user?.id ?? user?.email ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (user?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" width={size} height={size} className="avatar avatar-img" style={{ '--size': `${size}px` }} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar" style={{ '--size': `${size}px`, background: AVATAR_COLORS[seed % AVATAR_COLORS.length] }} aria-hidden="true">
      {initials(user?.name)}
    </span>
  );
}

/* ---------- Toasts ---------- */
const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-kind={t.kind}>
            {t.kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
