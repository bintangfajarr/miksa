import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCorrections, useRuleMap } from '../hooks/useChat';
import { theme } from '../theme';

/**
 * Placeholder for M3.
 *
 * The real collection screen groups corrections by rule_id and ranks them by
 * frequency — "here are the three rules you break most". Its entire value
 * depends on those rule_ids being accurate, and that is exactly what the M2
 * benchmark has not yet confirmed (bench/README.md).
 *
 * Rather than build the ranking on unvalidated data, this shows the raw count
 * and says so. Honest, and cheap to replace.
 */
export function CollectionScreen({ enabled }: { enabled: boolean }) {
  const corrections = useCorrections(enabled);
  const rules = useRuleMap(enabled);

  const all = Object.values(corrections.data ?? {}).flat();
  const classified = all.filter((c) => c.rule_id != null);

  const counts = new Map<string, number>();
  for (const c of classified) {
    if (c.rule_id) counts.set(c.rule_id, (counts.get(c.rule_id) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Koleksi</Text>
      <Text style={styles.subtitle}>
        Kesalahan yang paling sering kamu ulangi.
      </Text>

      {all.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Belum ada apa-apa di sini</Text>
          <Text style={styles.emptyBody}>
            Setiap kali Miksa mengoreksi bahasa Inggris kamu, koreksinya
            dikumpulkan di sini dan dikelompokkan per aturan grammar. Ngobrol
            dulu beberapa kali, nanti mulai kelihatan polanya.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryValue}>{all.length}</Text>
            <Text style={styles.summaryLabel}>
              koreksi terkumpul · {ranked.length} aturan berbeda
            </Text>
          </View>

          {ranked.map(([ruleId, count]) => {
            const rule = rules.data?.[ruleId];
            return (
              <View key={ruleId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {rule?.title_id ?? ruleId}
                  </Text>
                  <Text style={styles.count}>{count}×</Text>
                </View>
                {rule && (
                  <Text style={styles.explanation}>{rule.explanation_id}</Text>
                )}
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.note}>
        Layar ini masih sederhana — pengelompokan dan grafik progres menyusul di
        M3.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  content: {
    padding: theme.space(5),
    paddingTop: theme.space(14),
    gap: theme.space(3),
  },
  title: {
    color: theme.color.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontSize: 13,
    marginBottom: theme.space(2),
  },
  summary: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space(4),
    gap: 2,
  },
  summaryValue: { color: theme.color.text, fontSize: 28, fontWeight: '700' },
  summaryLabel: { color: theme.color.textMuted, fontSize: 12 },
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
  cardTitle: {
    color: theme.color.text,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  count: { color: theme.color.accent, fontSize: 13, fontWeight: '700' },
  explanation: { color: theme.color.textMuted, fontSize: 13, lineHeight: 18 },
  empty: {
    paddingVertical: theme.space(10),
    alignItems: 'center',
    gap: theme.space(2),
  },
  emptyTitle: { color: theme.color.text, fontSize: 16, fontWeight: '600' },
  emptyBody: {
    color: theme.color.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  note: {
    color: theme.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: theme.space(2),
    paddingBottom: theme.space(4),
  },
});
