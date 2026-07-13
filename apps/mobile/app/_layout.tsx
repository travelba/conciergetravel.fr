import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Native: theme via `lib/theme.ts` (mirrors `@mch/ui-v2/tokens.css`). Web: `_layout.web.tsx`. */

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#f6f1e7' },
          headerTintColor: '#3a352d',
          headerTitleStyle: { fontFamily: 'Georgia' },
          contentStyle: { backgroundColor: '#f6f1e7' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'MyConciergeHotel' }} />
        <Stack.Screen name="search" options={{ title: 'Recherche' }} />
        <Stack.Screen name="hotel/[slug]" options={{ title: 'Fiche hôtel' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
