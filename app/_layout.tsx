import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureAudioSession } from '@/services/audio';
import { initDatabase } from '@/services/db';
import { useSettingsStore } from '@/state';
import { light } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const audioMode = useSettingsStore((s) => s.settings.audioOutputMode);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initDatabase();
        await configureAudioSession(audioMode);
      } catch (err) {
        console.warn('[init] startup failed', err);
      } finally {
        if (mounted) SplashScreen.hideAsync().catch(() => {});
      }
    })();
    return () => {
      mounted = false;
    };
    // Run once on startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: light.base },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="drill/active" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="drill/summary" options={{ presentation: 'card' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
