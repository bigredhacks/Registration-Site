import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import { useAdminSelection } from './AdminSelectionContext';
import { buildReleasePreview, studentName, type AdminStudent } from './adminApprovalState';
import AdminTaskDialog from './AdminTaskDialog';
import EmailPreview from './EmailPreview';

type Kind = 'approved' | 'rejected' | 'waitlisted';
const kinds: { value: Kind; label: string }[] = [
  { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Denied' }, { value: 'waitlisted', label: 'Waitlisted' },
];
interface Draft { id: string; enabled: boolean; recipients: { id: number; kind: Kind; name: string; recipient: string; subject: string }[] }
interface Message { subject: string; html: string; to: string }

export default function AdminDecisionRelease() {
  const { selected, formKey, busy, release } = useAdminSelection();
  const { showToast } = useToast();
  const [selection, setSelection] = useState<ReturnType<typeof buildReleasePreview> | null>(null);
  const [sendEmails, setSendEmails] = useState(false);
  const [emailKinds, setEmailKinds] = useState<Kind[]>(['approved', 'rejected', 'waitlisted']);
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [tested, setTested] = useState<Kind[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const locked = useRef(false);
  useEffect(() => () => { request.current++; }, [formKey]);
  const working = busy || loading;
  const run = async (action: (current: number) => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setLoading(true); setError('');
    const current = ++request.current;
    try { await action(current); }
    catch (cause) { if (current === request.current) setError(cause instanceof Error ? cause.message : 'Could not complete this action.'); }
    finally { locked.current = false; if (current === request.current) setLoading(false); }
  };
  const prepare = () => run(async current => {
    const ids = [...selected.keys()];
    const [response, config] = await Promise.all([
      apiFetch('/api/admin/approval/selection?form_key=registration'), apiFetch('/api/admin/emails/releases/config'),
    ]);
    if (!response.ok || !config.ok) throw new Error('Could not refresh selected decisions. Try again.');
    const [body, settings]: [{ data: AdminStudent[] }, { enabled: boolean }] = await Promise.all([response.json(), config.json()]);
    if (current !== request.current) return;
    setSelection(buildReleasePreview(ids, body.data)); setEnabled(settings.enabled);
    setDraft(null); setMessage(null); setSendEmails(false); setEmailKinds(['approved', 'rejected', 'waitlisted']); setTested([]);
  });
  const loadMessage = async (draftId: string, id: string) => {
    const response = await apiFetch(`/api/admin/emails/releases/${draftId}/preview?registration_id=${id}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load this email preview.');
    return body as Message;
  };
  const review = () => run(async current => {
    const response = await apiFetch('/api/admin/emails/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions: selection!.decisions, email_kinds: sendEmails ? emailKinds : [] }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not prepare release.');
    if (current !== request.current) return;
    setDraft(body); setEnabled(body.enabled); setTested([]); setMessage(null);
    const first = body.recipients[0];
    setRecipientId(first ? String(first.id) : '');
    if (first) {
      const preview = await loadMessage(body.id, String(first.id));
      if (current === request.current) setMessage(preview);
    }
  });
  const changeRecipient = (id: string) => run(async current => {
    setRecipientId(id); setMessage(null);
    const preview = await loadMessage(draft!.id, id);
    if (current === request.current) setMessage(preview);
  });
  const test = (kind: Kind) => run(async () => {
    const response = await apiFetch(`/api/admin/emails/releases/${draft!.id}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not queue the test email.');
    setTested(previous => [...previous, kind]); showToast(body.message, 'success');
  });
  const confirm = () => run(async () => { if (await release(draft!.id)) setSelection(null); });
  if (formKey !== 'registration') return null;
  const emailCount = selection?.students.filter(student => sendEmails && emailKinds.includes(student.status as Kind)).length ?? 0;

  return <div className="admin-release-action">
    <button className="admin-button admin-button-primary" disabled={working || !selected.size} onClick={() => void prepare()}>{loading && !selection ? 'Refreshing decisions…' : 'Release decisions…'}</button>
    {error && !selection && <p role="alert" className="text-red6 mt-2">{error}</p>}
    {selection && <AdminTaskDialog title="Release decisions" busy={working} onClose={() => { request.current++; setSelection(null); setError(''); }}>
      {!selection.decisions.length ? <p>No selected decisions are ready to release. Pending or missing applications remain selected.</p> : <>
        <p className="admin-meta mb-4">{selection.decisions.length} decisions will be visible on applicant dashboards. Previous invitation responses are kept.</p>
        {!draft && <div className="mb-5 space-y-3">
          <label className="text-sm">Decision emails<AdminSelect fullWidth aria-label="Decision email sending" className="admin-input mt-2" value={sendEmails ? 'send' : 'none'} disabled={working}
            onChange={value => setSendEmails(value === 'send')} options={[{ value: 'none', label: 'Release without emails' }, { value: 'send', label: 'Release and send emails' }]} /></label>
          {sendEmails && <p className="admin-meta">Choose which decisions to email. All selected decisions will be released.</p>}
        </div>}
        <div className="divide-y divide-gray-200">
          {kinds.map(kind => {
            const students = selection.students.filter(student => student.status === kind.value);
            if (!students.length) return null;
            const emails = draft ? draft.recipients.filter(person => person.kind === kind.value) : [];
            const sending = draft ? !!emails.length : sendEmails && emailKinds.includes(kind.value);
            return <section key={kind.value} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{kind.label} · {students.length}</h3>
                {!draft && sendEmails ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-red5" checked={emailKinds.includes(kind.value)} disabled={working}
                  onChange={event => setEmailKinds(previous => event.target.checked ? [...previous, kind.value] : previous.filter(value => value !== kind.value))} />Send {kind.label.toLowerCase()} email</label>
                  : <span className="admin-meta">{sending ? `${kind.label} email` : 'No email'}</span>}
              </div>
              {emails[0] && <p className="admin-meta mt-1">Subject: {emails[0].subject}</p>}
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-2 text-sm">
                {students.map(student => <li key={student.id} className="flex flex-wrap justify-between gap-x-4">
                  <span>{studentName(student)}</span><span className="break-all text-gray-500">{emails.find(person => person.id === student.id)?.recipient ?? student.email ?? 'Email unavailable'}</span>
                </li>)}
              </ul>
              {emails.length > 0 && <button className="admin-text-button mt-3" disabled={working || !enabled || tested.includes(kind.value)} onClick={() => void test(kind.value)}>{tested.includes(kind.value) ? 'Test queued to your inbox' : `Send ${kind.label.toLowerCase()} test to my inbox`}</button>}
            </section>;
          })}
        </div>
        {!!selection.skipped && <p className="admin-meta mt-3">{selection.skipped} pending or missing applications will stay selected.</p>}
        {draft && draft.recipients.length > 0 && <div className="mt-5 space-y-3">
          <label className="text-sm">Preview email<AdminSelect fullWidth aria-label="Preview recipient" className="admin-input mt-2" value={recipientId} disabled={working} onChange={id => void changeRecipient(id)}
            options={draft.recipients.map(person => ({ value: String(person.id), label: `${kinds.find(kind => kind.value === person.kind)!.label} · ${person.recipient}` }))} /></label>
          {message ? <EmailPreview {...message} /> : <button className="admin-button" disabled={working} onClick={() => void changeRecipient(recipientId)}>Load email preview</button>}
          <p className="admin-meta">Each applicant gets one private email. Previously queued emails for the same released decision are skipped.</p>
        </div>}
        {!enabled && <p className="admin-email-warning mt-4">Email delivery is paused. In Netlify, set EMAIL_DELIVERY_ENABLED=true and RESEND_API_KEY for production Functions, then redeploy. You can still release without emails.</p>}
        {error && <p role="alert" className="text-red6 mt-4">{error}</p>}
        {selection.decisions.length > 1000 && <p role="alert" className="text-red6 mt-3">Release up to 1,000 applicants at a time.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {draft ? <>
            <button className="admin-button" disabled={working} onClick={() => { setDraft(null); setMessage(null); setError(''); }}>Change options</button>
            <button className="admin-button admin-button-primary" disabled={working || (draft.recipients.length > 0 && (!enabled || !message))} onClick={() => void confirm()}>
              {busy ? 'Releasing…' : `Release ${selection.decisions.length} decisions${draft.recipients.length ? ` and queue ${draft.recipients.length} emails` : ''}`}
            </button>
          </> : <button className="admin-button admin-button-primary" disabled={working || selection.decisions.length > 1000} onClick={() => void review()}>
            {loading ? 'Preparing…' : `Review release${emailCount ? ` and ${emailCount} emails` : ''}`}
          </button>}
        </div>
      </>}
    </AdminTaskDialog>}
  </div>;
}
