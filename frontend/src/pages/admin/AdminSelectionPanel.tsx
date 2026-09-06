import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAdminSelection } from './AdminSelectionContext';
import { parseStudentList, studentName, type IdentityMatch } from './adminApprovalState';
import AdminSelect from '@/components/AdminSelect';

export default function AdminSelectionPanel() {
  const { selected, remove, clear, add, formKey, busy, notice, decide } = useAdminSelection();
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<IdentityMatch[]>([]);
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const lookup = async () => {
    const entries = parseStudentList(text);
    setError('');
    setMatches([]);
    setChoices({});
    if (!entries.length || entries.length > 500) { setError('Enter 1–500 emails or full names.'); return; }
    const current = ++request.current;
    setResolving(true);
    try {
      const res = await apiFetch('/api/admin/approval/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_key: formKey, entries }),
      });
      if (!res.ok) throw new Error();
      const body: { matches: IdentityMatch[] } = await res.json();
      if (current !== request.current) return;
      setMatches(body.matches);
      setChoices(Object.fromEntries(body.matches.flatMap((match, index) => !match.duplicate && match.matches.length === 1 ? [[index, match.matches[0].id]] : [])));
    } catch { if (current === request.current) setError('Could not find students. Try again.'); }
    finally { if (current === request.current) setResolving(false); }
  };
  const candidates = matches.flatMap((match, index) => match.matches.filter(student => choices[index] === student.id));
  const unique = [...new Map(candidates.filter(student => !selected.has(student.id)).map(student => [student.id, student])).values()];

  return <aside className="admin-selection-panel" aria-label="Selected students" id="admin-selected-panel" tabIndex={-1}>
    <button className="admin-text-button admin-selection-return" onClick={() => document.getElementById('admin-browse-list')?.scrollIntoView({ block: 'start' })}>↑ Back to list</button>
    <fieldset disabled={busy}>
      <div className="admin-toolbar"><h2>Selected students <span className="admin-count">{selected.size}</span></h2><button className="admin-text-button" onClick={clear} disabled={!selected.size}>Clear</button></div>
      <ul className="admin-selected-list">
        {[...selected.values()].map(student => <li key={student.id}>
          <div className="min-w-0"><p>{studentName(student)}</p><p className="admin-meta break-all">{student.email}</p><p className="admin-meta">{student.team_name ? `${student.team_name} · ` : ''}{student.status}</p></div>
          <button className="admin-text-button" onClick={() => remove(student.id)} aria-label={`Remove ${studentName(student)}`}>×</button>
        </li>)}
        {!selected.size && <li className="admin-meta">No students selected</li>}
      </ul>
      <div className="admin-selection-actions">
        <button className="admin-button admin-button-primary" disabled={!selected.size} onClick={() => void decide('approved')}>{busy ? 'Updating…' : 'Approve'}</button>
        <button className="admin-button" disabled={!selected.size} onClick={() => void decide('rejected')}>Reject</button>
        <AdminSelect aria-label="Other approval actions" value="" disabled={!selected.size} className="admin-input" placeholder="More…"
          options={[{ value: 'waitlisted', label: 'Waitlist' }, { value: 'pending', label: 'Set pending' }]}
          onChange={value => { if (value) void decide(value); }} />
      </div>
      {notice && <p className="admin-meta mt-3" role="status">{notice}</p>}
      <div className="admin-paste-panel">
        <label htmlFor="admin-paste-students">Add emails or full names</label>
        <textarea id="admin-paste-students" className="admin-input" rows={4} value={text} maxLength={50000} placeholder={'student@cornell.edu\nFirst Last'} onChange={event => { setText(event.target.value); request.current++; setResolving(false); setMatches([]); setChoices({}); setError(''); }} />
        <button className="admin-button" disabled={resolving || !text.trim()} onClick={() => void lookup()}>{resolving ? 'Finding…' : 'Find students'}</button>
        {error && <p role="alert" className="text-red6 mt-2">{error}</p>}
        {!!matches.length && <div className="admin-identity-results" aria-live="polite">
          {matches.map((match, index) => <div key={index} className="admin-identity-result">
            <p className="break-all">{match.input}</p>
            {match.duplicate ? <span className="admin-meta">Duplicate entry</span> : match.matches.length === 0 ? <span className="text-red6">Not found</span> : match.matches.length === 1 ? <label className="admin-check"><input type="checkbox" checked={!!choices[index]} disabled={selected.has(match.matches[0].id)} onChange={event => setChoices(previous => ({ ...previous, [index]: event.target.checked ? match.matches[0].id : 0 }))} /><span className="admin-meta">{selected.has(match.matches[0].id) ? 'Already selected' : `Matched · ${studentName(match.matches[0])}`}</span></label> : <label className="admin-meta">{match.matches.length} matches<AdminSelect aria-label={`Choose student for ${match.input}`} className="admin-input" fullWidth placeholder="Choose student…"
              value={choices[index] ? String(choices[index]) : ''}
              options={match.matches.map(student => ({ value: String(student.id), label: `${studentName(student)} · ${student.email}` }))}
              onChange={value => setChoices(previous => ({ ...previous, [index]: Number(value) }))} /></label>}
          </div>)}
          <button className="admin-button" disabled={!unique.length} onClick={() => { add(unique); setMatches([]); setText(''); setChoices({}); }}>Add {unique.length} matched students</button>
        </div>}
      </div>
    </fieldset>
  </aside>;
}
