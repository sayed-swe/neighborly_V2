'use client';
import axios from 'axios';

/**
 * The access token lives only in memory (never localStorage), so an XSS bug
 * can't read a long-lived credential. The refresh token is an httpOnly cookie.
 */
let accessToken = null;
let refreshPromise = null;
let onSessionEnd = () => {};

export const setAccessToken = (t) => { accessToken = t; };
export const setSessionEndHandler = (fn) => { onSessionEnd = fn; };

export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Single in-flight refresh shared by every caller; retries once if another tab rotated first. */
export function refreshSession() {
  refreshPromise ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data } = await axios.post('/api/auth/refresh', null, { withCredentials: true });
          accessToken = data.accessToken;
          return data;
        } catch (err) {
          if (err.response?.status === 409 && attempt === 0) { await sleep(400); continue; }
          throw err;
        }
      }
    } finally {
      setTimeout(() => { refreshPromise = null; }, 0);
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const code = response?.data?.error?.code;
    if (response?.status === 401 && ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED'].includes(code) && !config._retried) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        accessToken = null;
        onSessionEnd();
      }
    }
    return Promise.reject(error);
  },
);

/** Normalises API errors for forms: { message, code, fields } */
export function parseError(err) {
  const e = err?.response?.data?.error;
  if (e) return { message: e.message, code: e.code, fields: e.fields ?? {}, minutes: e.minutes };
  if (err?.code === 'ECONNABORTED') return { message: 'The request timed out. Check your connection.', fields: {} };
  return { message: 'Could not reach Neighborly. Check your connection and try again.', fields: {} };
}
