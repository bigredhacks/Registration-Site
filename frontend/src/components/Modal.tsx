import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
}

export default function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  maxWidthClassName = "max-w-lg",
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${maxWidthClassName} max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-xl bg-white p-4 sm:p-6 shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-poppins font-bold text-red6">{title}</h2>
            {description && (
              <p className="mt-1 text-sm font-poppins text-gray-600">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 rounded-full p-1 text-lg leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {children}

        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3 [&>button]:min-h-11">{footer}</div>}
      </div>
    </div>
  );
}
