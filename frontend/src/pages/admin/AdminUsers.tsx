import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminSelect from '@/components/AdminSelect';
import AdminTaskDialog from './AdminTaskDialog';
import AdminUserDetail from './AdminUserDetail';
import { PROFILE_STATE_OPTIONS, profileStateLabel, userName, type AdminUserDetail as UserDetail, type AdminUserRow } from './adminUsersState';

const PAGE_SIZES = [25, 50, 100, 200];
const PAGE_SIZE_KEY = 'brh.admin.users.pageSize';
const SORT_COLUMNS = [
  { column: 'name', label: 'User', defaultDir: 'asc' },
  { column: 'school', label: 'School', defaultDir: 'asc' },
  { column: 'created_at', label: 'Signed up', defaultDir: 'desc' },
] as const;
type Sort = { column: typeof SORT_COLUMNS[number]['column']; dir: 'asc' | 'desc' };
type Filters = { profile: string; submitted: string; verified: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { profile: '', submitted: '', verified: '', from: '', to: '' };

function SignupDate({ value }: { value: string | null }) {
  return value ? <time dateTime={value} title={`${new Date(value).toLocaleString(undefined, { timeZone: 'UTC' })} UTC`}>
    {new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' })}
  </time> : <>—</>;
}

export default function AdminUsers() {
  const [forms, setForms] = useState<{ key: string; title: string }[]>([]);
  const [formsError, setFormsError] = useState('');
  const [formKey, setFormKey] = useState('registration');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterDraft, setFilterDraft] = useState<Filters | null>(null);
  const [sort, setSort] = useState<Sort>({ column: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    const stored = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(stored) ? stored : 50;
  });
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);
  const detailPanel = useRef<HTMLElement>(null);
  const formTitle = forms.find(form => form.key === formKey)?.title ?? formKey;

  useEffect(() => {
    let current = true;
    setFormsError('');
    apiFetch('/api/admin/form-configs').then(async response => {
      if (!response.ok) throw new Error();
      const data: { key: string; title: string }[] = await response.json();
      if (current) setForms(data);
    }).catch(() => { if (current) setFormsError('Could not load application choices.'); });
    return () => { current = false; };
  }, [refreshKey]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      form_key: formKey, q: query, profile_state: filters.profile, submitted: filters.submitted,
      email_verified: filters.verified, from: filters.from, to: filters.to,
      sort: sort.column, dir: sort.dir, limit: String(pageSize), offset: String(page * pageSize),
    });
    apiFetch(`/api/admin/users?${params}`).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not load users.');
      if (!current) return;
      setRows(body.data ?? []);
      setCount(body.count ?? 0);
      setPage(value => Math.min(value, Math.max(0, Math.ceil((body.count ?? 0) / pageSize) - 1)));
    }).catch(cause => {
      if (current) {
        setRows([]); setCount(0);
        setError(cause instanceof Error ? cause.message : 'Could not load users.');
      }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [formKey, query, filters, sort, page, pageSize, refreshKey]);

  const loadDetail = useCallback(async (userId: string) => {
    const request = ++detailRequest.current;
    setDetailId(userId); setDetail(null); setDetailError(''); setDetailLoading(true);
    requestAnimationFrame(() => detailPanel.current?.focus());
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}?${new URLSearchParams({ form_key: formKey })}`);
      const body = await response.json();
      if (!response.ok) throw new Error(response.status === 404 ? 'This user no longer exists.' : 'Could not load user details.');
      if (request === detailRequest.current) setDetail(body);
    } catch (cause) {
      if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : 'Could not load user details.');
    } finally { if (request === detailRequest.current) setDetailLoading(false); }
  }, [formKey]);
  useEffect(() => () => { detailRequest.current++; }, []);

  const closeDetail = () => {
    detailRequest.current++;
    const previous = detailId;
    setDetailId(null); setDetail(null); setDetailError(''); setDetailLoading(false);
    requestAnimationFrame(() => document.getElementById(`view-user-${previous}`)?.focus());
  };
  const updateFilters = (next: Filters) => { setFilters(next); setPage(0); };
  const activeFilters = [
    { label: query && `Search: ${query}`, clear: () => { setSearch(''); setQuery(''); setPage(0); } },
    { label: filters.profile && `Profile: ${profileStateLabel(filters.profile as AdminUserRow['profile_state'])}`, clear: () => updateFilters({ ...filters, profile: '' }) },
    { label: filters.submitted && `Application: ${filters.submitted === 'true' ? 'Submitted' : 'Not submitted'}`, clear: () => updateFilters({ ...filters, submitted: '' }) },
    { label: filters.verified && `Email: ${filters.verified === 'true' ? 'Verified' : 'Not verified'}`, clear: () => updateFilters({ ...filters, verified: '' }) },
    { label: filters.from && `Signed up from: ${filters.from}`, clear: () => updateFilters({ ...filters, from: '' }) },
    { label: filters.to && `Signed up through: ${filters.to}`, clear: () => updateFilters({ ...filters, to: '' }) },
  ].filter(filter => filter.label);

  return <div className="admin-users-view">
    {detailId !== null ? <section ref={detailPanel} tabIndex={-1} className="admin-detail" aria-label="User details">
      <div className="admin-toolbar mb-4"><button className="admin-text-button" onClick={closeDetail}>← Back to users</button></div>
      {detailLoading && <p className="admin-meta" role="status">Loading user…</p>}
      {detailError && <p role="alert">{detailError} <button className="admin-text-button" onClick={() => void loadDetail(detailId)}>Retry</button></p>}
      {detail && <AdminUserDetail detail={detail} formTitle={formTitle} />}
    </section> : <>
      <div className="admin-toolbar mb-4">
        <label className="admin-form-picker">Application
          <AdminSelect aria-label="Users application" className="admin-input" value={formKey} onChange={value => { setFormKey(value); setPage(0); }} options={[
            ...(forms.some(form => form.key === formKey) ? [] : [{ value: formKey, label: formKey }]),
            ...forms.map(form => ({ value: form.key, label: form.title })),
          ]} />
        </label>
        <button className="admin-button" disabled={loading} onClick={() => setRefreshKey(value => value + 1)}>Refresh</button>
      </div>
      {formsError && <p role="alert" className="mb-3">{formsError} <button className="admin-text-button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></p>}
      <div className="admin-toolbar admin-applicant-toolbar">
        <form className="admin-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}>
          <input className="admin-input" aria-label="Search users" placeholder="Search name or email…" value={search} onChange={event => setSearch(event.target.value)} />
          <button className="admin-button" type="submit">Search</button>
        </form>
        <label className="admin-meta admin-primary-filter">Profile
          <AdminSelect fullWidth aria-label="Profile status" className="admin-input" value={filters.profile} placeholder="Any" options={PROFILE_STATE_OPTIONS} onChange={value => updateFilters({ ...filters, profile: value })} />
        </label>
        <label className="admin-meta admin-primary-filter">Application
          <AdminSelect fullWidth aria-label="Application submitted" className="admin-input" value={filters.submitted} placeholder="Any" options={[{ value: 'true', label: 'Submitted' }, { value: 'false', label: 'Not submitted' }]} onChange={value => updateFilters({ ...filters, submitted: value })} />
        </label>
        <button className="admin-button" onClick={() => setFilterDraft(filters)}>More filters</button>
      </div>
      {activeFilters.length > 0 && <div className="admin-filter-chips my-3" aria-label="Active user filters">
        {activeFilters.map(filter => <button key={filter.label} className="admin-button" onClick={filter.clear}>{filter.label} ×</button>)}
        <button className="admin-text-button" onClick={() => { setSearch(''); setQuery(''); updateFilters(EMPTY_FILTERS); }}>Clear filters</button>
      </div>}
      {filterDraft && <AdminTaskDialog title="User filters" onClose={() => setFilterDraft(null)}>
        <label className="admin-meta admin-primary-filter">Email verification
          <AdminSelect fullWidth aria-label="Email verification" className="admin-input" value={filterDraft.verified} placeholder="Any" options={[{ value: 'true', label: 'Verified' }, { value: 'false', label: 'Not verified' }]} onChange={value => setFilterDraft({ ...filterDraft, verified: value })} />
        </label>
        <div className="admin-date-range my-4"><span>Signed up (UTC)</span>
          <input type="date" className="admin-input" aria-label="Signed up from (UTC)" value={filterDraft.from} onChange={event => setFilterDraft({ ...filterDraft, from: event.target.value })} />
          <span>to</span><input type="date" className="admin-input" aria-label="Signed up through (UTC)" value={filterDraft.to} onChange={event => setFilterDraft({ ...filterDraft, to: event.target.value })} />
        </div>
        {filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to && <p role="alert">Start date must be on or before end date.</p>}
        <div className="admin-toolbar mt-4"><button className="admin-button" onClick={() => setFilterDraft(null)}>Cancel</button>
          <button className="admin-button admin-button-primary" disabled={Boolean(filterDraft.from && filterDraft.to && filterDraft.from > filterDraft.to)} onClick={() => { updateFilters(filterDraft); setFilterDraft(null); }}>Apply filters</button>
        </div>
      </AdminTaskDialog>}
      {error && <p role="alert" className="my-3">{error} <button className="admin-text-button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></p>}
      <div className="admin-toolbar my-4">
        <span className="admin-meta" role="status">{loading ? 'Loading…' : `${count} users`}</span>
        <label className="admin-meta">Per page <AdminSelect aria-label="Users per page" className="admin-input" value={String(pageSize)} options={PAGE_SIZES.map(size => ({ value: String(size), label: String(size) }))} onChange={value => { localStorage.setItem(PAGE_SIZE_KEY, value); setPageSize(Number(value)); setPage(0); }} /></label>
        <span className="admin-meta">Page {page + 1} of {Math.max(1, Math.ceil(count / pageSize))}</span>
        <div className="flex gap-2"><button className="admin-button" disabled={!page || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className="admin-button" disabled={(page + 1) * pageSize >= count || loading} onClick={() => setPage(value => value + 1)}>Next</button></div>
      </div>
      <div className="admin-table-wrap"><table className="admin-record-table admin-approval-table">
        <thead><tr>
          {SORT_COLUMNS.map(({ column, label, defaultDir }) => <th key={column} aria-sort={sort.column === column ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" className="admin-sort-button" disabled={loading} onClick={() => { setSort(current => ({ column, dir: current.column === column ? current.dir === 'asc' ? 'desc' : 'asc' : defaultDir })); setPage(0); }}>
              {label}<span aria-hidden="true" className={sort.column === column ? '' : 'opacity-30'}>{sort.column === column && sort.dir === 'desc' ? '↓' : '↑'}</span>
            </button>
          </th>)}
          <th>Profile</th><th>Application</th><th>Actions</th>
        </tr></thead>
        <tbody>{loading ? <tr><td colSpan={6}>Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={6}>{error ? 'Users unavailable.' : 'No users found.'}</td></tr> : rows.map(row => <tr key={row.user_id}>
          <td data-label="User"><div><p>{userName(row)}</p>{row.email && <p className="admin-meta break-all">{row.email}</p>}</div></td>
          <td data-label="School">{row.school || '—'}</td>
          <td data-label="Signed up"><SignupDate value={row.created_at} /></td>
          <td data-label="Profile"><div><span className={`admin-status ${row.profile_state === 'complete' ? 'admin-status-approved' : ''}`}>{profileStateLabel(row.profile_state)}</span><p className="admin-meta mt-1">{row.profile_pct}% complete</p></div></td>
          <td data-label="Application"><div><span className="admin-status">{row.registration_id !== null ? 'Submitted' : 'Not submitted'}</span>{row.submitted_at && <p className="admin-meta mt-1"><SignupDate value={row.submitted_at} /></p>}</div></td>
          <td data-label="Actions"><button className="admin-button" id={`view-user-${row.user_id}`} onClick={() => void loadDetail(row.user_id)}>View user<span className="sr-only"> {userName(row)}</span></button></td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </div>;
}
