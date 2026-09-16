import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import AdminTaskDialog from './AdminTaskDialog';

export default function AdminTestEmail({ onQueued }: { onQueued: () => void }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('confirmation');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ kind: string; to: string; request_id: string } | null>(null);
  const locked = useRef(false);
  const send = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const address = to.trim();
    // Keep the same request key after an uncertain response; a successful new test gets a fresh key.
    if (!pending.current || pending.current.kind !== kind || pending.current.to !== address) {
      pending.current = { kind, to: address, request_id: crypto.randomUUID() };
    }
    try {
      const response = await apiFetch('/api/admin/emails/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not queue the test email.');
      pending.current = null; setOpen(false); showToast(body.message, 'success'); onQueued();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm the test. Retry to avoid sending a duplicate.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <>
    <button className="admin-button" onClick={() => { setOpen(true); setError(''); }}>Send test email</button>
    {open && <AdminTaskDialog title="Send test email" busy={busy} onClose={() => setOpen(false)}>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className="block text-sm">Template<AdminSelect fullWidth aria-label="Test email template" className="admin-input mt-2" value={kind} disabled={busy} onChange={setKind}
          options={[{ value: 'confirmation', label: 'Application received' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Denied' }, { value: 'waitlisted', label: 'Waitlisted' }]} /></label>
        <label className="block text-sm">Send to<input className="admin-input mt-2 w-full" type="email" required maxLength={254} placeholder="you@example.com" value={to} disabled={busy} onChange={event => setTo(event.target.value)} /></label>
        <p className="admin-meta">Uses the saved template with the sample name Alex and a [TEST] subject. Save any template edits before sending.</p>
        {kind === 'approved' && <p className="admin-meta">Uses the invitation deadline, or the September 20 sample if no deadline is set.</p>}
        {error && <p role="alert" className="text-red6 text-sm">{error}</p>}
        <div className="flex justify-end"><button className="admin-button admin-button-primary" disabled={busy || !to.trim()}>{busy ? 'Queueing…' : 'Send test email'}</button></div>
      </form>
    </AdminTaskDialog>}
  </>;
}
