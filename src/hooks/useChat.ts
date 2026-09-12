import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ChatError, fetchQuota, sendChatMessage } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Message } from '../types/database';

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

export function useQuota(enabled: boolean) {
  return useQuery({
    queryKey: ['quota'],
    enabled,
    queryFn: fetchQuota,
    staleTime: 60_000,
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
      // Roll back the optimistic row. The composer restores the text so the
      // user does not have to retype it.
      if (context?.previous) qc.setQueryData(['messages'], context.previous);
    },

    onSuccess: (response, content, context) => {
      const now = new Date().toISOString();

      qc.setQueryData<Message[]>(['messages'], (current) => {
        const rows = (current ?? []).filter(
          (m) => m.id !== context?.optimisticId,
        );
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

      // The server is authoritative on quota; reuse what it just told us
      // rather than spending another round trip to ask.
      qc.setQueryData(['quota'], (q: unknown) =>
        q && typeof q === 'object'
          ? { ...q, used: response.quota.used, cap: response.quota.cap }
          : q,
      );
    },

    onSettled: () => {
      // Reconcile against the server: optimistic ids and timestamps are
      // approximations.
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export { ChatError };
