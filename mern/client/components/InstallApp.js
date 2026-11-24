'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

const DISMISS_KEY = 'nb-install-dismissed';

/**
 * "Install Neighborly" card. Only shows when the browser says the app can be
 * installed (Chrome/Edge/Android fire `beforeinstallprompt`), and stays hidden
 * once installed or dismissed. iOS has no prompt API, so it never shows there.
 */
export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* private mode */ }
    if (dismissed) return;
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!prompt) return null;

  async function install() {
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    setPrompt(null); // the event can only be used once
  }
  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setPrompt(null);
  }

  return (
    <section className="card card-pad mod-card" aria-labelledby="install-h">
      <Download size={22} />
      <div style={{ flex: 1 }}>
        <h2 id="install-h" className="card-title">Install Neighborly</h2>
        <p className="small muted">Open it from your home screen like an app, even with a weak connection.</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-sm btn-ghost" onClick={dismiss}>Not now</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={install}>Install</button>
      </div>
    </section>
  );
}
