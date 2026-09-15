import { useState } from 'react';
import AdminSelect from '@/components/AdminSelect';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import AdminTaskDialog from './AdminTaskDialog';
import AdminSelectionPanel from './AdminSelectionPanel';
import AdminDecisionRelease from './AdminDecisionRelease';
import AdminDecisionEmails from './AdminDecisionEmails';
import { useAdminSelection } from './AdminSelectionContext';

import { decisionOptions } from './adminApprovalState';

export default function AdminSelectionActions({ outside, onReady }: { outside?: number; onReady?: () => void }) {
  const { selected, clear, busy, notice, decide, formKey } = useAdminSelection();
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState('approved');
  return <>
    {notice && <div className="my-3" role="status"><p className="admin-meta">{notice}</p>
      {formKey === 'registration' && notice.includes('draft decisions saved') && onReady && <button className="admin-text-button" onClick={onReady}>View ready-to-release applicants</button>}
    </div>}
    {!!selected.size && <div className="admin-selection-bar">
      <span>{selected.size} selected{outside !== undefined ? ` · ${outside} outside this list` : ''}</span>
      <button className="admin-button" disabled={busy} onClick={() => setReview(true)}>Review selection</button>
      <button className="admin-button" disabled={busy} onClick={() => setSaving(true)}>Save decision…</button>
      <AdminDecisionRelease />
      <AdminDecisionEmails />
      <button className="admin-text-button" disabled={busy} onClick={clear}>Clear</button>
    </div>}
    {review && <AdminTaskDialog title="Review selection" busy={busy} onClose={() => setReview(false)}><AdminSelectionPanel mode="review" /></AdminTaskDialog>}
    <ConfirmationDialog open={saving} title="Save decision" busy={busy} confirmLabel="Save decision" onClose={() => setSaving(false)}
      onConfirm={() => void decide(decision).finally(() => setSaving(false))}>
      <p>Applies to all {selected.size} selected applicants, including applicants outside this list.</p>
      {formKey === 'registration' && <p className="my-3">Applicants won’t see this change until you release it.</p>}
      <AdminSelect fullWidth aria-label="Decision to save" className="admin-input" value={decision} options={decisionOptions} onChange={setDecision} />
    </ConfirmationDialog>
  </>;
}
