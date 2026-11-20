import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  /** A real, signed-in account. Guests are never here, so the rest of the site treats them as signed out. */
  user: User | null;
  /** An anonymous guest session, used for the free tries before sign-in. */
  guest: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, guest: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // The signed-in state comes from the stored session (INITIAL_SESSION, refreshed if needed),
    // not from a separate network check: a slow or failed /user call used to leave people who
    // were signed in looking signed out.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? null;
      const nextId = next?.id ?? null;
      // A different person (sign-in, sign-out, or guest -> account): reload their data.
      if (currentId.current !== undefined && currentId.current !== nextId) {
        void router.invalidate();
        if (next) void queryClient.invalidateQueries();
      }
      currentId.current = nextId;
      setSessionUser(next);
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  const value = useMemo<AuthState>(
    () => ({
      user: sessionUser && !sessionUser.is_anonymous ? sessionUser : null,
      guest: sessionUser?.is_anonymous ? sessionUser : null,
      loading,
    }),
    [sessionUser, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
