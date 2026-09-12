import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from './src/lib/queryClient';
import { ConnectionCheckScreen } from './src/screens/ConnectionCheckScreen';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <ConnectionCheckScreen />
    </QueryClientProvider>
  );
}
