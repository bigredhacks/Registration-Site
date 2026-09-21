import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import { renderEmailTemplate, type EmailTemplate, type EmailKind } from '../../../../backend/src/utils/emailTemplates';
import AdminTaskDialog from './AdminTaskDialog';
import EmailPreview from './EmailPreview';

interface Settings { template: EmailTemplate; site_url: string; deadline: string | null; time_zone: string; sample_deadline: boolean }
interface TestRequest { kind: EmailKind; to: string; first_name: string; form_title: string; expected_version: number; request_id: string }

export default function AdminTestEmail({ onQueued }: { onQueued: () => void }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EmailKind>('confirmation');
  const [to, setTo] = useState('');
  const [firstName, setFirstName] = useState('Alex');
  const [formTitle, setFormTitle] = useState('BigRed//Hacks Fall 2026');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<TestRequest | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setSettings(null); setError('');
    apiFetch(`/api/admin/emails/templates/${kind}`).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load this template.');
      if (current) setSettings(body);
    }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Could not load this template.'); });
    return () => { current = false; };
  }, [open, kind]);
  const preview = settings ? renderEmailTemplate(kind, firstName.trim(), formTitle.trim(), settings.site_url, settings.template, settings.deadline, settings.time_zone) : null;
  const send = async () => {
    if (locked.current || !settings) return;
    locked.current = true; setBusy(true); setError('');
    const fields = { kind, to: to.trim(), first_name: firstName.trim(), form_title: formTitle.trim(), expected_version: settings.template.version };
    // Retrying unchanged inputs retains the same queue key after an uncertain response.
    if (!pending.current || Object.entries(fields).some(([key, value]) => pending.current![key as keyof TestRequest] !== value)) {
      pending.current = { ...fields, request_id: crypto.randomUUID() };
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
        <label className="block text-sm">Template<AdminSelect fullWidth aria-label="Test email template" className="admin-input mt-2" value={kind} disabled={busy} onChange={value => { setSettings(null); setKind(value as EmailKind); }}
          options={[{ value: 'confirmation', label: 'Application received' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Denied' }, { value: 'waitlisted', label: 'Waitlisted' }, { value: 'announcement', label: 'General announcement' }]} /></label>
        <label className="block text-sm">Send to<input className="admin-input mt-2 w-full" type="email" required maxLength={254} placeholder="you@example.com" value={to} disabled={busy} onChange={event => setTo(event.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">First name<input className="admin-input mt-2 w-full" required maxLength={100} value={firstName} disabled={busy} onChange={event => setFirstName(event.target.value)} /></label>
          <label className="block text-sm">Application name<input className="admin-input mt-2 w-full" required maxLength={200} value={formTitle} disabled={busy} onChange={event => setFormTitle(event.target.value)} /></label>
        </div>
        <p className="admin-meta">Sample details apply only to this test. Uses the saved template; save any edits before testing.</p>
        {kind === 'approved' && settings?.sample_deadline && <p className="admin-meta">No invitation deadline is set. This test uses the September 20 sample.</p>}
        {preview ? <EmailPreview subject={`[TEST] ${preview.subject}`} html={preview.html} to={to.trim() || undefined} /> : !error && <p className="admin-meta">Loading template…</p>}
        {error && <p role="alert" className="text-red6 text-sm">{error}</p>}
        <div className="flex justify-end"><button className="admin-button admin-button-primary" disabled={busy || !settings || !to.trim() || !firstName.trim() || !formTitle.trim()}>{busy ? 'Queueing…' : 'Send test email'}</button></div>
      </form>
    </AdminTaskDialog>}
  </>;
}
