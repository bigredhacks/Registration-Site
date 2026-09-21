import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import { renderEmailTemplate, type EmailTemplate, type EmailKind } from '../../../../backend/src/utils/emailTemplates';
import EmailPreview from './EmailPreview';

interface Settings { template: EmailTemplate; deadline: string | null; time_zone: string; site_url: string; sample_deadline: boolean }
export default function AdminEmailEditor({ fixedKind, onReady }: { fixedKind?: EmailKind; onReady?: (version: number | null) => void }) {
  const { showToast } = useToast();
  const [selectedKind, setKind] = useState<EmailKind>('approved');
  const kind = fixedKind ?? selectedKind;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true; setSettings(null); setDraft(null); setError(''); setEditing(false);
    apiFetch(`/api/admin/emails/templates/${kind}`).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not load the email.');
      if (current) { setSettings(body); setDraft(body.template); }
    }).catch(cause => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [kind, reload]);
  const dirty = !!draft && !!settings && (draft.subject !== settings.template.subject || draft.body !== settings.template.body || draft.button_label !== settings.template.button_label || draft.html !== settings.template.html);
  useEffect(() => { onReady?.(settings && !editing && !dirty && !saving && !error ? settings.template.version : null); }, [settings, editing, dirty, saving, error, onReady]);
  const preview = draft && settings ? renderEmailTemplate(kind, 'Alex', undefined, settings.site_url, draft, settings.deadline, settings.time_zone) : null;
  const save = async () => {
    if (!draft || !settings || saving) return;
    setSaving(true); setError('');
    try {
      const response = await apiFetch(`/api/admin/emails/templates/${kind}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: draft.subject, body: draft.body, button_label: draft.button_label, html: draft.html, expected_version: settings.template.version }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not save the email.');
      setSettings({ ...settings, template: body.template }); setDraft(body.template); setEditing(false); showToast('Email saved.', 'success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the email.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4">
    <div className="admin-toolbar">{fixedKind ? <h2 className="font-semibold">General announcement</h2> : <AdminSelect aria-label="Email template" className="admin-input" value={kind} disabled={dirty || saving} onChange={value => setKind(value as EmailKind)}
      options={[{ value: 'confirmation', label: 'Application received' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Denied' }, { value: 'waitlisted', label: 'Waitlisted' }]} />}
      {draft && !editing && <button className="admin-button" onClick={() => setEditing(true)}>Edit email</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red6">{error} <button className="admin-text-button" disabled={saving} onClick={() => setReload(reload + 1)}>Reload</button></p>}
    {!draft || !settings ? <p className="admin-meta">{error ? '' : 'Loading email…'}</p> : <>
      <div className={editing ? 'admin-email-edit-layout' : 'admin-email-simple-preview'}>
        {editing && <form className="flex min-w-0 flex-col gap-4" onSubmit={event => { event.preventDefault(); void save(); }}>
          <label className="text-sm">Subject<input className="admin-input mt-1 w-full" value={draft.subject} maxLength={200} required disabled={saving} onChange={event => setDraft({ ...draft, subject: event.target.value })} /></label>
          <label className="text-sm">Message<textarea className="admin-input mt-1 min-h-60 w-full resize-y leading-relaxed" value={draft.body} maxLength={10000} required disabled={saving} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label>
          <p className="admin-meta">The greeting adds each applicant’s first name.{kind === 'approved' ? ' The deadline and dashboard link are added automatically.' : ''}</p>
          {kind !== 'rejected' && kind !== 'announcement' && <label className="text-sm">Button text<input className="admin-input mt-1 w-full" value={draft.button_label} maxLength={80} required disabled={saving} onChange={event => setDraft({ ...draft, button_label: event.target.value })} /></label>}
          <details><summary className="admin-text-button cursor-pointer">HTML template</summary>
            <label className="text-sm">HTML and inline CSS<textarea aria-label="HTML template" className="admin-input mt-2 min-h-80 w-full resize-y font-mono text-xs" value={draft.html ?? ''} maxLength={50000} required disabled={saving} onChange={event => setDraft({ ...draft, html: event.target.value })} /></label>
            <p className="admin-meta">Saved as template.html in Supabase Storage. Use {'{{message_html}}'} for the message and {'{{first_name}}'} for the applicant’s name.{kind === 'approved' ? ' Keep {{deadline_sentence}} and {{dashboard_url}} in the template.' : ''}</p>
          </details>
          <div className="flex gap-2"><button className="admin-button admin-button-primary" disabled={saving || (!dirty && settings.template.version > 0) || !draft.subject.trim() || !draft.body.trim()}>{saving ? 'Saving…' : settings.template.version === 0 ? 'Save to Storage' : 'Save email'}</button>
            <button className="admin-button" type="button" disabled={saving} onClick={() => { setDraft(settings.template); setEditing(false); setError(''); }}>Cancel</button></div>
          <p className="admin-meta">Changes apply to new emails. Emails already prepared keep their reviewed text.</p>
        </form>}
        {preview && <EmailPreview {...preview} />}
      </div>
      {kind === 'approved' && settings.sample_deadline && <p className="admin-meta">Sample deadline: midnight Sunday, 9/20. Set the actual deadline in Invitations before sending.</p>}
    </>}
  </div>;
}
