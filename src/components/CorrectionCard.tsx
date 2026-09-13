import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { theme } from '../theme';
import type { SavedCorrection } from '../lib/api';
import type { GrammarRule } from '../types/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  correction: SavedCorrection;
  rule?: GrammarRule;
  onDismiss: (id: number) => void;
}

/**
 * One correction, collapsed by default.
 *
 * Collapsed state shows only wrong → right and the one-line Indonesian note.
 * The full rule explanation is one tap away rather than always on screen: the
 * conversation is the point, and a wall of grammar under every message is what
 * makes learners quit (SDD §6.3).
 */
export function CorrectionCard({ correction, rule, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = rule != null;

  const toggle = () => {
    if (!canExpand) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <Pressable onPress={toggle} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {rule?.title_id ?? 'Catatan'}
        </Text>
        <View style={styles.headerRight}>
          {rule && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{rule.cefr}</Text>
            </View>
          )}
          <Pressable
            onPress={() => onDismiss(correction.id)}
            hitSlop={10}
            style={styles.dismiss}
          >
            <Text style={styles.dismissText}>✕</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.diff}>
        <Text style={styles.wrong}>{correction.original}</Text>
        <Text style={styles.right}>{correction.corrected}</Text>
      </View>

      {correction.note ? (
        <Text style={styles.note}>{correction.note}</Text>
      ) : null}

      {expanded && rule && (
        <View style={styles.expanded}>
          <Text style={styles.explanation}>{rule.explanation_id}</Text>
          <View style={styles.exampleBlock}>
            <Text style={styles.exampleWrong}>✗ {rule.example_wrong}</Text>
            <Text style={styles.exampleRight}>✓ {rule.example_right}</Text>
          </View>
        </View>
      )}

      {canExpand && (
        <Text style={styles.more}>
          {expanded ? 'Tutup' : 'Pelajari aturannya'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space(3),
    gap: theme.space(2),
    marginTop: theme.space(1),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space(2),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
  },
  title: {
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: 1,
  },
  badgeText: { color: theme.color.accent, fontSize: 10, fontWeight: '700' },
  dismiss: { padding: 2 },
  dismissText: { color: theme.color.textMuted, fontSize: 13 },
  diff: { gap: 2 },
  wrong: {
    color: theme.color.wrong,
    fontSize: 14,
    lineHeight: 19,
    textDecorationLine: 'line-through',
  },
  right: { color: theme.color.right, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  note: { color: theme.color.text, fontSize: 13, lineHeight: 18 },
  expanded: {
    gap: theme.space(2),
    paddingTop: theme.space(2),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  explanation: { color: theme.color.text, fontSize: 13, lineHeight: 19 },
  exampleBlock: { gap: 2 },
  exampleWrong: { color: theme.color.wrong, fontSize: 12, lineHeight: 17 },
  exampleRight: { color: theme.color.right, fontSize: 12, lineHeight: 17 },
  more: { color: theme.color.accent, fontSize: 12, fontWeight: '600' },
});
