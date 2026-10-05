import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Tone = "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: Tone;
};

type ToastApi = {
  toast: (message: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Tone = "error") => {
    const id = nextId++;
    setToasts((current) => [...current.slice(-4), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto max-w-sm rounded-xl border px-3 py-2 text-sm shadow-lg ${
              item.tone === "error"
                ? "border-down/40 bg-panel text-down dark:border-down/50 dark:bg-panel-dark"
                : "border-line bg-panel text-ink dark:border-line-dark dark:bg-panel-dark dark:text-ink-dark"
            }`}
            role="status"
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
