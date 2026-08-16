import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { SessionProvider } from '../src/session';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="craving" options={{ title: 'Cleat' }} />
          <Stack.Screen name="relapse" options={{ title: 'Cleat' }} />
          <Stack.Screen name="coach" options={{ title: 'Coach' }} />
          <Stack.Screen name="checkin" options={{ title: 'Cleat' }} />
          <Stack.Screen name="rebuild" options={{ title: 'Cleat' }} />
          <Stack.Screen name="patterns" options={{ title: 'Cleat' }} />
          <Stack.Screen name="plan" options={{ title: 'Cleat' }} />
          <Stack.Screen name="settings" options={{ title: 'Cleat' }} />
          {/* Registered outside any auth gate on purpose: the moment somebody
              needs this screen, being asked to sign in first is a wall. */}
          <Stack.Screen name="kris" options={{ title: 'Cleat' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
