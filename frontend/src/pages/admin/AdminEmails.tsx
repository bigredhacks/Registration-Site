import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import { useToast } from '@/components/Toast/ToastContext';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import AdminEmailEditor from './AdminEmailEditor';
import AdminDecisionEmails from './AdminDecisionEmails';

interface Job { id: string; kind: string; recipient: string; state: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null; resend_id: string | null; can_retry: boolean }
const states = [{ value: 'queued', label: 'Queued' }, { value: 'sending', label: 'Sending' }, { value: 'sent', label: 'Sent' }, { value: 'failed', label: 'Failed' }, { value: 'needs_review', label: 'Needs review' }, { value: 'cancelled', label: 'Cancelled' }];
const kinds: Record<string, string> = { confirmation: 'Application received', approved: 'Approved', rejected: 'Not selected', test: 'Test' };
export default function AdminEmails() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'templates' | 'history'>('templates');
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [count, setCount] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current; setLoading(true);
    try {
      const response = await apiFetch(`/api/admin/emails/jobs?${new URLSearchParams({ state, q: search, offset: String(page * 50) })}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load emails.');
      if (id === request.current) { setJobs(body.data); setCount(body.count); setEnabled(body.enabled); setError(''); }
    } catch (cause) { if (id === request.current) setError(cause instanceof Error ? cause.message : 'Could not load emails.'); }
    finally { if (id === request.current) setLoading(false); }
  }, [state, search, page]);
  const invalidateRequest = useCallback(() => { request.current += 1; }, []);
  useEffect(() => {
    invalidateRequest();
    const timer = setTimeout(() => void load(), 250);
    return () => { clearTimeout(timer); invalidateRequest(); };
  }, [load, invalidateRequest]);
  const retryJob = async () => {
    if (!retry || saving) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/admin/emails/jobs/${retry.id}/retry`, { method: 'POST' });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Retry failed.');
      showToast(body.message, 'success'); setRetry(null); await load();
    } catch (cause) { showToast(cause instanceof Error ? cause.message : 'Retry failed.', 'error'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-6">
    <div className="admin-toolbar"><div className="flex gap-2" role="group" aria-label="Email views">
      <button className={`admin-button ${tab === 'templates' ? 'admin-button-primary' : ''}`} onClick={() => setTab('templates')}>Templates</button>
      <button className={`admin-button ${tab === 'history' ? 'admin-button-primary' : ''}`} onClick={() => setTab('history')}>History</button>
    </div><div className="flex flex-wrap gap-2"><AdminDecisionEmails cohortKind="approved" /><AdminDecisionEmails cohortKind="rejected" /></div></div>
    {!loading && !error && !enabled && <p className="admin-meta">Email delivery is paused.</p>}
    <div hidden={tab !== 'templates'}><AdminEmailEditor /></div>
    <div hidden={tab !== 'history'} className="space-y-4">
    <div className="admin-toolbar"><p className="admin-meta">Delivery details are available in Resend.</p><button className="admin-button" disabled={loading} onClick={() => void load()}>Refresh</button></div>
    <div className="admin-toolbar"><input className="admin-input flex-1" type="search" aria-label="Search email recipients" placeholder="Search recipient email" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /><AdminSelect aria-label="Email status" className="admin-input" value={state} placeholder="All statuses" options={states} onChange={value => { setState(value); setPage(0); }} /></div>
    {error ? <p role="alert" className="text-red6">{error}</p> : loading ? <p role="status" className="admin-meta">Loading email history…</p> : <>
      {!jobs.length ? <p className="admin-meta py-8 text-center">No emails match these filters.</p> : <div className="admin-email-jobs">{jobs.map(job => <article key={job.id} className="admin-email-job">
        <div className="min-w-0"><p className="font-semibold break-all">{job.recipient}</p><p className="admin-meta">{kinds[job.kind] || job.kind} · {new Date(job.created_at).toLocaleString()}</p>{job.last_error && <p className="admin-meta mt-2">{job.last_error}</p>}</div>
        <div className="flex flex-wrap items-center gap-3"><span className={`admin-email-state admin-email-state-${job.state}`}>{states.find(state => state.value === job.state)?.label || job.state}</span><span className="admin-meta">{job.attempts} attempts</span>{job.resend_id && <a className="admin-text-button" target="_blank" rel="noreferrer" href={`https://resend.com/emails/${encodeURIComponent(job.resend_id)}`}>View in Resend ↗</a>}{job.can_retry && <button className="admin-button" disabled={!enabled} onClick={() => setRetry(job)}>Retry…</button>}</div>
      </article>)}</div>}
      <div className="admin-toolbar"><span className="admin-meta">{count} {count === 1 ? 'email' : 'emails'} · Page {page + 1} of {Math.max(1, Math.ceil(count / 50))}</span><div className="flex gap-2"><button className="admin-button" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><button className="admin-button" disabled={(page + 1) * 50 >= count} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </>}
    </div>
    <ConfirmationDialog open={!!retry} title="Retry this email?" busy={saving} confirmLabel="Queue retry" onClose={() => setRetry(null)} onConfirm={() => void retryJob()}><p>Retry the saved email to {retry?.recipient}. The original message and duplicate-prevention key will be reused.</p></ConfirmationDialog>
  </div>;
}
