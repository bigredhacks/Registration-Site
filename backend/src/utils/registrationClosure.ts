import { z } from 'zod';

export const DEFAULT_REGISTRATION_TIMEZONE = 'America/New_York';

export const RegistrationClosesAtSchema = z.iso.datetime({ offset: true }).nullable();
export const RegistrationTimezoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, 'Use a valid IANA time zone');

export function isRegistrationClosed(closesAt: string | null | undefined, now = Date.now()): boolean {
  return !!closesAt && now >= Date.parse(closesAt);
}

export function registrationClosureResponse<T extends { closes_at?: string | null; closes_timezone?: string }>(form: T, now = Date.now()) {
  return {
    ...form,
    deadline_supported: form.closes_at !== undefined && form.closes_timezone !== undefined,
    closes_at: form.closes_at ?? null,
    closes_timezone: form.closes_timezone ?? DEFAULT_REGISTRATION_TIMEZONE,
    is_closed: isRegistrationClosed(form.closes_at, now),
    server_now: new Date(now).toISOString(),
  };
}

export function registrationClosedError(closesAt: string) {
  return {
    error: 'Registration is closed. Applications can no longer be submitted or changed.',
    code: 'REGISTRATION_CLOSED',
    closes_at: closesAt,
    server_now: new Date().toISOString(),
  };
}

export function formConfigWriteError(error: { code?: string; message: string }) {
  if (['42703', 'PGRST204'].includes(error.code ?? '') && /closes_at|closes_timezone/.test(error.message)) {
    return 'Registration deadlines require the 20260905_registration_closure.sql database migration. Other form settings can still be saved.';
  }
  return error.message;
}
