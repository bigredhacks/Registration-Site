import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { supabase } from "@/config/supabase";

interface AdminState {
  loading: boolean;
  isAdmin: boolean;
}

export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ loading: true, isAdmin: false });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState({ loading: false, isAdmin: false });
        return;
      }
      try {
        const res = await apiFetch("/api/admin/me");
        if (cancelled) return;
        if (!res.ok) {
          setState({ loading: false, isAdmin: false });
          return;
        }
        const body = await res.json();
        setState({ loading: false, isAdmin: !!body.admin });
      } catch {
        if (!cancelled) setState({ loading: false, isAdmin: false });
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
