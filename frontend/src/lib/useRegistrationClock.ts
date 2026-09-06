import { useEffect, useState } from "react";

/** Keep open forms current at the deadline, calibrated against the API clock. */
export function useRegistrationClock(serverNow?: string) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const serverTime = serverNow ? Date.parse(serverNow) : NaN;
    const offset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
    const tick = () => setNow(Date.now() + offset);
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [serverNow]);
  return now;
}
