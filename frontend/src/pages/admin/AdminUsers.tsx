import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastContext';
import { useAdminSelection } from './AdminSelectionContext';
import { studentName, type AdminStudent } from './adminApprovalState';

interface Registration extends AdminStudent {
  created_at: string;
  school?: string | null;
  level_of_study?: string | null;
  shirt_size?: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
  answers?: Record<string, unknown>;
}
const PAGE_SIZE = 50;
const STATUSES = ['pending', 'approved', 'rejected', 'waitlisted'];
function formatAnswer(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(formatAnswer).join(', ') || '—';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, inner]) => `${key}: ${formatAnswer(inner)}`).join(' | ');
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
}

export default function AdminUsers() {
  const { selected, add, remove, toggle, sync, revision, formKey, busy } = useAdminSelection();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [checkedIn, setCheckedIn] = useState('');
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Registration | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const detailRequest = useRef(0);
  const cohortRequest = useRef(0);
  const detailPanel = useRef<HTMLDivElement>(null);
  const selectPage = useRef<HTMLInputElement>(null);

  const filters = useCallback(() => new URLSearchParams({ form_key: formKey, q: query, status, checked_in: checkedIn }), [formKey, query, status, checkedIn]);
  useEffect(() => {
    let current = true;
    cohortRequest.current++;
    setAdding(false);
    setLoading(true);
    setError('');
    const params = filters();
    params.set('limit', String(PAGE_SIZE)); params.set('offset', String(page * PAGE_SIZE));
    apiFetch(`/api/admin/approval/students?${params}`).then(async res => {
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (!current) return;
      setRows(body.data ?? []); setCount(body.count ?? 0); sync(body.data ?? []);
      setPage(value => Math.min(value, Math.max(0, Math.ceil((body.count ?? 0) / PAGE_SIZE) - 1)));
    }).catch(() => { if (current) { setRows([]); setError('Could not load students.'); } })
      .finally(() => { if (current) setLoading(false); });
    const requests = cohortRequest;
    return () => { current = false; requests.current++; };
  }, [filters, page, revision, refreshKey, sync]);

  useEffect(() => {
    if (selectPage.current) selectPage.current.indeterminate = rows.some(row => selected.has(row.id)) && !rows.every(row => selected.has(row.id));
  }, [rows, selected]);

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

  const addFiltered = async () => {
    const current = ++cohortRequest.current;
    setAdding(true);
    try {
      const res = await apiFetch(`/api/admin/approval/selection?${filters()}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      if (current === cohortRequest.current) add(body.data ?? []);
    } catch { if (current === cohortRequest.current) showToast('Could not select filtered students.', 'error'); }
    finally { if (current === cohortRequest.current) setAdding(false); }
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
        <input className="admin-input" aria-label="Search students" placeholder="Name, email, school…" value={search} onChange={event => setSearch(event.target.value)} />
        <button className="admin-button" type="submit">Search</button>
      </form>
      <select aria-label="Filter by status" className="admin-input" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">All statuses</option>{STATUSES.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filter by attendance" className="admin-input" value={checkedIn} onChange={event => { setCheckedIn(event.target.value); setPage(0); }}><option value="">All attendance</option><option value="true">Checked in</option><option value="false">Not checked in</option></select>
    </div>
    <div className="admin-toolbar my-3"><span className="admin-meta">{loading ? 'Loading…' : `${count} students`}</span><div className="flex flex-wrap gap-2"><button className="admin-button" disabled={loading || adding || !!error || !count} onClick={() => void addFiltered()}>{adding ? 'Adding…' : `Add all ${count} filtered`}</button><button className="admin-button" onClick={() => void exportCsv()}>Export CSV</button></div></div>
    {error && <p role="alert" className="text-red6 mb-3">{error} <button className="admin-text-button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></p>}
    {detailId !== null ? <section ref={detailPanel} tabIndex={-1} className="admin-detail" aria-label="Application review">
      <div className="admin-toolbar mb-4"><button className="admin-text-button" onClick={closeDetail}>← Back to students</button>{detail && <button className="admin-button" onClick={() => toggle(detail)}>{selected.has(detail.id) ? 'Remove from selected' : 'Add to selected'}</button>}</div>
      {detailLoading && <p className="admin-meta">Loading application…</p>}
      {detail && <>
        <div className="admin-toolbar"><div><h2>{studentName(detail)}</h2><p className="admin-meta break-all">{detail.email}</p></div><span className={`admin-status admin-status-${detail.status}`}>{detail.status}</span></div>
        <div className="admin-toolbar my-4"><p className="admin-meta">{detail.checked_in ? `Checked in${detail.checked_in_at ? ` · ${new Date(detail.checked_in_at).toLocaleString()}` : ''}` : 'Not checked in'}</p><button className="admin-button" disabled={checkingIn} onClick={() => void checkIn()}>{detail.checked_in ? 'Undo check-in' : 'Check in'}</button></div>
        <dl className="admin-answer-list">{Object.entries(detail.answers ?? {}).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{formatAnswer(value)}</dd></div>)}</dl>
      </>}
    </section> : <>
      <div className="admin-table-wrap"><table className="admin-record-table admin-approval-table">
        <thead><tr><th><input ref={selectPage} type="checkbox" aria-label="Select this page" checked={rows.length > 0 && rows.every(row => selected.has(row.id))} disabled={loading || !rows.length} onChange={event => { if (event.target.checked) add(rows); else rows.forEach(row => remove(row.id)); }} /></th><th>Student</th><th>School</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={5}>Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={5}>No students found.</td></tr> : rows.map(row => <tr key={row.id} className={selected.has(row.id) ? 'admin-row-selected' : ''}>
          <td data-label="Select"><input type="checkbox" aria-label={`Select ${studentName(row)}`} checked={selected.has(row.id)} onChange={() => toggle(row)} /></td>
          <td data-label="Student"><div><p>{studentName(row)}</p><p className="admin-meta break-all">{row.email}</p></div></td>
          <td data-label="School">{row.school || '—'}</td><td data-label="Status"><span className={`admin-status admin-status-${row.status}`}>{row.status}</span></td>
          <td data-label="Actions"><button className="admin-button" id={`review-${row.id}`} onClick={() => void loadDetail(row.id)}>Review</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="admin-toolbar mt-4"><span className="admin-meta">Page {page + 1} of {Math.max(1, Math.ceil(count / PAGE_SIZE))}</span><div className="flex gap-2"><button className="admin-button" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className="admin-button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </>}
  </fieldset>;
}
