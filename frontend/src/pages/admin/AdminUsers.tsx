import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastContext';
import { useAdminSelection } from './AdminSelectionContext';
import { studentName, type AdminStudent } from './adminApprovalState';
import AdminApprovalFilters, { type ApprovalAnswerFilter, type ApprovalFilterField } from './AdminApprovalFilters';
import AdminSelect from '@/components/AdminSelect';

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
const STATUSES = ['pending', 'approved', 'rejected', 'waitlisted'];
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
  const [status, setStatus] = useState('');
  const [checkedIn, setCheckedIn] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const invalidDates = Boolean(from && to && from > to);
  const [answerFilters, setAnswerFilters] = useState<ApprovalAnswerFilter[]>([]);
  const [draftAnswerFilters, setDraftAnswerFilters] = useState<ApprovalAnswerFilter[]>([]);
  const filtersChanged = JSON.stringify(draftAnswerFilters) !== JSON.stringify(answerFilters);
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

  const filters = useCallback(() => new URLSearchParams({ form_key: formKey, q: query, status, checked_in: checkedIn, answers: JSON.stringify(answerFilters), sort: sort?.column ?? '', dir: sort?.dir ?? '', from, to }), [formKey, query, status, checkedIn, answerFilters, sort, from, to]);
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
      setFilterFields(body.fields ?? []);
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

  const selectFiltered = async () => {
    if (invalidLimit) return;
    const current = ++cohortRequest.current;
    setSelecting(true);
    try {
      const params = filters();
      if (limit !== undefined) params.set('selection_limit', String(limit));
      const res = await apiFetch(`/api/admin/approval/selection?${params}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (current === cohortRequest.current) replace(body.data ?? []);
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
    <div className="admin-toolbar">
      <form className="admin-search" onSubmit={event => { event.preventDefault(); setPage(0); setQuery(search.trim()); setRefreshKey(value => value + 1); }}>
        <input className="admin-input" aria-label="Search students" disabled={invalidDates} placeholder="Name, email, school…" value={search} onChange={event => setSearch(event.target.value)} />
        <button className="admin-button" type="submit" disabled={invalidDates}>Search</button>
      </form>
      <AdminSelect aria-label="Filter by status" className="admin-input" disabled={invalidDates} value={status} placeholder="All statuses"
        options={STATUSES.map(value => ({ value, label: value }))} onChange={value => { setStatus(value); setPage(0); }} />
      <AdminSelect aria-label="Filter by attendance" className="admin-input" disabled={invalidDates} value={checkedIn} placeholder="All attendance"
        options={[{ value: 'true', label: 'Checked in' }, { value: 'false', label: 'Not checked in' }]} onChange={value => { setCheckedIn(value); setPage(0); }} />
      <div role="group" aria-label="Submitted date range (UTC)" className="admin-date-range"><span>Submitted</span>
        <input type="date" className="admin-input" aria-label="Submitted from (UTC)" aria-invalid={invalidDates} value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} />
        <span className="admin-meta">to</span>
        <input type="date" className="admin-input" aria-label="Submitted through (UTC)" aria-invalid={invalidDates} value={to} onChange={event => { setTo(event.target.value); setPage(0); }} />
        {(from || to) && <button type="button" className="admin-text-button" onClick={() => { setFrom(''); setTo(''); setPage(0); }}>Clear</button>}
      </div>
    </div>
    {invalidDates && <p role="alert" className="text-red6 mb-3">Start date must be on or before end date.</p>}
    <AdminApprovalFilters fields={filterFields} applied={answerFilters} draft={draftAnswerFilters} onChange={setDraftAnswerFilters} disabled={busy || loading || invalidDates} onApply={filters => { setAnswerFilters(filters); setPage(0); }} />
    <div className="admin-toolbar my-3"><div className="flex flex-wrap items-center gap-3"><span className="admin-meta">{loading ? 'Loading…' : `${count} students`}</span>
      <label className="admin-meta">Per page <AdminSelect aria-label="Rows per page" className="admin-input" value={String(pageSize)}
        options={PAGE_SIZES.map(size => ({ value: String(size), label: String(size) }))}
        onChange={value => { localStorage.setItem(PAGE_SIZE_KEY, value); setPageSize(Number(value)); setPage(0); }} /></label>
    </div><button className="admin-button" disabled={filtersChanged || loading || invalidDates || !!error} onClick={() => void exportCsv()}>Export CSV</button></div>
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="admin-meta flex items-center gap-2" htmlFor="admin-selection-limit">Selection limit
          <input id="admin-selection-limit" className="admin-input w-28" type="text" inputMode="numeric" placeholder="No limit"
            aria-invalid={invalidLimit} aria-describedby={`admin-selection-help${invalidLimit ? ' admin-selection-limit-error' : ''}`} value={selectionLimit}
            onChange={event => { setSelectionLimit(event.target.value); cohortRequest.current++; setSelecting(false); }} />
        </label>
        <button className="admin-button" disabled={filtersChanged || loading || selecting || invalidDates || invalidLimit || !!error || !count}
          onClick={() => void selectFiltered()}>{selecting ? 'Selecting…' : limit === undefined ? `Select all ${count} filtered` : `Select first ${selectionCount} filtered`}</button>
      </div>
      <p id="admin-selection-help" className="admin-meta mt-2">Replaces your current selection using the table’s current order. Order: {sortLabel}. Blank selects all matches.</p>
      {invalidLimit && <p id="admin-selection-limit-error" role="alert" className="text-red6 mt-2">Enter a whole number from 1 to {Number.MAX_SAFE_INTEGER.toLocaleString()} or leave blank.</p>}
    </div>
    {error && <p role="alert" className="text-red6 mb-3">{error} <button className="admin-text-button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></p>}
    {detailId !== null ? <section ref={detailPanel} tabIndex={-1} className="admin-detail" aria-label="Application review">
      <div className="admin-toolbar mb-4"><button className="admin-text-button" onClick={closeDetail}>← Back to students</button>{detail && <button className="admin-button" onClick={() => toggle(detail)}>{selected.has(detail.id) ? 'Remove from selected' : 'Add to selected'}</button>}</div>
      {detailLoading && <p className="admin-meta">Loading application…</p>}
      {detail && <>
        <div className="admin-toolbar"><div><h2>{studentName(detail)}</h2><p className="admin-meta break-all">{detail.email}</p></div><span className={`admin-status admin-status-${detail.status}`}>{detail.status}</span></div>
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
      <div className="admin-table-wrap"><table className="admin-record-table admin-approval-table">
        <thead><tr>
          <th><input ref={selectPage} type="checkbox" aria-label="Select this page" checked={rows.length > 0 && rows.every(row => selected.has(row.id))} disabled={filtersChanged || loading || !rows.length} onChange={event => { if (event.target.checked) add(rows); else rows.forEach(row => remove(row.id)); }} /></th>
          {SORT_COLUMNS.map(({ column, label, defaultDir }) => {
            const active = sort?.column === column;
            return <th key={column} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" className="admin-sort-button" disabled={loading || invalidDates} onClick={() => toggleSort(column, defaultDir)}>
                {label}<span aria-hidden="true" className={active ? '' : 'opacity-30'}>{active && sort.dir === 'desc' ? '↓' : '↑'}</span>
              </button>
            </th>;
          })}
          <th>Actions</th>
        </tr></thead>
        <tbody>{loading ? <tr><td colSpan={6}>Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={6}>No students found.</td></tr> : rows.map(row => <tr key={row.id} className={selected.has(row.id) ? 'admin-row-selected' : ''}>
          <td data-label="Select"><input type="checkbox" aria-label={`Select ${studentName(row)}`} checked={selected.has(row.id)} onChange={() => toggle(row)} /></td>
          <td data-label="Student"><div><p>{studentName(row)}</p><p className="admin-meta break-all">{row.email}</p></div></td>
          <td data-label="School">{row.school || '—'}</td><td data-label="Status"><span className={`admin-status admin-status-${row.status}`}>{row.status}</span></td>
          <td data-label="Submitted">{row.created_at ? <time dateTime={row.created_at} title={`${new Date(row.created_at).toLocaleString(undefined, { timeZone: 'UTC' })} UTC`}>{new Date(row.created_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}</time> : '—'}</td>
          <td data-label="Actions"><button className="admin-button" id={`review-${row.id}`} onClick={() => void loadDetail(row.id)}>Review</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="admin-toolbar mt-4"><span className="admin-meta">Page {page + 1} of {Math.max(1, Math.ceil(count / pageSize))}</span><div className="flex gap-2"><button className="admin-button" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className="admin-button" disabled={(page + 1) * pageSize >= count || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </>}
  </fieldset>;
}
