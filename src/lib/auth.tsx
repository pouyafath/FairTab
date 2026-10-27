import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { isConfigured, supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: isConfigured });
  const queryClient = useQueryClient();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    const apply = (session: Session | null) => {
      // Cached data belongs to one person: drop it whenever the signed-in user changes or signs out.
      const userId = session?.user.id ?? null;
      if (userId !== userIdRef.current) {
        userIdRef.current = userId;
        queryClient.clear();
      }
      setState({ session, loading: false });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** The signed-in user's id. Only call inside screens that require sign-in. */
export function useUserId(): string {
  const { session } = useAuth();
  return session?.user.id ?? '';
}
