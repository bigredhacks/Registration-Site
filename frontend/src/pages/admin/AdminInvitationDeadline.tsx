import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useToast } from '@/components/Toast/ToastContext';
import { deadlineToLocalInput, localInputToDeadline, formatRegistrationDeadline } from '@/lib/registrationClosure';
interface Settings { deadline: string | null; time_zone: string; version: number; server_now: string }
export default function AdminInvitationDeadline({ onSaved }: { onSaved: () => void }) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [change, setChange] = useState<{ deadline: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true; setError('');
    apiFetch('/api/admin/invitations/deadline').then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not load the deadline.');
      if (current) { setSettings(body); setInput(deadlineToLocalInput(body.deadline, body.time_zone) || '2026-09-21T00:00'); }
    }).catch(cause => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [reload]);
  const review = (clear = false) => {
    try {
      if (!settings) return;
      const deadline = clear ? null : localInputToDeadline(input, settings.time_zone);
      if (!clear && !deadline) throw new Error('Choose an invitation deadline.');
      setError(''); setChange({ deadline });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enter a valid deadline.'); }
  };
  const save = async () => {
    if (!change || !settings || saving) return;
    setSaving(true);
    try {
      const response = await apiFetch('/api/admin/invitations/deadline', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline: change.deadline, time_zone: settings.time_zone, expected_version: settings.version }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not save the deadline.');
      setSettings(body); setInput(deadlineToLocalInput(body.deadline, body.time_zone)); setChange(null); setError(''); onSaved();
      showToast(body.expired_count ? `Deadline saved. ${body.expired_count} unanswered invitations declined.` : 'Invitation deadline saved.', 'success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the deadline.'); setChange(null); }
    finally { setSaving(false); }
  };
  return <div className="mb-4 border-b border-red6/15 pb-4">
    {settings ? <>
      <p className="text-sm mb-2">Accept by: <strong>{settings.deadline ? formatRegistrationDeadline(settings.deadline, settings.time_zone) : 'No deadline set'}</strong></p>
      <div className="flex flex-wrap items-center gap-2"><input aria-label="Invitation deadline" type="datetime-local" className="admin-input" value={input} disabled={saving} onChange={event => setInput(event.target.value)} />
        <span className="admin-meta">{settings.time_zone === 'America/New_York' ? 'Eastern time' : settings.time_zone}</span>
        <button className="admin-button" disabled={saving || !input} onClick={() => review()}>Save deadline</button>
        {settings.deadline && <button className="admin-text-button" disabled={saving} onClick={() => review(true)}>Remove deadline</button>}
      </div>
      <p className="admin-meta mt-2">Applies to all invitations. Unanswered invitations are declined after the deadline.</p>
    </> : !error && <p className="admin-meta">Loading deadline…</p>}
    {error && <p role="alert" className="text-sm text-red6">{error} <button className="admin-text-button" onClick={() => setReload(reload + 1)}>Reload</button></p>}
    <ConfirmationDialog open={!!change} title={change?.deadline ? 'Set the invitation deadline?' : 'Remove the invitation deadline?'} busy={saving} confirmLabel="Save deadline" onConfirm={() => void save()} onClose={() => setChange(null)}>
      <p>{change?.deadline && settings ? `All unanswered invitations must be accepted by ${formatRegistrationDeadline(change.deadline, settings.time_zone)}.` : 'New and open invitations will have no deadline.'}</p>
      <p className="mt-3">Accepted invitations stay accepted. Invitations that already expired will stay declined.</p>
      {change?.deadline && Date.parse(change.deadline) <= Date.now() && <p className="mt-3 font-semibold text-red6">This deadline is in the past. All unanswered invitations will be declined now.</p>}
      <p className="mt-3">Unsent approval emails with the old deadline will be cancelled. Prepare new emails after saving.</p>
    </ConfirmationDialog>
  </div>;
}
