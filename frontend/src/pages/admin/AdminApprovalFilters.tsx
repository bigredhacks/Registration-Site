import AdminSelect from '@/components/AdminSelect';

export interface ApprovalAnswerFilter {
  field: string;
  row?: string;
  operator: 'is' | 'is_not' | 'contains' | 'not_contains' | 'empty' | 'not_empty' | 'gt' | 'gte' | 'lt' | 'lte';
  values?: string[];
}
export interface ApprovalFilterField {
  field: string;
  row?: string;
  label: string;
  kind: 'choice' | 'text' | 'number';
  options: string[];
}
const keyOf = (field: { field: string; row?: string }) => JSON.stringify([field.field, field.row]);
const operators = {
  is: 'Is any of', is_not: 'Is none of', contains: 'Contains', not_contains: 'Does not contain',
  empty: 'Not answered', not_empty: 'Answered', gt: 'Greater than', gte: 'At least', lt: 'Less than', lte: 'At most',
};
const needsValue = (filter: ApprovalAnswerFilter) => !['empty', 'not_empty'].includes(filter.operator);

export default function AdminApprovalFilters({ fields, applied, draft, onChange: setDraft, onApply, disabled }: {
  fields: ApprovalFilterField[];
  applied: ApprovalAnswerFilter[];
  draft: ApprovalAnswerFilter[];
  onChange: (filters: ApprovalAnswerFilter[]) => void;
  onApply: (filters: ApprovalAnswerFilter[]) => void;
  disabled: boolean;
}) {
  const changed = JSON.stringify(draft) !== JSON.stringify(applied);
  const valid = draft.every(filter => !needsValue(filter) || filter.values?.some(value => value.trim()));
  const update = (index: number, patch: Partial<ApprovalAnswerFilter>) => setDraft(draft.map((filter, i) => i === index ? { ...filter, ...patch } : filter));
  return <section className="admin-answer-filters" aria-label="Form answer filters">
    <div className="admin-toolbar">
      <span className="admin-meta">Form filters{applied.length > 0 ? ` · ${applied.length} applied` : ''}{draft.length > 1 ? ' · Match all' : ''}</span>
      <AdminSelect className="admin-input" fullWidth aria-label="Add form filter" value="" placeholder="+ Add filter"
        disabled={disabled || draft.length >= 30 || !fields.length}
        options={fields.map(field => ({ value: keyOf(field), label: field.label }))}
        onChange={value => {
          const field = fields.find(option => keyOf(option) === value);
          if (field) setDraft([...draft, { field: field.field, row: field.row, operator: 'is', values: [] }]);
        }} />
    </div>
    {draft.map((filter, index) => {
      const field = fields.find(option => keyOf(option) === keyOf(filter));
      const choice = field?.kind === 'choice' && ['is', 'is_not'].includes(filter.operator);
      return <div className="admin-answer-filter" key={index}>
        <label className="admin-filter-field"><span>{field?.label ?? filter.field}</span>
          <AdminSelect className="admin-input" fullWidth aria-label={`Operator for filter ${index + 1}`} value={filter.operator}
            options={Object.entries(operators).filter(([operator]) => field?.kind === 'number' || !['gt', 'gte', 'lt', 'lte'].includes(operator)).map(([operator, label]) => ({ value: operator, label }))}
            onChange={value => update(index, { operator: value as ApprovalAnswerFilter['operator'], values: [] })} />
        </label>
        <div className="admin-filter-value">
          {needsValue(filter) && (choice ? <>
            <AdminSelect className="admin-input" fullWidth aria-label={`Value for filter ${index + 1}`} value="" placeholder="Choose value…"
              options={field.options.filter(option => !filter.values?.includes(option)).map(option => ({ value: option, label: option }))}
              onChange={value => update(index, { values: [...(filter.values ?? []), value] })} />
            <div className="admin-filter-chips">{filter.values?.map(value => <button type="button" className="admin-button" key={value} aria-label={`Remove ${value} from filter ${index + 1}`} onClick={() => update(index, { values: filter.values?.filter(item => item !== value) })}>{value} ×</button>)}</div>
          </> : <input className="admin-input" type={field?.kind === 'number' ? 'number' : 'text'} aria-label={`Value for filter ${index + 1}`} placeholder="Enter value…" value={filter.values?.[0] ?? ''} onChange={event => update(index, { values: [event.target.value] })} />)}
        </div>
        <button type="button" className="admin-text-button" aria-label={`Remove filter ${index + 1}`} onClick={() => setDraft(draft.filter((_, i) => i !== index))}>Remove</button>
      </div>;
    })}
    {(draft.length > 0 || applied.length > 0) && <div className="admin-toolbar mt-3">
      <div className="flex gap-2"><button type="button" className="admin-button admin-button-primary" disabled={disabled || !valid || !changed} onClick={() => onApply(draft)}>Apply filters</button>
        <button type="button" className="admin-text-button" disabled={disabled} onClick={() => { setDraft([]); onApply([]); }}>Clear form filters</button></div>
      {changed && <span className="admin-meta" role="status">Changes not applied</span>}
    </div>}
  </section>;
}
