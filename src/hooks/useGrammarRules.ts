import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { GrammarRule } from '../types/database';

/**
 * The shared grammar rule catalogue (SDD §6.1).
 *
 * Public read, so this needs no user filter — but it does require a session,
 * because the RLS policy grants select to `authenticated` only.
 */
export function useGrammarRules(enabled: boolean) {
  return useQuery({
    queryKey: ['grammar_rules'],
    enabled,
    // The catalogue changes only when we hand-seed new rules, so there is no
    // reason to refetch it during a session.
    staleTime: Infinity,
    queryFn: async (): Promise<GrammarRule[]> => {
      const { data, error } = await supabase
        .from('grammar_rules')
        .select('*')
        .order('cefr', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
