export const DEFAULT_REGISTRATION_TIMEZONE = "America/New_York";

export interface RegistrationClosure {
  closes_at?: string | null;
  closes_timezone?: string;
  server_now?: string;
}

export function isRegistrationClosed(closesAt: string | null | undefined, now = Date.now()): boolean {
  return !!closesAt && now >= Date.parse(closesAt);
}

export function formatRegistrationDeadline(closesAt: string, timeZone = DEFAULT_REGISTRATION_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(closesAt));
}

export function deadlineToLocalInput(closesAt: string | null | undefined, timeZone = DEFAULT_REGISTRATION_TIMEZONE): string {
  if (!closesAt) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(closesAt));
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

/** Resolve a wall-clock input without relying on the browser's own time zone. */
export function localInputToDeadline(value: string, timeZone = DEFAULT_REGISTRATION_TIMEZONE): string | null {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    throw new Error("Enter a valid closing date and time.");
  }
  const wallTime = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 19) !== normalized) {
    throw new Error("Enter a valid closing date and time.");
  }
  // Sample both sides of any DST transition to find each possible UTC offset.
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const probe = wallTime + hours * 3_600_000;
    const wallProbe = Date.parse(`${deadlineToLocalInput(new Date(probe).toISOString(), timeZone)}Z`);
    offsets.add(wallProbe - probe);
  }
  const candidates = [...offsets].map((offset) => new Date(wallTime - offset).toISOString())
    .filter((candidate) => deadlineToLocalInput(candidate, timeZone) === normalized);
  if (candidates.length === 0) throw new Error("That time does not exist in this time zone. Choose a time outside the daylight saving change.");
  if (candidates.length > 1) throw new Error("That time occurs twice during the daylight saving change. Choose another time or use UTC.");
  return candidates[0];
}
