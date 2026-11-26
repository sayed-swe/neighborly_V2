/* Light / dark theme. The preference ('system' | 'light' | 'dark') lives in localStorage on this
   device; <html data-theme> always holds the resolved value so CSS only needs one selector. */

export const THEME_KEY = 'nb_theme';
export const THEME_OPTIONS = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

// Runs in <head> before first paint so a dark-mode user never sees a white flash.
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export function getThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setThemePref(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch { /* private mode: still applies for this visit */ }
  applyTheme(pref);
}

/** Keep following the OS while the preference is 'system'. Returns an unsubscribe function. */
export function watchSystemTheme() {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (getThemePref() === 'system') applyTheme('system'); };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
