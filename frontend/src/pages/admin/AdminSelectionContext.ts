import { createContext, useContext } from 'react';
import type { AdminStudent } from './adminApprovalState';

export interface AdminSelection {
  selected: Map<number, AdminStudent>;
  add: (students: AdminStudent[]) => void;
  replace: (students: AdminStudent[]) => void;
  remove: (id: number) => void;
  toggle: (student: AdminStudent) => void;
  clear: () => void;
  sync: (students: AdminStudent[]) => void;
  revision: number;
  formKey: string;
  setFormKey: (key: string) => void;
  forms: { key: string; title: string }[];
  busy: boolean;
  notice: string;
  decide: (status: string) => Promise<void>;
}

export const AdminSelectionContext = createContext<AdminSelection | null>(null);
export function useAdminSelection() {
  const value = useContext(AdminSelectionContext);
  if (!value) throw new Error('Admin selection provider is missing.');
  return value;
}
