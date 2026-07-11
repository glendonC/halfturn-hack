import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { configureAudioSession } from '@/services/audio';
import { getDatabase } from '@/services/db';
import { useSettingsStore } from '@/state';
import { colors } from '@/theme';

export default function RootLayout() {
  const audioMode = useSettingsStore((s) => s.settings.audioOutputMode);

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        await configureAudioSession(audioMode);
      } catch (err) {
        console.warn('[init] startup failed', err);
      }
    })();
    // Run once on startup — settings hydrate synchronously from kv-store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="drill/active"
          options={{ gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen name="drill/framing" options={{ presentation: 'card' }} />
        <Stack.Screen name="drill/summary" options={{ presentation: 'card' }} />
        <Stack.Screen name="session/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
