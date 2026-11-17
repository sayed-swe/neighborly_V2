import Link from 'next/link';

/** House inside radius rings: "your home, and what's within reach". */
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
      <path d="M10.5 15.2 16 10.6l5.5 4.6V21a1 1 0 0 1-1 1h-3v-3.6h-3V22h-3a1 1 0 0 1-1-1z" fill="currentColor" />
      <circle cx="24.6" cy="8.4" r="2.6" fill="var(--brick)" />
    </svg>
  );
}

export default function Logo({ href = '/', light = false }) {
  return (
    <Link href={href} className="logo" style={{ color: light ? '#fff' : 'var(--green)' }} aria-label="Neighborly home">
      <LogoMark />
      <span className="logo-word" style={{ color: light ? '#fff' : 'var(--ink)' }}>Neighborly</span>
    </Link>
  );
}
