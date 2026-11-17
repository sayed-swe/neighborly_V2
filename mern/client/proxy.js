import { NextResponse } from 'next/server';

// Fast, server-side redirects based on the non-secret session hint cookie.
// This is UX only; real authorization is enforced by the API on every request.
const PROTECTED = ['/home', '/feed', '/post', '/onboarding', '/settings', '/admin', '/soon'];
const GUEST_ONLY = ['/login', '/register', '/forgot-password'];

export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.get('nb_session')?.value === '1';
  const matches = (list) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && matches(PROTECTED)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (signedIn && matches(GUEST_ONLY)) {
    return NextResponse.redirect(new URL('/home', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/home/:path*', '/feed/:path*', '/post/:path*', '/onboarding', '/settings/:path*', '/admin/:path*', '/soon/:path*', '/login', '/register', '/forgot-password'],
};
