import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Toast from "./Toast";
import { ToastContext, type ToastType } from "./ToastContext";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Render into document.body so the toast escapes any flex/overflow
          ancestor (body itself is `display: flex; overflow-x: hidden`, which
          was clipping the stack). */}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
