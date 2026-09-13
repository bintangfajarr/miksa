import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CorrectionCard } from '../components/CorrectionCard';
import {
  ChatError,
  useCorrections,
  useDismissCorrection,
  useMessages,
  useQuota,
  useRuleMap,
  useSendMessage,
} from '../hooks/useChat';
import { useStreak } from '../hooks/useProfile';
import { useSession } from '../hooks/useSession';
import { theme } from '../theme';
import type { Message } from '../types/database';

export function ChatScreen() {
  const session = useSession();
  const ready = session.status === 'ready';

  const messages = useMessages(ready);
  const corrections = useCorrections(ready);
  const rules = useRuleMap(ready);
  const quota = useQuota(ready);
  const streak = useStreak(ready);
  const send = useSendMessage();
  const dismiss = useDismissCorrection();

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    if (messages.data?.length) scrollToEnd();
  }, [messages.data?.length, scrollToEnd]);

  const exhausted = quota.data != null && quota.data.used >= quota.data.cap;
  const disabled = send.isPending || !ready || exhausted;

  const onSend = () => {
    const text = draft.trim();
    if (!text || disabled) return;

    setDraft('');
    send.mutate(text, {
      // Give the text back rather than making them retype it. A failed send
      // still costs one of the 50 daily requests.
      onError: () => setDraft(text),
      onSuccess: scrollToEnd,
    });
  };

  if (session.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  if (session.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Tidak bisa masuk</Text>
        <Text style={styles.errorBody}>{session.error.message}</Text>
      </View>
    );
  }

  const remaining = quota.data
    ? Math.max(quota.data.cap - quota.data.used, 0)
    : null;
  const streakDays = streak.data?.streak_days ?? 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Miksa</Text>
          {streakDays > 0 && (
            <View style={styles.streak}>
              <Text style={styles.streakText}>🔥 {streakDays}</Text>
            </View>
          )}
        </View>
        {remaining != null && (
          <Text style={[styles.quota, exhausted && styles.quotaBad]}>
            {remaining} chat tersisa
          </Text>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages.data ?? []}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => (
          <View>
            <Bubble message={item} />
            {corrections.data?.[item.id]?.map((c) => (
              <CorrectionCard
                key={c.id}
                correction={c}
                rule={c.rule_id ? rules.data?.[c.rule_id] : undefined}
                onDismiss={dismiss.mutate}
              />
            ))}
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={messages.isPending ? null : <EmptyState />}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      />

      {send.isPending && (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color={theme.color.textMuted} />
          <Text style={styles.typingText}>Miksa lagi ngetik…</Text>
        </View>
      )}

      {send.data?.degraded && !send.isPending && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerText}>
            Balasannya masuk, tapi koreksinya gagal diproses kali ini.
          </Text>
        </View>
      )}

      {send.isError && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {send.error instanceof ChatError
              ? send.error.message
              : 'Ada yang error. Coba lagi.'}
          </Text>
        </View>
      )}

      {exhausted && !send.isError && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Jatah chat hari ini sudah habis. Balik lagi besok ya.
          </Text>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Tulis apa aja, campur juga nggak apa-apa…"
          placeholderTextColor={theme.color.textMuted}
          multiline
          maxLength={2000}
          editable={!disabled}
        />
        <Pressable
          onPress={onSend}
          disabled={disabled || !draft.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (disabled || !draft.trim()) && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          <Text style={styles.sendLabel}>Kirim</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={styles.bubbleText}>{message.content}</Text>
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Ngobrol aja dulu</Text>
      <Text style={styles.emptyBody}>
        Tulis pakai bahasa apa aja — Indonesia, Inggris, atau campur. Miksa
        bakal bales pakai bahasa Inggris, dan kalau ada yang keliru, dijelasin
        pakai bahasa Indonesia.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  centered: {
    flex: 1,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(8),
    gap: theme.space(2),
  },
  header: {
    paddingTop: theme.space(14),
    paddingHorizontal: theme.space(5),
    paddingBottom: theme.space(3),
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
  },
  brand: {
    color: theme.color.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  streak: {
    backgroundColor: theme.color.surfaceAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space(2),
    paddingVertical: 2,
  },
  streakText: { color: theme.color.text, fontSize: 12, fontWeight: '600' },
  quota: { color: theme.color.textMuted, fontSize: 12 },
  quotaBad: { color: theme.color.wrong },
  list: { padding: theme.space(4), gap: theme.space(3), flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  bubbleMine: { backgroundColor: theme.color.accent },
  bubbleTheirs: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  bubbleText: { color: theme.color.text, fontSize: 15, lineHeight: 21 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingHorizontal: theme.space(5),
    paddingBottom: theme.space(2),
  },
  typingText: { color: theme.color.textMuted, fontSize: 12 },
  banner: {
    marginHorizontal: theme.space(4),
    marginBottom: theme.space(2),
    padding: theme.space(3),
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.wrong,
  },
  bannerWarn: { borderColor: theme.color.border },
  bannerText: { color: theme.color.text, fontSize: 13, lineHeight: 18 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space(2),
    padding: theme.space(3),
    paddingBottom: theme.space(6),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: theme.color.text,
    backgroundColor: theme.color.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(5),
    paddingVertical: theme.space(3),
  },
  sendButtonDisabled: { backgroundColor: theme.color.border },
  sendButtonPressed: { opacity: 0.7 },
  sendLabel: { color: theme.color.text, fontSize: 14, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(8),
    gap: theme.space(2),
  },
  emptyTitle: { color: theme.color.text, fontSize: 17, fontWeight: '600' },
  emptyBody: {
    color: theme.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorTitle: { color: theme.color.wrong, fontSize: 16, fontWeight: '600' },
  errorBody: { color: theme.color.text, fontSize: 13, lineHeight: 19 },
});
