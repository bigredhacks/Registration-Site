import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useAdminSelection } from './AdminSelectionContext';
import { buildReleasePreview, studentName, type AdminStudent } from './adminApprovalState';
import AdminTaskDialog from './AdminTaskDialog';

type Kind = 'approved' | 'rejected' | 'waitlisted';
const kinds: { value: Kind; label: string }[] = [
  { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Denied' }, { value: 'waitlisted', label: 'Waitlisted' },
];
interface Draft { id: string; enabled: boolean; recipients: { id: number; kind: Kind; name: string; recipient: string; subject: string }[] }

export default function AdminDecisionRelease() {
  const { selected, formKey, busy, release } = useAdminSelection();
  const [selection, setSelection] = useState<ReturnType<typeof buildReleasePreview> | null>(null);
  const [sendEmails, setSendEmails] = useState(false);
  const [emailKinds, setEmailKinds] = useState<Kind[]>(['approved', 'rejected', 'waitlisted']);
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
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
    setDraft(null); setSendEmails(false); setEmailKinds(['approved', 'rejected', 'waitlisted']);
  });
  const review = () => run(async current => {
    const response = await apiFetch('/api/admin/emails/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions: selection!.decisions, email_kinds: sendEmails ? emailKinds : [] }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not prepare release.');
    if (current !== request.current) return;
    setDraft(body); setEnabled(body.enabled);
  });
  const confirm = () => run(async () => { if (await release(draft!.id)) setSelection(null); });
  if (formKey !== 'registration') return null;
  const emailCount = selection?.students.filter(student => sendEmails && emailKinds.includes(student.status as Kind)).length ?? 0;

  return <div className="admin-release-action">
    <button className="admin-button admin-button-primary" disabled={working || !selected.size} onClick={() => void prepare()}>{loading && !selection ? 'Refreshing decisions…' : 'Release decisions…'}</button>
    {error && !selection && <p role="alert" className="text-red6 mt-2">{error}</p>}
    {selection && <AdminTaskDialog title="Release decisions" busy={working} onClose={() => { request.current++; setSelection(null); setError(''); }}>
      {!selection.decisions.length ? <p>No selected decisions are ready to release. Pending or missing applications remain selected.</p> : <>
        <p className="admin-meta mb-4">{selection.decisions.length} {selection.decisions.length === 1 ? 'decision will' : 'decisions will'} be visible on applicant dashboards. Previous invitation responses are kept.</p>
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

            </section>;
          })}
        </div>
        {!!selection.skipped && <p className="admin-meta mt-3">{selection.skipped} pending or missing applications will stay selected.</p>}
        <p className="admin-meta mt-4">Preview and test templates in Emails. Each applicant receives the email for their released decision.</p>
        {!enabled && <p className="admin-email-warning mt-4">Email delivery is paused. In Netlify, set EMAIL_DELIVERY_ENABLED=true and RESEND_API_KEY for production Functions, then redeploy. You can still release without emails.</p>}
        {error && <p role="alert" className="text-red6 mt-4">{error}</p>}
        {selection.decisions.length > 1000 && <p role="alert" className="text-red6 mt-3">Release up to 1,000 applicants at a time.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {draft ? <>
            <button className="admin-button" disabled={working} onClick={() => { setDraft(null); setError(''); }}>Change options</button>
            <button className="admin-button admin-button-primary" disabled={working || (draft.recipients.length > 0 && !enabled)} onClick={() => void confirm()}>
              {busy ? 'Releasing…' : `Release ${selection.decisions.length} ${selection.decisions.length === 1 ? 'decision' : 'decisions'}${draft.recipients.length ? ` and queue ${draft.recipients.length} ${draft.recipients.length === 1 ? 'email' : 'emails'}` : ''}`}
            </button>
          </> : <button className="admin-button admin-button-primary" disabled={working || selection.decisions.length > 1000} onClick={() => void review()}>
            {loading ? 'Preparing…' : `Review release${emailCount ? ` and ${emailCount} ${emailCount === 1 ? 'email' : 'emails'}` : ''}`}
          </button>}
        </div>
      </>}
    </AdminTaskDialog>}
  </div>;
}
