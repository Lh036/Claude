import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ToastMessage {
  id: number;
  kind: "success" | "error";
  text: string;
}

interface ToastContextValue {
  notify: (kind: "success" | "error", text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((kind: "success" | "error", text: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg",
              t.kind === "success" ? "border-emerald-200" : "border-red-200",
            )}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-success)]" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-danger)]" />
            )}
            <span className="flex-1 text-[var(--color-ink)]">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
