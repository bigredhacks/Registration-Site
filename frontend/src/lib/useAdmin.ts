import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { supabase } from "@/config/supabase";

interface AdminState {
  loading: boolean;
  isAdmin: boolean;
  // True when the admin check could not complete (network error, 5xx). Lets
  // callers distinguish "confirmed non-admin" from "we don't know yet"
  // instead of silently kicking real admins out of the panel on transient
  // failures.
  error: boolean;
}

export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ loading: true, isAdmin: false, error: false });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState({ loading: false, isAdmin: false, error: false });
        return;
      }
      try {
        const res = await apiFetch("/api/admin/me");
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setState({ loading: false, isAdmin: false, error: false });
          return;
        }
        if (!res.ok) {
          setState({ loading: false, isAdmin: false, error: true });
          return;
        }
        const body = await res.json();
        setState({ loading: false, isAdmin: !!body.admin, error: false });
      } catch {
        if (!cancelled) setState({ loading: false, isAdmin: false, error: true });
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
