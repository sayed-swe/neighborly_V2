import { z } from 'zod';
import { SELF_SIGNUP_ROLES, SERVICE_CATEGORIES } from '../users/user.model.js';

export const email = z.string().trim().toLowerCase().max(254).email('Enter a valid email address');

export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number')
  .refine((v) => !/^(.)\1+$/.test(v), 'Password is too repetitive');

export const name = z
  .string()
  .trim()
  .min(2, 'Name is too short')
  .max(60, 'Name is too long')
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Use letters, spaces, apostrophes or hyphens only');

const token = z.string().min(20).max(200);

export const registerSchema = z
  .strictObject({
    name,
    email,
    password,
    role: z.enum(SELF_SIGNUP_ROLES).default('resident'), // moderator/admin can never be self-selected
    businessName: z.string().trim().min(2).max(80).optional(),
    serviceCategory: z.enum(SERVICE_CATEGORIES).optional(),
    acceptTerms: z.literal(true, { error: 'You must accept the terms' }),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'provider') {
      if (!v.businessName) ctx.addIssue({ code: 'custom', path: ['businessName'], message: 'Business name is required' });
      if (!v.serviceCategory) ctx.addIssue({ code: 'custom', path: ['serviceCategory'], message: 'Pick a service category' });
    }
    if (v.password.toLowerCase().includes(v.email.split('@')[0]) && v.email.split('@')[0].length >= 4) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password must not contain your email' });
    }
  });

export const loginSchema = z.strictObject({ email, password: z.string().min(1, 'Enter your password').max(128) });
export const emailOnlySchema = z.strictObject({ email });
export const tokenSchema = z.strictObject({ token });
export const resetSchema = z.strictObject({ token, password });
export const changePasswordSchema = z
  .strictObject({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ['newPassword'], message: 'Choose a different password' });
