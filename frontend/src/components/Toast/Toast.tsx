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
      className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-xl font-poppins text-sm min-w-[260px] max-w-sm animate-slide-in ${styles[type]}`}
    >
      <span className="text-base font-bold shrink-0">{icons[type]}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
