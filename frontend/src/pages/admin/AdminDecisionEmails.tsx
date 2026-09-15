import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import AdminTaskDialog from './AdminTaskDialog';
import { useAdminSelection } from './AdminSelectionContext';
import EmailPreview from './EmailPreview';

interface Preview { subject: string; html: string; to?: string }
interface Draft {
  id: string; kind: string; enabled: boolean; preview: Preview;
  recipients: { id: number; recipient: string; name: string }[];
  skipped: { id: number; reason: string }[];
}

export default function AdminDecisionEmails({ cohortKind }: { cohortKind?: 'approved' | 'rejected' }) {
  const { selected, formKey, busy } = useAdminSelection();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(cohortKind ?? 'approved');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [testQueued, setTestQueued] = useState(false);
  const lock = useRef(false);
  const snapshot = useRef<number[]>([]);
  if (!cohortKind && formKey !== 'registration') return null;

  const action = async (task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setWorking(true); setError('');
    try { await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Email action failed.'); }
    finally { lock.current = false; setWorking(false); }
  };
  const prepare = () => action(async () => {
    const response = await apiFetch('/api/admin/emails/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cohortKind ? { kind: cohortKind, scope: 'released' } : { kind, ids: snapshot.current }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not prepare a preview.');
    setDraft(body); setPreview(body.preview); setRecipientId(String(body.recipients[0].id)); setAcknowledged(false); setTestQueued(false);
  });
  const changeRecipient = (id: string) => action(async () => {
    setRecipientId(id); setPreview(null);
    const response = await apiFetch(`/api/admin/emails/drafts/${draft!.id}/preview?registration_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load this preview.');
    setPreview(body);
  });
  const send = (test = false) => action(async () => {
    const response = await apiFetch(`/api/admin/emails/drafts/${draft!.id}/${test ? 'test' : 'send'}`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not confirm sending. Retry this preview to avoid duplicate emails.');
    if (test) { setTestQueued(true); showToast(body.message, 'success'); }
    else { showToast(`${body.queued} emails queued. ${body.skipped} previously queued. Track progress in Emails.`, 'success'); setOpen(false); setDraft(null); }
  });

  return <>
    <button className="admin-button" disabled={busy || (!cohortKind && !selected.size)} onClick={() => {
      snapshot.current = [...selected.keys()]; setOpen(true); setDraft(null); setPreview(null); setError(''); if (cohortKind) void prepare();
    }}>{cohortKind ? `Email ${cohortKind === 'approved' ? 'approved' : 'denied'}…` : 'Send decision emails…'}</button>
    {open && <AdminTaskDialog title={draft ? 'Review decision emails' : 'Prepare decision emails'} busy={working} onClose={() => setOpen(false)}>
      {!draft && cohortKind ? <p className="admin-meta">{working ? 'Preparing recipients…' : 'Could not prepare emails.'}</p> : !draft ? <>
        <p className="admin-meta mb-4">Uses the released decision for each of the {snapshot.current.length} selected applicants. Applicants whose released decision doesn’t match will be skipped.</p>
        <label className="admin-meta">Email draft<AdminSelect fullWidth aria-label="Decision email" className="admin-input mt-2" value={kind} disabled={working} onChange={value => setKind(value as 'approved' | 'rejected')}
          options={[{ value: 'approved', label: 'Approved — invitation to RSVP' }, { value: 'rejected', label: 'Not selected — apply again next year' }]} /></label>
        {snapshot.current.length > 1000 && <p role="alert" className="text-red6 my-3">Select up to 1,000 applicants per email wave.</p>}
        <button className="admin-button admin-button-primary mt-5" disabled={working || snapshot.current.length > 1000} onClick={() => void prepare()}>{working ? 'Preparing…' : 'Preview recipients and email'}</button>
      </> : <>
        <div className="admin-email-review">
          <div>
            <p className="admin-email-count">{draft.recipients.length} <span>{draft.recipients.length === 1 ? 'recipient' : 'recipients'}</span></p>
            <p className="admin-meta mb-4">One private email per applicant. Emails previously queued for this released decision are skipped automatically.</p>
            <label className="admin-meta">Preview recipient<AdminSelect fullWidth aria-label="Preview recipient" className="admin-input mt-2" value={recipientId} onChange={id => void changeRecipient(id)} disabled={working}
              options={draft.recipients.map(person => ({ value: String(person.id), label: `${person.name || person.recipient} · ${person.recipient}` }))} /></label>
            <details className="admin-meta mt-4"><summary className="cursor-pointer">Review all recipients</summary><ul className="mt-2 max-h-48 overflow-y-auto space-y-2">{draft.recipients.map(person => <li key={person.id}>{person.name}<br />{person.recipient}</li>)}</ul></details>
            {!!draft.skipped.length && <details className="admin-meta mt-4"><summary className="cursor-pointer">{draft.skipped.length} applicants skipped</summary><ul className="mt-2 space-y-2">{draft.skipped.map(person => <li key={person.id}>Application #{person.id}: {person.reason}</li>)}</ul></details>}
            <button className="admin-button mt-5" disabled={working || testQueued || !draft.enabled} onClick={() => void send(true)}>{testQueued ? 'Test queued to your inbox' : 'Send a test to my inbox'}</button>
            <p className="admin-meta mt-2">The test uses the first recipient’s personalization and goes only to your admin email.</p>
          </div>
          {preview ? <EmailPreview {...preview} /> : <p role="status">Loading preview…</p>}
        </div>
        {!draft.enabled && <p role="status" className="admin-email-warning mt-4">Delivery is paused. An operator must configure Resend and enable email delivery before sending.</p>}
        <label className="flex items-start gap-3 text-sm mt-5"><input type="checkbox" className="mt-1 accent-red5" checked={acknowledged} disabled={working} onChange={event => setAcknowledged(event.target.checked)} /><span>I reviewed this message and the full recipient list. Queue these decision emails for sending.</span></label>
        <div className="flex flex-wrap justify-end gap-3 mt-5">
          <button className="admin-button" disabled={working} onClick={() => { if (cohortKind) setOpen(false); setDraft(null); setError(''); }}>Back</button>
          <button className="admin-button admin-button-primary" disabled={working || !acknowledged || !draft.enabled || !preview} onClick={() => void send()}>{working ? 'Working…' : `Queue ${draft.recipients.length} ${draft.recipients.length === 1 ? 'email' : 'emails'}`}</button>
        </div>
      </>}
      {error && <p role="alert" className="text-red6 mt-4">{error}</p>}
    </AdminTaskDialog>}
  </>;
}
