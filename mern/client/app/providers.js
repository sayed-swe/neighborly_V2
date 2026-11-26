'use client';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/AuthProvider';
import { ToastProvider } from '@/components/ui';
import { watchSystemTheme } from '@/lib/theme';

export default function Providers({ children }) {
  useEffect(() => watchSystemTheme(), []);
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
