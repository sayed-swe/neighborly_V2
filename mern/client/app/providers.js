'use client';
import { AuthProvider } from '@/lib/AuthProvider';
import { ToastProvider } from '@/components/ui';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
