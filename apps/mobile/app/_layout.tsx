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
          <Stack.Screen name="craving" options={{ title: 'Nivora' }} />
          <Stack.Screen name="relapse" options={{ title: 'Nivora' }} />
          <Stack.Screen name="coach" options={{ title: 'Coach' }} />
          <Stack.Screen name="checkin" options={{ title: 'Nivora' }} />
          <Stack.Screen name="rebuild" options={{ title: 'Nivora' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
