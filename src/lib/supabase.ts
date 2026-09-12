import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from './env';
import { sessionStorage } from './storage';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar, so there is no OAuth redirect fragment
      // for the client to parse.
      detectSessionInUrl: false,
    },
  },
);

// Supabase refreshes tokens on a timer. Timers are unreliable while an app is
// backgrounded, so tie refreshing to foreground state instead: otherwise the
// first request after a long background stretch fails on an expired token.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

/**
 * Ensure there is a signed-in user, creating an anonymous one on first launch.
 *
 * v1 has no accounts (SDD §2): every install gets an anonymous Supabase user,
 * which is a real row in auth.users with a real uid. That means row-level
 * security works from day one and upgrading to email login later is a linking
 * operation, not a migration.
 */
export async function ensureSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const { data: signedIn, error: signInError } =
    await supabase.auth.signInAnonymously();
  if (signInError) throw signInError;
  if (!signedIn.session) {
    throw new Error('Anonymous sign-in returned no session.');
  }

  return signedIn.session;
}
