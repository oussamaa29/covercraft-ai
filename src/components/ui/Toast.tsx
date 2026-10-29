"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

/** `const toast = useToast(); toast("Copied")` — short confirmations, bottom-right. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++nextId.current;
    // Keep at most three on screen; the oldest makes room.
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 print:hidden sm:inset-x-auto sm:right-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex animate-[fade-in_200ms_ease-out] items-center gap-2 rounded-xl border bg-surface px-4 py-3 text-sm shadow-md motion-reduce:animate-none",
              t.tone === "success" ? "border-accent/40" : "border-highlight/40"
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 size={16} className="shrink-0 text-accent" />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-highlight" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
