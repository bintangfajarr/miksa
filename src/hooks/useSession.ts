import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { ensureSession, supabase } from '../lib/supabase';

type SessionState =
  | { status: 'loading'; session: null; error: null }
  | { status: 'ready'; session: Session; error: null }
  | { status: 'error'; session: null; error: Error };

/**
 * Signs the user in anonymously on first launch and keeps the session in sync.
 *
 * v1 has no accounts (SDD §2), but every install still gets a real row in
 * auth.users. That is what makes row-level security work from day one, and it
 * means adding email login later is a link operation rather than a migration.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    session: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    ensureSession()
      .then((session) => {
        if (!cancelled) setState({ status: 'ready', session, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          session: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled || !session) return;
        setState({ status: 'ready', session, error: null });
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
