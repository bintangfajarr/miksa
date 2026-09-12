import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useGrammarRules } from '../hooks/useGrammarRules';
import { useSession } from '../hooks/useSession';
import { theme } from '../theme';
import type { GrammarRule } from '../types/database';

/**
 * M0 — the milestone screen.
 *
 * Its only job: prove the phone can reach Postgres through an authenticated,
 * RLS-protected connection. It gets replaced by the chat screen at M1.
 */
export function ConnectionCheckScreen() {
  const session = useSession();
  const rules = useGrammarRules(session.status === 'ready');

  if (session.status === 'loading') {
    return <Centered><ActivityIndicator color={theme.color.accent} /></Centered>;
  }

  if (session.status === 'error') {
    return (
      <Centered>
        <Text style={styles.errorTitle}>Tidak bisa masuk</Text>
        <Text style={styles.errorBody}>{session.error.message}</Text>
        <Text style={styles.hint}>
          Kalau ini soal env var, salin .env.example jadi .env lalu isi nilai
          dari Supabase. Kalau soal anonymous sign-in, aktifkan dulu di
          Authentication → Sign In / Providers.
        </Text>
      </Centered>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Miksa</Text>
      <Text style={styles.subtitle}>M0 — connection check</Text>

      <View style={styles.card}>
        <Row label="Auth" value="anonymous session aktif" ok />
        <Row
          label="User ID"
          value={`${session.session.user.id.slice(0, 8)}…`}
          ok
        />
        <Row
          label="Postgres"
          value={
            rules.isPending
              ? 'menghubungkan…'
              : rules.isError
                ? 'gagal'
                : `${rules.data?.length ?? 0} grammar rules`
          }
          ok={!rules.isError}
        />
      </View>

      {rules.isError && (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>Query gagal</Text>
          <Text style={styles.errorBody}>{rules.error.message}</Text>
          <Text style={styles.hint}>
            Sudah jalankan supabase/migrations/0001_init.sql dan
            supabase/seed.sql di SQL Editor?
          </Text>
        </View>
      )}

      {rules.isPending && !rules.isError && (
        <ActivityIndicator color={theme.color.accent} />
      )}

      {rules.data?.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
    </ScrollView>
  );
}

function RuleCard({ rule }: { rule: GrammarRule }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.ruleTitle}>{rule.title_id}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{rule.cefr}</Text>
        </View>
      </View>

      <Text style={styles.ruleId}>{rule.id}</Text>
      <Text style={styles.explanation}>{rule.explanation_id}</Text>

      <Text style={styles.wrong}>✗ {rule.example_wrong}</Text>
      <Text style={styles.right}>✓ {rule.example_right}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !ok && styles.rowValueBad]}>{value}</Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  content: {
    padding: theme.space(5),
    paddingTop: theme.space(16),
    gap: theme.space(3),
  },
  centered: {
    flex: 1,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(8),
    gap: theme.space(3),
  },
  title: {
    color: theme.color.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontSize: 14,
    marginBottom: theme.space(2),
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space(4),
    gap: theme.space(2),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.space(3),
  },
  rowLabel: {
    color: theme.color.textMuted,
    fontSize: 13,
  },
  rowValue: {
    color: theme.color.right,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  rowValueBad: {
    color: theme.color.wrong,
  },
  ruleTitle: {
    color: theme.color.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: theme.color.surfaceAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1),
  },
  badgeText: {
    color: theme.color.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  ruleId: {
    color: theme.color.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  explanation: {
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 20,
  },
  wrong: {
    color: theme.color.wrong,
    fontSize: 13,
    lineHeight: 18,
  },
  right: {
    color: theme.color.right,
    fontSize: 13,
    lineHeight: 18,
  },
  errorTitle: {
    color: theme.color.wrong,
    fontSize: 16,
    fontWeight: '600',
  },
  errorBody: {
    color: theme.color.text,
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: theme.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
