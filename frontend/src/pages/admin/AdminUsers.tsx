import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastContext';
import { useAdminSelection } from './AdminSelectionContext';
import { studentName, decisionOptions, type AdminStudent } from './adminApprovalState';
import AdminApprovalFilters, { type ApprovalAnswerFilter, type ApprovalFilterField } from './AdminApprovalFilters';
import AdminSelect from '@/components/AdminSelect';
import AdminInvitationStatus from './AdminInvitationStatus';
import AdminInvitationDeadline from './AdminInvitationDeadline';
import AdminInvitationResponse from './AdminInvitationResponse';
import AdminTaskDialog from './AdminTaskDialog';
import AdminSelectionPanel from './AdminSelectionPanel';
import AdminSelectionActions from './AdminSelectionActions';

interface Registration extends AdminStudent {
  created_at: string;
  school?: string | null;
  level_of_study?: string | null;
  shirt_size?: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
  /** Legacy Supabase Storage path (`<user_id>/<filename>`) from the pre-Box uploader. */
  resume_path?: string | null;
  answers?: Record<string, unknown>;
}
const PAGE_SIZES = [25, 50, 100, 200];
const PAGE_SIZE_KEY = 'brh.admin.pageSize';
type View = 'all' | 'ready' | 'invitations';
type Dir = 'asc' | 'desc';
type Sort = { column: string; dir: Dir };
// `column` mirrors the server's whitelist in backend/src/utils/adminApprovals.ts.
// `defaultDir` is the direction a column opens on, so dates start newest-first
// rather than at the oldest applicant.
const SORT_COLUMNS: { column: string; label: string; defaultDir: Dir }[] = [
  { column: 'name', label: 'Student', defaultDir: 'asc' },
  { column: 'school', label: 'School', defaultDir: 'asc' },
  { column: 'status', label: 'Status', defaultDir: 'asc' },
  { column: 'created_at', label: 'Submitted', defaultDir: 'desc' },
];
function formatAnswer(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(formatAnswer).join(', ') || '—';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, inner]) => `${key}: ${formatAnswer(inner)}`).join(' | ');
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
}

export default function AdminUsers() {
  const { selected, add, replace, remove, toggle, sync, revision, formKey, busy } = useAdminSelection();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('all');
  const [matchingIds, setMatchingIds] = useState<number[]>([]);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<null | { status: string; releasedStatus: string; releaseState: string; invitationResponse: string; checkedIn: string; from: string; to: string }>(null);
  const [status, setStatus] = useState('');
  const [releasedStatus, setReleasedStatus] = useState('');
  const [releaseState, setReleaseState] = useState('');
  const [invitationResponse, setInvitationResponse] = useState('');
  const [invitationCounts, setInvitationCounts] = useState({ accepted: 0, declined: 0, unanswered: 0, expired: 0 });
  const [checkedIn, setCheckedIn] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const invalidDates = Boolean(from && to && from > to);
  const [answerFilters, setAnswerFilters] = useState<ApprovalAnswerFilter[]>([]);
  const [draftAnswerFilters, setDraftAnswerFilters] = useState<ApprovalAnswerFilter[]>([]);
  const validDraft = draftAnswerFilters.every(filter => ['empty', 'not_empty'].includes(filter.operator) || (filter.values?.length && filter.values.every(value => value.trim()) && (!['gt', 'gte', 'lt', 'lte'].includes(filter.operator) || Number.isFinite(Number(filter.values[0])))));
  const switchView = (next: View) => { setView(next); setStatus(''); setReleasedStatus(''); setReleaseState(''); setInvitationResponse(''); setPage(0); };
  const [filterFields, setFilterFields] = useState<ApprovalFilterField[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    const stored = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(stored) ? stored : 50;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selectionLimit, setSelectionLimit] = useState('');
  const limit = selectionLimit.trim() ? Number(selectionLimit) : undefined;
  const invalidLimit = limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1);
  const selectionCount = limit === undefined || invalidLimit ? count : Math.min(limit, count);
  const sortLabel = sort ? `${SORT_COLUMNS.find(entry => entry.column === sort.column)?.label} ${sort.dir === 'asc' ? 'ascending' : 'descending'}` : 'ID descending';
  const [detail, setDetail] = useState<Registration | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const detailRequest = useRef(0);
  const cohortRequest = useRef(0);
  const detailPanel = useRef<HTMLDivElement>(null);
  const selectPage = useRef<HTMLInputElement>(null);

  const filters = useCallback(() => new URLSearchParams({ form_key: formKey, view: formKey === 'registration' ? view : 'all', q: query, status,
    released_status: formKey === 'registration' ? releasedStatus : '', release_state: formKey === 'registration' ? releaseState : '', invitation_response: formKey === 'registration' ? invitationResponse : '',
    checked_in: checkedIn, answers: JSON.stringify(answerFilters), sort: sort?.column ?? '', dir: sort?.dir ?? '', from, to }), [formKey, view, query, status, releasedStatus, releaseState, invitationResponse, checkedIn, answerFilters, sort, from, to]);
  useEffect(() => {
    if (invalidDates) { setRows([]); setCount(0); setError(''); setLoading(false); return; }
    let current = true;
    cohortRequest.current++;
    setSelecting(false);
    setLoading(true);
    setError('');
    const params = filters();
    params.set('limit', String(pageSize)); params.set('offset', String(page * pageSize));
    apiFetch(`/api/admin/approval/students?${params}`).then(async res => {
      const body = await res.json();
      if (!current) return;
      if (!res.ok) {
        setRows([]); setCount(0);
        setError(typeof body.error === 'string' ? body.error : 'Could not load students.');
        return;
      }
      setMatchingIds(body.matchingIds ?? []);
      setFilterFields(body.fields ?? []);
      setInvitationCounts(body.invitationCounts ?? { accepted: 0, declined: 0, unanswered: 0, expired: 0 });
      setRows(body.data ?? []); setCount(body.count ?? 0); sync(body.data ?? []);
      setPage(value => Math.min(value, Math.max(0, Math.ceil((body.count ?? 0) / pageSize) - 1)));
    }).catch(() => { if (current) { setRows([]); setError('Could not load students.'); } })
      .finally(() => { if (current) setLoading(false); });
    const requests = cohortRequest;
    return () => { current = false; requests.current++; };
  }, [filters, page, pageSize, revision, refreshKey, sync, invalidDates]);

  useEffect(() => {
    if (selectPage.current) selectPage.current.indeterminate = rows.some(row => selected.has(row.id)) && !rows.every(row => selected.has(row.id));
  }, [rows, selected]);

  // Re-clicking the active column flips it; a new column opens on its own default.
  const toggleSort = (column: string, defaultDir: Dir) => {
    setPage(0);
    setSort(current => current?.column === column ? { column, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { column, dir: defaultDir });
  };
  const closeDetail = () => {
    detailRequest.current++;
    const previous = detailId;
    setDetailId(null); setDetail(null); setDetailLoading(false);
    requestAnimationFrame(() => document.getElementById(`review-${previous}`)?.focus());
  };
  const loadDetail = async (id: number) => {
    const current = ++detailRequest.current;
    setDetailId(id); setDetail(null); setDetailLoading(true);
    requestAnimationFrame(() => detailPanel.current?.focus());
    try {
      const res = await apiFetch(`/api/admin/registrations/${id}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (current === detailRequest.current) setDetail(body);
    } catch {
      if (current === detailRequest.current) { showToast('Could not load application.', 'error'); setDetailId(null); }
    } finally { if (current === detailRequest.current) setDetailLoading(false); }
  };
  useEffect(() => {
    if (detailId !== null) void loadDetail(detailId);
    // A successful bulk decision refreshes an open application.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);
  useEffect(() => () => { detailRequest.current++; }, []);

  const selectFiltered = async (all = false) => {
    if (!all && invalidLimit) return;
    const current = ++cohortRequest.current;
    setSelecting(true);
    try {
      const params = filters();
      if (!all && limit !== undefined) params.set('selection_limit', String(limit));
      const res = await apiFetch(`/api/admin/approval/selection?${params}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (current === cohortRequest.current) { replace(body.data ?? []); setSelectionOpen(false); }
    } catch { if (current === cohortRequest.current) showToast('Could not select filtered students.', 'error'); }
    finally { if (current === cohortRequest.current) setSelecting(false); }
  };
  const exportCsv = async () => {
    try {
      const res = await apiFetch(`/api/admin/approval/export.csv?${filters()}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'registrations.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch { showToast('Export failed.', 'error'); }
  };
  // Pre-Box registrations still carry a Supabase Storage path; the bucket is private,
  // so the file is reached through a short-lived signed URL rather than a direct link.
  const openResume = async (id: number) => {
    try {
      const res = await apiFetch(`/api/admin/registrations/${id}/resume-download-url`);
      if (!res.ok) throw new Error();
      const { signedUrl } = await res.json();
      if (!signedUrl) throw new Error();
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch { showToast('Could not open the resume.', 'error'); }
  };
  const checkIn = async () => {
    if (!detail) return;
    setCheckingIn(true);
    try {
      const res = await apiFetch(`/api/admin/registrations/${detail.id}/check-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checked_in: !detail.checked_in }) });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setDetail(previous => previous?.id === body.id ? { ...previous, ...body } : previous);
      setRefreshKey(value => value + 1);
    } catch { showToast('Could not update check-in.', 'error'); }
    finally { setCheckingIn(false); }
  };

  return <fieldset disabled={busy} className="admin-students-view">
    {formKey === 'registration' && <div className="admin-task-views" role="group" aria-label="Applicant views">
      {([['all', 'All applicants'], ['ready', 'Ready to release'], ['invitations', 'Invitations']] as const).map(([value, label]) => <button key={value} className={`admin-button ${view === value ? 'admin-button-primary' : ''}`} aria-pressed={view === value} onClick={() => switchView(value)}>{label}</button>)}
    </div>}
    {formKey === 'registration' && view === 'invitations' && <AdminInvitationDeadline onSaved={() => setRefreshKey(value => value + 1)} />}
    {formKey === 'registration' && view === 'invitations' && <p className="admin-meta mb-4" aria-label="Released invitation totals">{loading || error ? 'Loading…' : `${invitationCounts.accepted} accepted · ${invitationCounts.declined} declined · ${invitationCounts.unanswered} awaiting response · ${invitationCounts.expired ?? 0} expired`}</p>}
    <div className="admin-toolbar admin-applicant-toolbar">
      <form className="admin-search" onSubmit={event => { event.preventDefault(); setPage(0); setQuery(search.trim()); }}>
        <input className="admin-input" aria-label="Search applicants" placeholder="Search applicants…" value={search} onChange={event => setSearch(event.target.value)} />
        <button className="admin-button" type="submit">Search</button>
      </form>
      <label className="admin-meta admin-primary-filter">{view === 'invitations' ? 'Response' : view === 'ready' ? 'Decision to release' : 'Application status'}
        <AdminSelect aria-label={view === 'invitations' ? 'Response' : view === 'ready' ? 'Decision to release' : 'Application status'} fullWidth className="admin-input" value={view === 'invitations' ? invitationResponse : status} placeholder="Any"
          options={view === 'invitations' ? [{ value: 'accepted', label: 'Accepted' }, { value: 'declined', label: 'Declined' }, { value: 'unanswered', label: 'Awaiting response' }, { value: 'expired', label: 'Expired' }] : decisionOptions.filter(option => view !== 'ready' || option.value !== 'pending')}
          onChange={value => { if (view === 'invitations') setInvitationResponse(value); else setStatus(value); setPage(0); }} />
      </label>
      <button className="admin-button" onClick={() => { setDraftAnswerFilters(answerFilters); setFilterDraft({ status, releasedStatus, releaseState, invitationResponse, checkedIn, from, to }); }}>More filters</button>
    </div>
    <div className="admin-filter-chips my-3" aria-label="Active filters">
      {[
        { label: query && `Search: ${query}`, clear: () => { setQuery(''); setSearch(''); } },
        { label: status && `Saved: ${decisionOptions.find(option => option.value === status)?.label}`, clear: () => setStatus('') },
        { label: releasedStatus && `Visible: ${decisionOptions.find(option => option.value === releasedStatus)?.label}`, clear: () => setReleasedStatus('') },
        { label: releaseState && `Release: ${releaseState}`, clear: () => setReleaseState('') },
        { label: invitationResponse && `Response: ${invitationResponse === 'unanswered' ? 'Awaiting response' : invitationResponse}`, clear: () => setInvitationResponse('') },
        { label: checkedIn && (checkedIn === 'true' ? 'Checked in' : 'Not checked in'), clear: () => setCheckedIn('') },
        { label: from && `From: ${from}`, clear: () => setFrom('') }, { label: to && `Through: ${to}`, clear: () => setTo('') },
      ].filter(chip => chip.label).map(chip => <button key={chip.label} className="admin-button" onClick={() => { chip.clear(); setPage(0); }}>{chip.label} ×</button>)}
      {answerFilters.map((filter, index) => <button key={index} className="admin-button" onClick={() => { setAnswerFilters(answerFilters.filter((_, i) => i !== index)); setPage(0); }}>{filterFields.find(field => field.field === filter.field && field.row === filter.row)?.label ?? filter.field}: {filter.operator.replace(/_/g, ' ')} {filter.values?.join(', ')} ×</button>)}
      {(query || status || releasedStatus || releaseState || invitationResponse || checkedIn || from || to || answerFilters.length > 0) && <button className="admin-text-button" onClick={() => { setQuery(''); setSearch(''); setStatus(''); setReleasedStatus(''); setReleaseState(''); setInvitationResponse(''); setCheckedIn(''); setFrom(''); setTo(''); setAnswerFilters([]); setPage(0); }}>Clear filters</button>}
    </div>
    {filterDraft && <AdminTaskDialog title="More filters" onClose={() => setFilterDraft(null)}>
      <h3 className="mb-3 font-semibold">Application details</h3>
      <label className="admin-meta admin-primary-filter">Attendance<AdminSelect fullWidth aria-label="Attendance" className="admin-input" value={filterDraft.checkedIn} placeholder="Any" options={[{ value: 'true', label: 'Checked in' }, { value: 'false', label: 'Not checked in' }]} onChange={value => setFilterDraft({ ...filterDraft, checkedIn: value })} /></label>
      <div className="admin-date-range my-3"><span>Submitted (UTC)</span>
        <input type="date" className="admin-input" aria-label="Submitted from (UTC)" value={filterDraft.from} onChange={event => setFilterDraft({ ...filterDraft, from: event.target.value })} />
        <span>to</span><input type="date" className="admin-input" aria-label="Submitted through (UTC)" value={filterDraft.to} onChange={event => setFilterDraft({ ...filterDraft, to: event.target.value })} />
      </div>
      {filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to && <p role="alert">Start date must be on or before end date.</p>}
      <AdminApprovalFilters embedded fields={filterFields} applied={answerFilters} draft={draftAnswerFilters} onChange={setDraftAnswerFilters} onApply={() => {}} disabled={loading} />
      {formKey === 'registration' && <><h3 className="my-3 font-semibold">Decision details</h3><div className="grid gap-3">
        <label>Application status<AdminSelect aria-label="Application status" fullWidth className="admin-input" value={filterDraft.status} placeholder="Any" options={decisionOptions.filter(option => view !== 'ready' || option.value !== 'pending')} onChange={value => setFilterDraft({ ...filterDraft, status: value })} /></label>
        {view !== 'invitations' && <label>Applicant sees<AdminSelect aria-label="Applicant sees" fullWidth className="admin-input" value={filterDraft.releasedStatus} placeholder="Any applicant-visible decision" options={decisionOptions.filter(option => option.value !== 'pending')} onChange={value => setFilterDraft({ ...filterDraft, releasedStatus: value })} /></label>}
        <label>Decision release<AdminSelect aria-label="Decision release" fullWidth className="admin-input" value={filterDraft.releaseState} placeholder="Any release state" options={[...(view === 'invitations' ? [] : [{ value: 'unreleased', label: 'No decision released yet' }]), { value: 'changed', label: 'Saved decision differs from released decision' }, ...(view === 'ready' ? [] : [{ value: 'current', label: 'Saved decision matches released decision' }])]} onChange={value => setFilterDraft({ ...filterDraft, releaseState: value })} /></label>
        {view !== 'invitations' && <label>Invitation response<AdminSelect aria-label="Invitation response" fullWidth className="admin-input" value={filterDraft.invitationResponse} placeholder="Any response or no invitation" options={[{ value: 'accepted', label: 'Accepted' }, { value: 'declined', label: 'Declined' }, { value: 'unanswered', label: 'Awaiting response' }, { value: 'expired', label: 'Expired' }]} onChange={value => setFilterDraft({ ...filterDraft, invitationResponse: value })} /><span className="admin-meta">Accepted and declined include previous responses.</span></label>}
      </div></>}
      <div className="admin-toolbar mt-4"><button className="admin-button" onClick={() => setFilterDraft(null)}>Cancel</button><button className="admin-button admin-button-primary" disabled={!validDraft || Boolean(filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to)} onClick={() => {
        setStatus(filterDraft.status); setReleasedStatus(filterDraft.releasedStatus); setReleaseState(filterDraft.releaseState); setInvitationResponse(filterDraft.invitationResponse); setCheckedIn(filterDraft.checkedIn); setFrom(filterDraft.from); setTo(filterDraft.to); setAnswerFilters(draftAnswerFilters); setPage(0); setFilterDraft(null);
      }}>Apply filters</button></div>
    </AdminTaskDialog>}
    <div className="admin-toolbar my-3"><span className="admin-meta">{loading ? 'Loading…' : `${count} applicants`}</span><div className="flex gap-2">
      <button className="admin-button" disabled={loading || selecting || invalidDates || !!error || !count} onClick={() => void selectFiltered(true)}>{selecting ? 'Selecting…' : `Select all ${count}`}</button>
      <button className="admin-button" onClick={() => setSelectionOpen(true)}>Select by list or limit</button>
      <button className="admin-button" disabled={loading || !!error} onClick={() => void exportCsv()}>Export CSV</button>
    </div></div>
    {selectionOpen && <AdminTaskDialog title="Select applicants" onClose={() => { cohortRequest.current++; setSelecting(false); setSelectionOpen(false); }}>
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="admin-meta flex items-center gap-2" htmlFor="admin-selection-limit">Selection limit
          <input id="admin-selection-limit" className="admin-input w-28" type="text" inputMode="numeric" placeholder="No limit"
            aria-invalid={invalidLimit} aria-describedby={`admin-selection-help${invalidLimit ? ' admin-selection-limit-error' : ''}`} value={selectionLimit}
            onChange={event => { setSelectionLimit(event.target.value); cohortRequest.current++; setSelecting(false); }} />
        </label>
        <button className="admin-button" disabled={loading || selecting || invalidDates || invalidLimit || !!error || !count}
          onClick={() => void selectFiltered()}>{selecting ? 'Selecting…' : limit === undefined ? `Select all ${count} filtered` : `Select first ${selectionCount} filtered`}</button>
      </div>
      <p id="admin-selection-help" className="admin-meta mt-2">Replaces your current selection using the table’s current order. Order: {sortLabel}. Blank selects all matches.</p>
      {invalidLimit && <p id="admin-selection-limit-error" role="alert" className="text-red6 mt-2">Enter a whole number from 1 to {Number.MAX_SAFE_INTEGER.toLocaleString()} or leave blank.</p>}
    </div>
      <AdminSelectionPanel mode="paste" />
    </AdminTaskDialog>}
    {error && <p role="alert" className="text-red6 mb-3">{error} <button className="admin-text-button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></p>}
    <AdminSelectionActions hideRelease={view === 'invitations'} outside={loading || error ? undefined : [...selected.keys()].filter(id => !matchingIds.includes(id)).length} onReady={() => switchView('ready')} />
    {detailId !== null ? <section ref={detailPanel} tabIndex={-1} className="admin-detail" aria-label="Application review">
      <div className="admin-toolbar mb-4"><button className="admin-text-button" onClick={closeDetail}>← Back to students</button>{detail && <button className="admin-button" onClick={() => toggle(detail)}>{selected.has(detail.id) ? 'Remove from selected' : 'Add to selected'}</button>}</div>
      {detailLoading && <p className="admin-meta">Loading application…</p>}
      {detail && <>
        <div className="admin-toolbar"><div><h2>{studentName(detail)}</h2><p className="admin-meta break-all">{detail.email}</p></div><span className={`admin-status admin-status-${detail.status}`}>{detail.status}</span></div>
        {formKey === 'registration' && <>
          <p className="admin-meta mt-3">Draft decision: <span className="font-medium">{detail.status}</span></p>
          <AdminInvitationStatus student={detail} showDates />
          <AdminInvitationResponse key={detail.id} student={detail} onSaved={student => {
            setDetail(previous => previous?.id === student.id ? { ...previous, ...student } : previous);
            sync([student]);
            setRefreshKey(value => value + 1);
            showToast('Invitation response updated. No email sent.', 'success');
          }} />
        </>}
        <div className="admin-toolbar my-4"><p className="admin-meta">{detail.checked_in ? `Checked in${detail.checked_in_at ? ` · ${new Date(detail.checked_in_at).toLocaleString()}` : ''}` : 'Not checked in'}</p>
          <div className="flex flex-wrap gap-2">
            {/* Only pre-Box registrations have a stored file; resumes now go to a shared
                Box folder that can't be resolved to one applicant. */}
            {detail.resume_path && <button className="admin-button" onClick={() => void openResume(detail.id)}>View resume</button>}
            <button className="admin-button" disabled={checkingIn} onClick={() => void checkIn()}>{detail.checked_in ? 'Undo check-in' : 'Check in'}</button>
          </div>
        </div>
        <dl className="admin-answer-list">{Object.entries(detail.answers ?? {}).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{formatAnswer(value)}</dd></div>)}</dl>
      </>}
    </section> : <>
      <div className="admin-toolbar mb-3"><label className="admin-meta">Per page <AdminSelect aria-label="Rows per page" className="admin-input" value={String(pageSize)} options={PAGE_SIZES.map(size => ({ value: String(size), label: String(size) }))} onChange={value => { localStorage.setItem(PAGE_SIZE_KEY, value); setPageSize(Number(value)); setPage(0); }} /></label><span className="admin-meta">Page {page + 1} of {Math.max(1, Math.ceil(count / pageSize))}</span><div className="flex gap-2"><button className="admin-button" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className="admin-button" disabled={(page + 1) * pageSize >= count || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
      <div className="admin-table-wrap"><table className="admin-record-table admin-approval-table">
        <thead><tr>
          <th><input ref={selectPage} type="checkbox" aria-label="Select this page" checked={rows.length > 0 && rows.every(row => selected.has(row.id))} disabled={loading || !rows.length} onChange={event => { if (event.target.checked) add(rows); else rows.forEach(row => remove(row.id)); }} /></th>
          {SORT_COLUMNS.map(({ column, label, defaultDir }) => {
            const active = sort?.column === column;
            return <th key={column} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" className="admin-sort-button" disabled={loading || invalidDates} onClick={() => toggleSort(column, defaultDir)}>
                {column === 'status' && formKey === 'registration' ? 'Saved decision' : label}<span aria-hidden="true" className={active ? '' : 'opacity-30'}>{active && sort.dir === 'desc' ? '↓' : '↑'}</span>
              </button>
            </th>;
          })}
          {formKey === 'registration' && <th>Applicant status</th>}
          <th>Actions</th>
        </tr></thead>
        <tbody>{loading ? <tr><td colSpan={formKey === 'registration' ? 7 : 6}>Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={formKey === 'registration' ? 7 : 6}>No students found.</td></tr> : rows.map(row => <tr key={row.id} className={selected.has(row.id) ? 'admin-row-selected' : ''}>
          <td data-label="Select"><input type="checkbox" aria-label={`Select ${studentName(row)}`} checked={selected.has(row.id)} onChange={() => toggle(row)} /></td>
          <td data-label="Student"><div><p>{studentName(row)}</p><p className="admin-meta break-all">{row.email}</p></div></td>
          <td data-label="School">{row.school || '—'}</td><td data-label={formKey === 'registration' ? 'Saved decision' : 'Status'}><span className={`admin-status admin-status-${row.status}`}>{decisionOptions.find(option => option.value === row.status)?.label ?? row.status}</span>
            {formKey === 'registration' && row.status !== (row.released_status ?? 'pending') && <p className="admin-meta mt-1">Not yet visible to applicant</p>}
          </td>
          <td data-label="Submitted">{row.created_at ? <time dateTime={row.created_at} title={`${new Date(row.created_at).toLocaleString(undefined, { timeZone: 'UTC' })} UTC`}>{new Date(row.created_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}</time> : '—'}</td>
          {formKey === 'registration' && <td data-label="Applicant status"><AdminInvitationStatus student={row} /></td>}
          <td data-label="Actions"><button className="admin-button" id={`review-${row.id}`} onClick={() => void loadDetail(row.id)}>Review</button></td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </fieldset>;
}
