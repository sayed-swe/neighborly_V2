'use client';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import LocationPicker from '@/components/LocationPicker';
import { useAuth } from '@/lib/AuthProvider';

export default function OnboardingPage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="onboard">
      <header className="onboard-top wrap">
        <Logo href="/onboarding" />
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </header>
      <main id="main" className="wrap onboard-main">
        <div className="onboard-steps" aria-label="Progress">
          <span className="is-done">Account</span><span className="is-done">Email confirmed</span><span className="is-current">Home area</span>
        </div>
        <h1 className="onboard-title">Where’s home, {user.name.split(' ')[0]}?</h1>
        <p className="muted onboard-lede">We use this to show you what’s nearby. Neighbours only ever see an approximate area, never your pin.</p>
        <LocationPicker
          submitLabel="Save and open my neighbourhood"
          onSaved={(u) => { setUser(u); router.replace('/home'); }}
        />
      </main>
    </div>
  );
}
