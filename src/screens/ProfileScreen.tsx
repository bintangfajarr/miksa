import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProfile, useStreak, useUpdateProfile } from '../hooks/useProfile';
import { useQuota } from '../hooks/useChat';
import { theme } from '../theme';
import type { CefrLevel, ExplainIn } from '../types/database';

const LEVELS: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];
const VOCAB_COUNTS = [3, 5, 8, 10];

const EXPLAIN_OPTIONS: Array<{ value: ExplainIn; label: string; hint: string }> = [
  { value: 'id', label: 'Indonesia', hint: 'Paling gampang dipahami' },
  { value: 'mix', label: 'Campur', hint: 'Inggris sederhana + Indonesia' },
  { value: 'en', label: 'Inggris', hint: 'Buat yang udah pede' },
];

export function ProfileScreen({ enabled }: { enabled: boolean }) {
  const profile = useProfile(enabled);
  const streak = useStreak(enabled);
  const quota = useQuota(enabled);
  const update = useUpdateProfile();

  if (profile.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  const p = profile.data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Kamu</Text>

      <View style={styles.statRow}>
        <Stat
          value={streak.data?.streak_days ?? 0}
          label={streak.data?.active_today ? 'hari berturut' : 'hari — ayo mulai'}
          highlight={Boolean(streak.data?.streak_days)}
        />
        <Stat
          value={quota.data ? Math.max(quota.data.cap - quota.data.used, 0) : '–'}
          label="chat tersisa hari ini"
        />
      </View>

      <Section
        title="Level kamu"
        hint="Menentukan seberapa sulit bahasa yang dipakai Miksa."
      >
        <Choices
          options={LEVELS.map((l) => ({ value: l, label: l }))}
          selected={p?.cefr_level}
          onSelect={(v) => update.mutate({ cefr_level: v as CefrLevel })}
        />
      </Section>

      <Section
        title="Koreksi dijelaskan pakai"
        hint="Penjelasan grammar di kartu koreksi."
      >
        <View style={styles.stack}>
          {EXPLAIN_OPTIONS.map((opt) => {
            const active = p?.explain_in === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => update.mutate({ explain_in: opt.value })}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.rowHint}>{opt.hint}</Text>
                </View>
                {active && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section
        title="Kata baru per hari"
        hint="Jumlah kosakata yang dikirim tiap pagi."
      >
        <Choices
          options={VOCAB_COUNTS.map((n) => ({ value: String(n), label: String(n) }))}
          selected={p ? String(p.vocab_per_day) : undefined}
          onSelect={(v) => update.mutate({ vocab_per_day: Number(v) })}
        />
      </Section>

      <Text style={styles.footnote}>
        Miksa bales pakai bahasa Inggris, dan koreksinya dijelaskan pakai bahasa
        yang kamu pilih di atas. Bahasa Indonesia kamu nggak pernah dikoreksi —
        campur-campur itu wajar.
      </Text>
    </ScrollView>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: number | string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statValueHot]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
      {children}
    </View>
  );
}

function Choices({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: string; label: string }>;
  selected?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
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
  },
  content: {
    padding: theme.space(5),
    paddingTop: theme.space(14),
    gap: theme.space(6),
  },
  title: {
    color: theme.color.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  statRow: { flexDirection: 'row', gap: theme.space(3) },
  stat: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space(4),
    gap: 2,
  },
  statValue: { color: theme.color.text, fontSize: 28, fontWeight: '700' },
  statValueHot: { color: theme.color.accent },
  statLabel: { color: theme.color.textMuted, fontSize: 12, lineHeight: 16 },
  section: { gap: theme.space(2) },
  sectionTitle: { color: theme.color.text, fontSize: 15, fontWeight: '600' },
  sectionHint: {
    color: theme.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: theme.space(1),
  },
  chips: { flexDirection: 'row', gap: theme.space(2), flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipActive: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  chipText: { color: theme.color.textMuted, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: theme.color.text },
  stack: { gap: theme.space(2) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  rowActive: { borderColor: theme.color.accent },
  rowText: { gap: 1, flexShrink: 1 },
  rowLabel: { color: theme.color.textMuted, fontSize: 14, fontWeight: '600' },
  rowLabelActive: { color: theme.color.text },
  rowHint: { color: theme.color.textMuted, fontSize: 11 },
  check: { color: theme.color.accent, fontSize: 15, fontWeight: '700' },
  footnote: {
    color: theme.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: theme.space(4),
  },
});
