import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import { acceptanceStatuses, invitationStatuses, announcementAudienceLabel, type AnnouncementAudience } from '../../../../backend/src/utils/announcementAudience';
import AdminEmailEditor from './AdminEmailEditor';
import AdminTaskDialog from './AdminTaskDialog';
import EmailPreview from './EmailPreview';

interface Message { subject: string; html: string; to: string }
interface Draft {
  id: string; audience: AnnouncementAudience; enabled: boolean; preview: Message;
  recipients: { id: number; recipient: string; name: string }[];
  skipped: { id: number; reason: string }[];
}

export default function AdminAnnouncements({ onQueued }: { onQueued: () => void }) {
  const { showToast } = useToast();
  const [version, setVersion] = useState<number | null>(null);
  const [audience, setAudience] = useState<AnnouncementAudience>({ type: 'all' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [preview, setPreview] = useState<Message | null>(null);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    if (!draft || !recipientId) return;
    let current = true; setPreview(null); setPreviewError('');
    apiFetch(`/api/admin/emails/drafts/${draft.id}/preview?registration_id=${recipientId}`).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not load the preview.');
      if (current) setPreview(body);
    }).catch(cause => { if (current) setPreviewError(cause instanceof Error ? cause.message : 'Could not load the preview.'); });
    return () => { current = false; };
  }, [draft, recipientId]);

  const review = async () => {
    if (locked.current || version === null) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/admin/emails/announcements/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audience, expected_version: version }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not prepare the announcement.');
      setDraft(body); setRecipientId(String(body.recipients[0].id)); setPreview(body.preview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not prepare the announcement.'); }
    finally { locked.current = false; setBusy(false); }
  };
  const send = async () => {
    if (locked.current || !draft) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const response = await apiFetch(`/api/admin/emails/announcements/drafts/${draft.id}/send`, { method: 'POST' });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not confirm queueing. Retry this preview to avoid duplicates.');
      showToast(`${body.queued} announcement ${body.queued === 1 ? 'email' : 'emails'} queued. Check History for delivery status.`, 'success');
      setDraft(null); onQueued();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm queueing. Retry this preview to avoid duplicates.'); }
    finally { locked.current = false; setBusy(false); }
  };

  return <div className="space-y-6">
    <AdminEmailEditor fixedKind="announcement" onReady={setVersion} />
    <fieldset disabled={busy} className="space-y-3 border-t border-red6/15 pt-5">
      <legend className="sr-only">Announcement recipients</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Send to<AdminSelect aria-label="Announcement audience" className="admin-input mt-1" value={audience.type} onChange={value => {
          setError(''); setAudience(value === 'acceptance' ? { type: 'acceptance', status: 'approved' } : value === 'invitation' ? { type: 'invitation', status: 'unanswered' } : { type: 'all' });
        }} options={[{ value: 'all', label: 'All applicants' }, { value: 'acceptance', label: 'Acceptance status' }, { value: 'invitation', label: 'Invitation status' }]} /></label>
        {audience.type !== 'all' && <label className="text-sm">Status<AdminSelect aria-label="Announcement status" className="admin-input mt-1" value={audience.status}
          options={[...(audience.type === 'acceptance' ? acceptanceStatuses : invitationStatuses)]}
          onChange={status => { setError(''); setAudience({ ...audience, status } as AnnouncementAudience); }} /></label>}
        <button className="admin-button admin-button-primary" disabled={busy || version === null} onClick={() => void review()}>{busy && !draft ? 'Preparing…' : 'Review recipients'}</button>
      </div>
      <p className="admin-meta">{audience.type === 'acceptance' ? 'Uses the current admin decision, including decisions not yet released.' : audience.type === 'invitation' ? 'Uses responses to released invitations. Expired invitations are a separate group.' : 'Includes all main application submissions.'} Save any email edits before reviewing recipients.</p>
    </fieldset>
    {error && !draft && <p role="alert" className="text-sm text-red6">{error}</p>}
    {draft && <AdminTaskDialog title="Review announcement" busy={busy} onClose={() => { setDraft(null); setError(''); }}>
      <div className="space-y-4">
        <p className="text-sm"><strong>{draft.recipients.length} {draft.recipients.length === 1 ? 'recipient' : 'recipients'}</strong> · {announcementAudienceLabel(draft.audience)}</p>
        {draft.skipped.length > 0 && <details className="admin-meta"><summary className="cursor-pointer">{draft.skipped.length} skipped: invalid or duplicate email addresses</summary><ul className="mt-2 max-h-36 overflow-y-auto">{draft.skipped.map(row => <li key={row.id}>Applicant #{row.id}: {row.reason}</li>)}</ul></details>}
        <label className="block text-sm">Recipient preview<AdminSelect fullWidth aria-label="Announcement recipient preview" className="admin-input mt-1" disabled={busy} value={recipientId} onChange={value => { setPreview(null); setRecipientId(value); }}
          options={draft.recipients.map(row => ({ value: String(row.id), label: `${row.name || 'Applicant'} · ${row.recipient}` }))} /></label>
        {preview ? <EmailPreview {...preview} /> : <p className="admin-meta">{previewError || 'Loading preview…'}</p>}
        {!draft.enabled && <p className="admin-meta">Email delivery is paused.</p>}
        {error && <p role="alert" className="text-sm text-red6">{error}</p>}
        <div className="flex justify-end"><button className="admin-button admin-button-primary" disabled={busy || !draft.enabled || !preview} onClick={() => void send()}>{busy ? 'Queueing…' : `Send to ${draft.recipients.length} ${draft.recipients.length === 1 ? 'applicant' : 'applicants'}`}</button></div>
      </div>
    </AdminTaskDialog>}
  </div>;
}
