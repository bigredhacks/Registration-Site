import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export default function AdminTaskDialog({ title, onClose, children, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (opener instanceof HTMLElement) opener.focus(); };
  }, [opener]);
  return <dialog ref={dialog} aria-labelledby={titleId} className="admin-task-dialog"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="admin-toolbar mb-4"><h2 id={titleId}>{title}</h2><button autoFocus type="button" className="admin-text-button" disabled={busy} onClick={onClose}>Close</button></div>
    {children}
  </dialog>;
}
