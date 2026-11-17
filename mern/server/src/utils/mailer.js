import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { AppError } from './AppError.js';

let transporter;
export const outbox = []; // last messages, used by tests and dev logging

function getTransport() {
  if (transporter !== undefined) return transporter;
  transporter = env.smtpEnabled
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: (env.SMTP_PORT ?? 587) === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS.replace(/\s+/g, '') }, // app passwords are often pasted with spaces
        connectionTimeout: 10_000,
      })
    : null;
  return transporter;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ heading, body, cta, url, footnote }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1c2420">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:520px;background:#fffdf9;border:1px solid #e6dccb;border-radius:14px">
  <tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:700;color:#1f4d3a">Neighborly</td></tr>
  <tr><td style="padding:8px 32px 0"><h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(heading)}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${body}</p>
  ${cta ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#1f4d3a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${escapeHtml(cta)}</a>
  <p style="font-size:12px;color:#6b706c;margin:20px 0 0;word-break:break-all">Or paste this link into your browser:<br>${escapeHtml(url)}</p>` : ''}
  </td></tr>
  <tr><td style="padding:24px 32px 28px;font-size:12px;color:#6b706c">${footnote ?? "If you didn't request this, you can safely ignore this email."}</td></tr>
  </table></td></tr></table></body></html>`;
}

export async function sendMail({ to, subject, text, html }) {
  const message = { from: env.MAIL_FROM, to, subject, text, html };
  outbox.push(message);
  if (outbox.length > 50) outbox.shift();

  const transport = getTransport();
  if (!transport) {
    if (!env.isTest) {
      console.log(`\n📧 [dev mail] To: ${to}\n   Subject: ${subject}\n   ${text.split('\n').join('\n   ')}\n`);
    }
    return;
  }
  try {
    await transport.sendMail(message);
  } catch (err) {
    console.error(`📧 Email to ${to} failed: ${err.message}`);
    throw new AppError(503, 'EMAIL_FAILED', 'We couldn’t send the email right now. Please try again in a minute.');
  }
}

/** Called at startup: tells you immediately whether email will actually be delivered. */
export async function checkMailer() {
  if (env.isTest) return;
  const transport = getTransport();
  if (!transport) {
    console.log('📧 Email: SMTP not configured, so emails are PRINTED in this terminal, not sent. (See SMTP_* in server/.env)');
    return;
  }
  try {
    await transport.verify();
    console.log(`📧 Email: sending via ${env.SMTP_HOST} as ${env.SMTP_USER}`);
  } catch (err) {
    const hint = /535|Username and Password not accepted|BadCredentials/i.test(err.message)
      ? 'Gmail rejected the login. Use a 16-character App Password (https://myaccount.google.com/apppasswords), not your normal password.'
      : err.message;
    console.error(`📧 Email: SMTP login FAILED. ${hint}`);
  }
}

export const emails = {
  verify: (user, url) =>
    sendMail({
      to: user.email,
      subject: 'Confirm your email for Neighborly',
      text: `Hi ${user.name},\n\nConfirm your email to activate your Neighborly account:\n${url}\n\nThis link expires in 24 hours.`,
      html: layout({
        heading: `Welcome, ${user.name.split(' ')[0]}`,
        body: 'Confirm your email address to activate your account and start seeing what is happening near home. This link expires in 24 hours.',
        cta: 'Confirm email',
        url,
      }),
    }),
  alreadyRegistered: (user, loginUrl, resetUrl) =>
    sendMail({
      to: user.email,
      subject: 'Someone tried to sign up with your email',
      text: `Hi ${user.name},\n\nSomeone tried to create a Neighborly account with this email, but you already have one.\nSign in: ${loginUrl}\nForgot your password? ${resetUrl}`,
      html: layout({
        heading: 'You already have an account',
        body: `Someone (hopefully you) tried to create a new Neighborly account with this email address. You can <a href="${escapeHtml(loginUrl)}">sign in</a> or <a href="${escapeHtml(resetUrl)}">reset your password</a>.`,
      }),
    }),
  reset: (user, url) =>
    sendMail({
      to: user.email,
      subject: 'Reset your Neighborly password',
      text: `Hi ${user.name},\n\nReset your password here (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, ignore this email; your password won't change.`,
      html: layout({
        heading: 'Reset your password',
        body: 'We received a request to reset your password. This link is valid for 1 hour and can be used once.',
        cta: 'Choose a new password',
        url,
      }),
    }),
  passwordChanged: (user) =>
    sendMail({
      to: user.email,
      subject: 'Your Neighborly password was changed',
      text: `Hi ${user.name},\n\nYour password was just changed and other devices were signed out. If this wasn't you, reset your password immediately.`,
      html: layout({
        heading: 'Your password was changed',
        body: 'Your password was just changed and all other devices were signed out.',
        footnote: "If this wasn't you, reset your password immediately and contact support.",
      }),
    }),
};
