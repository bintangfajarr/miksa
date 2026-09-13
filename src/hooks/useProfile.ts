import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { CefrLevel, ExplainIn, Profile } from '../types/database';

export interface Streak {
  streak_days: number;
  last_active_on: string | null;
  active_today: boolean;
}

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: ['profile'],
    enabled,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStreak(enabled: boolean) {
  return useQuery({
    queryKey: ['streak'],
    enabled,
    // Not persisted to disk and refetched often: a stale streak is worse than
    // no streak, since it is the one number the user checks for honesty.
    staleTime: 30_000,
    queryFn: async (): Promise<Streak> => {
      const { data, error } = await supabase.rpc('get_streak').single<Streak>();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: {
      cefr_level?: CefrLevel;
      vocab_per_day?: number;
      explain_in?: ExplainIn;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error('No session.');

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', uid)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    // Settings toggles must feel instant; a round trip before the switch moves
    // reads as a broken control.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['profile'] });
      const previous = qc.getQueryData<Profile | null>(['profile']);
      if (previous) {
        qc.setQueryData<Profile>(['profile'], { ...previous, ...patch });
      }
      return { previous };
    },

    onError: (_e, _patch, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(['profile'], ctx.previous);
    },

    onSuccess: (data) => {
      qc.setQueryData(['profile'], data);
    },
  });
}
