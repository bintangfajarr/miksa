import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { TabBar, type TabKey } from './src/components/TabBar';
import { useSession } from './src/hooks/useSession';
import { hydrateCache, startCachePersistence } from './src/lib/persist';
import { queryClient } from './src/lib/queryClient';
import { ChatScreen } from './src/screens/ChatScreen';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { theme } from './src/theme';

export default function App() {
  const [hydrated, setHydrated] = useState(false);

  // Load the disk cache before the first render that could fetch, so the app
  // opens to content instead of a spinner. Persistence starts after.
  useEffect(() => {
    let stop: (() => void) | undefined;

    hydrateCache(queryClient).finally(() => {
      setHydrated(true);
      stop = startCachePersistence(queryClient);
    });

    return () => stop?.();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      {hydrated ? <Shell /> : <View style={styles.blank} />}
    </QueryClientProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabKey>('chat');
  const session = useSession();
  const ready = session.status === 'ready';

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {/*
          All three stay mounted and are hidden with display:none rather than
          unmounted. Switching tabs should not drop the chat scroll position or
          re-trigger queries — and with three light screens the memory cost is
          nothing next to that.
        */}
        <Pane visible={tab === 'chat'}>
          <ChatScreen />
        </Pane>
        <Pane visible={tab === 'collection'}>
          <CollectionScreen enabled={ready && tab === 'collection'} />
        </Pane>
        <Pane visible={tab === 'profile'}>
          <ProfileScreen enabled={ready && tab === 'profile'} />
        </Pane>
      </View>

      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

function Pane({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.pane, !visible && styles.hidden]} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  body: { flex: 1 },
  pane: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hidden: { display: 'none' },
  blank: { flex: 1, backgroundColor: theme.color.bg },
});
