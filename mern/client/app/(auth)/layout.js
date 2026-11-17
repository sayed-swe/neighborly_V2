import Logo from '@/components/Logo';
import { BadgeCheck, EyeOff, MapPin } from 'lucide-react';

export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <main id="main" className="auth-main">
        <div className="auth-top"><Logo /></div>
        <div className="auth-form">{children}</div>
        <p className="auth-foot tiny muted">Protected by account lockout, rate limiting and encrypted sessions.</p>
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-rings" />
        <div className="auth-aside-inner">
          <blockquote>
            The water-cut notice, the lost cat, the electrician everyone trusts. Everything your street knows, in one place.
          </blockquote>
          <p className="auth-aside-by">Why we’re building Neighborly</p>
          <ul>
            <li><BadgeCheck size={18} /> Verified neighbours only</li>
            <li><EyeOff size={18} /> Your exact address is never shown</li>
            <li><MapPin size={18} /> You choose your radius, 1–10 km</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
