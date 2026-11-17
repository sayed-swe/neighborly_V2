import Link from 'next/link';
import Logo from '@/components/Logo';

export default function NotFound() {
  return (
    <main id="main" className="nf">
      <Logo />
      <p className="nf-code">404</p>
      <h1>This street doesn’t exist.</h1>
      <p className="muted">The page you’re looking for has moved, or never was.</p>
      <Link href="/" className="btn btn-primary">Take me home</Link>
    </main>
  );
}
