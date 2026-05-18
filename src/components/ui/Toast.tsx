"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type ToastVariant = "success" | "info" | "warning" | "alert";
type Toast = {
  id: number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastContext = {
  toast: (t: Omit<Toast, "id">) => void;
};

const Ctx = React.createContext<ToastContext | null>(null);

export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "np-toast rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-3.5 flex items-start gap-3",
              t.variant === "success" && "border-[var(--success)]/40",
              t.variant === "alert" && "border-[var(--accent)]/60",
              t.variant === "warning" && "border-[var(--warning)]/40"
            )}
            role="status"
          >
            <div className="mt-0.5 shrink-0">
              {t.variant === "success" && (
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
              )}
              {t.variant === "alert" && (
                <AlertTriangle className="h-4 w-4 text-[var(--accent-2)]" />
              )}
              {t.variant === "warning" && (
                <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
              )}
              {(!t.variant || t.variant === "info") && (
                <Info className="h-4 w-4 text-[var(--muted)]" />
              )}
            </div>
            <div className="min-w-0">
              {t.title && (
                <div className="text-sm font-semibold leading-tight">{t.title}</div>
              )}
              {t.description && (
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {t.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
