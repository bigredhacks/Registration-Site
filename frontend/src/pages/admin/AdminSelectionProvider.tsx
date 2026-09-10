import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastContext';
import { AdminSelectionContext } from './AdminSelectionContext';
import { addToSelection, type AdminStudent } from './adminApprovalState';

export default function AdminSelectionProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [formKey, setForm] = useState('registration');
  const [forms, setForms] = useState<{ key: string; title: string }[]>([]);
  const [selections, setSelections] = useState<Record<string, Map<number, AdminStudent>>>({});
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [notice, setNotice] = useState('');
  const selected = selections[formKey] ?? new Map<number, AdminStudent>();

  useEffect(() => {
    let current = true;
    apiFetch('/api/admin/form-configs').then(async res => {
      if (!res.ok) throw new Error();
      const data: { key: string; title: string }[] = await res.json();
      if (!current) return;
      setForms(data);
      if (data.length && !data.some(form => form.key === 'registration')) setForm(data[0].key);
    }).catch(() => { if (current) showToast('Could not load application choices.', 'error'); });
    return () => { current = false; };
  }, [showToast]);

  const edit = useCallback((update: (previous: Map<number, AdminStudent>) => Map<number, AdminStudent>) => {
    if (locked.current) return;
    setSelections(previous => ({ ...previous, [formKey]: update(previous[formKey] ?? new Map()) }));
    setNotice('');
  }, [formKey]);
  const add = useCallback((students: AdminStudent[]) => edit(previous => addToSelection(previous, students, formKey)), [edit, formKey]);
  const replace = useCallback((students: AdminStudent[]) => edit(() => addToSelection(new Map(), students, formKey)), [edit, formKey]);
  const remove = useCallback((id: number) => edit(previous => { const next = new Map(previous); next.delete(id); return next; }), [edit]);
  const toggle = useCallback((student: AdminStudent) => edit(previous => {
    if (previous.has(student.id)) { const next = new Map(previous); next.delete(student.id); return next; }
    return addToSelection(previous, [student], formKey);
  }), [edit, formKey]);
  const sync = useCallback((students: AdminStudent[]) => {
    setSelections(previous => {
      const existing = previous[formKey];
      if (!existing?.size) return previous;
      return { ...previous, [formKey]: addToSelection(existing, students.filter(student => existing.has(student.id)), formKey) };
    });
  }, [formKey]);

  const decide = async (status: string) => {
    if (locked.current || !selected.size) return;
    locked.current = true;
    setBusy(true);
    setNotice('');
    const ids = [...selected.keys()];
    let updated = 0;
    let failed = false;
    try {
      for (let offset = 0; offset < ids.length; offset += 200) {
        const batch = ids.slice(offset, offset + 200);
        const res = await apiFetch('/api/admin/approval/decision', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_key: formKey, ids: batch, status }),
        });
        if (!res.ok) throw new Error();
        const body: { data: AdminStudent[] } = await res.json();
        const updatedIds = new Set(body.data.map(student => student.id));
        updated += updatedIds.size;
        setSelections(previous => {
          const next = new Map(previous[formKey]);
          updatedIds.forEach(id => next.delete(id));
          return { ...previous, [formKey]: next };
        });
        if (updatedIds.size !== batch.length) failed = true;
      }
    } catch { failed = true; }
    finally {
      locked.current = false;
      setBusy(false);
      setRevision(value => value + 1);
      const result = `${updated} ${status}.` + (failed ? ` ${ids.length - updated} remain selected; refresh or retry.` : '');
      setNotice(result);
      showToast(result, failed ? 'error' : 'success');
    }
  };

  return <AdminSelectionContext.Provider value={{
    selected, add, replace, remove, toggle, sync, revision, formKey, forms, busy, notice, decide,
    clear: () => edit(() => new Map()),
    setFormKey: key => { if (!locked.current) { setForm(key); setNotice(''); } },
  }}>{children}</AdminSelectionContext.Provider>;
}
