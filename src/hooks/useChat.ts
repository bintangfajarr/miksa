import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ChatError,
  dismissCorrection,
  fetchCorrections,
  fetchQuota,
  sendChatMessage,
  type SavedCorrection,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import type { GrammarRule, Message } from '../types/database';

/** Optimistic rows get a negative id so they never collide with real ones. */
let tempId = -1;

export function useMessages(enabled: boolean) {
  return useQuery({
    queryKey: ['messages'],
    enabled,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCorrections(enabled: boolean) {
  return useQuery({
    queryKey: ['corrections'],
    enabled,
    queryFn: fetchCorrections,
  });
}

/** The rule catalogue, for expanding a correction into its full explanation. */
export function useRuleMap(enabled: boolean) {
  return useQuery({
    queryKey: ['grammar_rules'],
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<Record<string, GrammarRule>> => {
      const { data, error } = await supabase.from('grammar_rules').select('*');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.id, r]));
    },
  });
}

export function useQuota(enabled: boolean) {
  return useQuery({
    queryKey: ['quota'],
    enabled,
    queryFn: fetchQuota,
    staleTime: 60_000,
  });
}

export function useDismissCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dismissCorrection,
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ['corrections'] });
      const previous = qc.getQueryData<Record<number, SavedCorrection[]>>([
        'corrections',
      ]);

      qc.setQueryData<Record<number, SavedCorrection[]>>(
        ['corrections'],
        (current) => {
          if (!current) return current;
          const next: Record<number, SavedCorrection[]> = {};
          for (const [key, list] of Object.entries(current)) {
            const kept = list.filter((c) => c.id !== id);
            if (kept.length) next[Number(key)] = kept;
          }
          return next;
        },
      );

      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(['corrections'], ctx.previous);
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: sendChatMessage,

    // Show the user's own message immediately. Waiting for a round trip to
    // echo back your own typing feels broken, especially on mobile data.
    onMutate: async (content: string) => {
      await qc.cancelQueries({ queryKey: ['messages'] });
      const previous = qc.getQueryData<Message[]>(['messages']) ?? [];

      const optimistic: Message = {
        id: tempId--,
        user_id: '',
        role: 'user',
        content,
        lang_mix: null,
        created_at: new Date().toISOString(),
      };

      qc.setQueryData<Message[]>(['messages'], [...previous, optimistic]);
      return { previous, optimisticId: optimistic.id };
    },

    onError: (_error, _content, context) => {
      // Roll back. The composer restores the text so the user does not have to
      // retype it — a failed send still costs one of the 50 daily requests.
      if (context?.previous) qc.setQueryData(['messages'], context.previous);
    },

    onSuccess: (response, content, context) => {
      const now = new Date().toISOString();

      qc.setQueryData<Message[]>(['messages'], (current) => {
        const rows = (current ?? []).filter((m) => m.id !== context?.optimisticId);
        return [
          ...rows,
          {
            id: response.user_message_id,
            user_id: '',
            role: 'user' as const,
            content,
            lang_mix: null,
            created_at: now,
          },
          {
            id: response.assistant_message_id ?? tempId--,
            user_id: '',
            role: 'assistant' as const,
            content: response.reply,
            lang_mix: null,
            created_at: now,
          },
        ];
      });

      // Attach the new corrections to the message that caused them, without
      // refetching the whole set.
      if (response.corrections.length > 0) {
        qc.setQueryData<Record<number, SavedCorrection[]>>(
          ['corrections'],
          (current) => ({
            ...(current ?? {}),
            [response.user_message_id]: response.corrections,
          }),
        );
      }

      // The server is authoritative on quota; reuse what it just told us
      // rather than spending another round trip to ask.
      qc.setQueryData(['quota'], (q: unknown) =>
        q && typeof q === 'object'
          ? { ...q, used: response.quota.used, cap: response.quota.cap }
          : q,
      );
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: ['corrections'] });
    },
  });
}

export { ChatError };
export type { SavedCorrection };
