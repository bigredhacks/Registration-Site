import { useEffect, useId, useRef, type ReactNode } from 'react';

export default function ConfirmationDialog({ open, title, children, busy, confirmLabel, onConfirm, onClose }: {
  open: boolean;
  title: string;
  children: ReactNode;
  busy: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);

  return <dialog ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-6 text-gray-800 shadow-xl backdrop:bg-black/50">
    <h2 id={titleId} className="text-xl font-poppins font-bold text-red6">{title}</h2>
    <div className="mt-3 text-sm font-poppins leading-relaxed">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button autoFocus type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg border border-gray-300 px-4 font-poppins text-sm disabled:opacity-50">Cancel</button>
      <button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 rounded-lg bg-red5 px-4 font-poppins text-sm font-semibold text-white hover:bg-red3 disabled:opacity-50">{busy ? 'Saving…' : confirmLabel}</button>
    </div>
  </dialog>;
}
