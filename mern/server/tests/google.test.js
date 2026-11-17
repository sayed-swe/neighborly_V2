import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Enable Google for this file with fake credentials (no network calls are made).
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
const { app, startDB, stopDB } = await import('./setup.js');

beforeAll(startDB);
afterAll(stopDB);

describe('Google sign-in', () => {
  it('reports the provider as enabled', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.body).toEqual({ google: true });
  });

  it('redirects to Google with state, PKCE and the right redirect URI', async () => {
    const res = await request(app).get('/api/auth/google?next=/settings');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('email');
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('nb_g='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(decodeURIComponent(cookie)).toContain(url.searchParams.get('state'));
  });

  it('rejects a callback whose state does not match (CSRF)', async () => {
    const start = await request(app).get('/api/auth/google');
    const cookie = start.headers['set-cookie'].find((c) => c.startsWith('nb_g=')).split(';')[0];
    const res = await request(app).get('/api/auth/google/callback?code=abc&state=forged-state-value-000000').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=google_state');
  });

  it('rejects a callback with no state cookie', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=abc&state=whatever');
    expect(res.headers.location).toContain('error=google_state');
  });

  it('handles the user cancelling on Google', async () => {
    const res = await request(app).get('/api/auth/google/callback?error=access_denied');
    expect(res.headers.location).toContain('error=google_cancelled');
  });

  it('ignores off-site ?next= values (open redirect)', async () => {
    const res = await request(app).get('/api/auth/google?next=//evil.example');
    const cookie = decodeURIComponent(res.headers['set-cookie'].find((c) => c.startsWith('nb_g=')));
    expect(cookie).toContain('"next":""');
  });
});
