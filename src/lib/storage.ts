import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter for the Supabase auth session.
 *
 * Auth tokens are credentials, so on device they go into SecureStore (Android
 * Keystore / iOS Keychain) rather than AsyncStorage, which is plain unencrypted
 * files readable on a rooted device.
 *
 * The catch: SecureStore has a ~2 KB value limit and a Supabase session (JWT +
 * refresh token + user object) can exceed it. So values are split into fixed
 * size chunks, with an index key recording how many chunks a value occupies.
 *
 * On web SecureStore does not exist, so we fall back to AsyncStorage.
 */

const CHUNK_SIZE = 1800;
const isWeb = Platform.OS === 'web';

/** Number of chunks a key currently occupies, or 0 if absent. */
async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}__chunks`);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function clearChunks(key: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(`${key}__${i}`));
  }
  deletions.push(SecureStore.deleteItemAsync(`${key}__chunks`));
  await Promise.all(deletions);
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return AsyncStorage.getItem(key);

    const count = await readChunkCount(key);
    if (count === 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}__${i}`),
      ),
    );

    // A missing chunk means the value is corrupt (interrupted write, partial
    // wipe). Returning a truncated session would fail in confusing ways later,
    // so treat it as absent and let Supabase re-authenticate.
    if (parts.some((p) => p == null)) {
      await clearChunks(key, count);
      return null;
    }

    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) return AsyncStorage.setItem(key, value);

    // Remove any longer previous value first, or its trailing chunks would be
    // read back as part of the new one.
    const previous = await readChunkCount(key);
    if (previous > 0) await clearChunks(key, previous);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__${i}`, chunk)),
    );
    await SecureStore.setItemAsync(`${key}__chunks`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) return AsyncStorage.removeItem(key);

    const count = await readChunkCount(key);
    if (count > 0) await clearChunks(key, count);
  },
};
