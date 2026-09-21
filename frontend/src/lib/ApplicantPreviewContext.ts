import { createContext, useContext } from 'react';

export type ApplicantPreviewControls = {
  personaId: string;
  personas: readonly { id: string; label: string }[];
  selectPersona: (id: string) => void;
} & ({ view: 'admin' } | {
  view: 'applicant';
  name: string;
  description: string;
  reset: () => void;
});

// Contains controls only. Fixture data and API handling belong to the dev entry.
export const ApplicantPreviewContext = createContext<ApplicantPreviewControls | null>(null);
export const useApplicantPreview = () => useContext(ApplicantPreviewContext);
