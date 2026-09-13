import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

const KEY = 'miksa.query-cache.v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Queries worth keeping on disk.
 *
 * Deliberately a whitelist, not a blacklist. Quota is excluded because a stale
 * count is worse than none — showing "40 tersisa" from yesterday invites the
 * user to start a conversation that will be refused.
 */
const PERSISTED = new Set(['messages', 'corrections', 'grammar_rules', 'profile']);

interface Snapshot {
  savedAt: number;
  entries: Array<{ key: unknown[]; data: unknown }>;
}

/**
 * Minimal cache persistence so the app opens to content rather than a spinner
 * (SDD §8, M5). Chat history, corrections, and the rule catalogue are all
 * readable offline; only sending needs the network.
 *
 * A hand-rolled version of @tanstack/query-persist-client rather than the
 * package: this needs about forty lines, and the package pulls in a
 * persistence layer with its own version coupling to the query client.
 */
export async function hydrateCache(client: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;

    const snapshot = JSON.parse(raw) as Snapshot;
    if (Date.now() - snapshot.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(KEY);
      return;
    }

    for (const entry of snapshot.entries) {
      // Seed the cache as already-stale so React Query refetches in the
      // background: the user sees content instantly, then it corrects itself.
      client.setQueryData(entry.key, entry.data, { updatedAt: snapshot.savedAt });
    }
  } catch (err) {
    // A corrupt cache must never stop the app from starting.
    console.warn('Cache hydrate failed:', err);
    await AsyncStorage.removeItem(KEY).catch(() => {});
  }
}

export function startCachePersistence(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = async () => {
    try {
      const entries = client
        .getQueryCache()
        .getAll()
        .filter((q) => {
          const root = q.queryKey[0];
          return (
            typeof root === 'string' &&
            PERSISTED.has(root) &&
            q.state.status === 'success' &&
            q.state.data !== undefined
          );
        })
        .map((q) => ({ key: [...q.queryKey], data: q.state.data }));

      if (entries.length === 0) return;

      await AsyncStorage.setItem(
        KEY,
        JSON.stringify({ savedAt: Date.now(), entries } satisfies Snapshot),
      );
    } catch (err) {
      console.warn('Cache persist failed:', err);
    }
  };

  // Debounced: a chat turn mutates the cache several times in a row, and
  // serialising the whole thing on each one would jank the UI mid-animation.
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void save(), 1500);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    void save();
  };
}

export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
