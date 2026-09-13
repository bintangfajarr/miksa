import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export type TabKey = 'chat' | 'collection' | 'profile';

const TABS: Array<{ key: TabKey; label: string; glyph: string }> = [
  { key: 'chat', label: 'Ngobrol', glyph: '💬' },
  { key: 'collection', label: 'Koleksi', glyph: '📓' },
  { key: 'profile', label: 'Kamu', glyph: '👤' },
];

/**
 * Three tabs, hand-rolled.
 *
 * React Navigation is the right answer for deep linking, stacks, and back
 * handling. None of that is needed for three flat screens, and it brings
 * gesture-handler, reanimated, and screens with it — a native-module surface
 * that would take Expo Go out of the loop.
 *
 * Revisit if the app grows stacks or needs deep links.
 */
export function TabBar({
  active,
  onChange,
  badge,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  badge?: Partial<Record<TabKey, number>>;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const count = badge?.[tab.key] ?? 0;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <View>
              <Text style={[styles.glyph, !isActive && styles.inactive]}>
                {tab.glyph}
              </Text>
              {count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
    paddingTop: theme.space(2),
    paddingBottom: theme.space(5),
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabPressed: { opacity: 0.6 },
  glyph: { fontSize: 20 },
  inactive: { opacity: 0.45 },
  label: { color: theme.color.textMuted, fontSize: 11 },
  labelActive: { color: theme.color.text, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: theme.color.text, fontSize: 10, fontWeight: '700' },
});
