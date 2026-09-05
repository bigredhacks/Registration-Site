import type { ToastType } from "./ToastContext";

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const styles: Record<ToastType, string> = {
  success: "bg-[#1a1a1a] border-l-4 border-green-500 text-white",
  error:   "bg-[#1a1a1a] border-l-4 border-red5 text-white",
  info:    "bg-[#1a1a1a] border-l-4 border-gray-400 text-white",
};

const icons: Record<ToastType, string> = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
};

export default function Toast({ message, type, onDismiss }: ToastProps) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg px-5 py-3.5 shadow-xl font-poppins text-sm animate-slide-in ${styles[type]}`}
    >
      <span className="text-base font-bold shrink-0">{icons[type]}</span>
      <span className="min-w-0 flex-1 break-words leading-snug">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
