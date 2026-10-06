import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../../api/client';

interface Toast {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

interface ToastApi {
  success(message: string): void;
  /** Shows the server's message for API errors, or `fallback` for anything else. */
  error(error: unknown, fallback: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const VISIBLE_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, VISIBLE_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (error, fallback) =>
        push('error', error instanceof ApiError ? error.message : fallback),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.tone === 'success' ? (
              <CircleCheck size={16} aria-hidden />
            ) : (
              <CircleAlert size={16} aria-hidden />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}
