import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from './src/lib/queryClient';
import { ChatScreen } from './src/screens/ChatScreen';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <ChatScreen />
    </QueryClientProvider>
  );
}
