import { Slot } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// TODO: PostHog - import { PostHogProvider } from '../lib/posthog';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        {/* TODO: PostHog - Wrap with PostHogProvider when ready
        <PostHogProvider 
          apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
          options={{
            host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
          }}
        >
        */}
          <Slot />
        {/* TODO: PostHog - </PostHogProvider> */}
      </PaperProvider>
    </SafeAreaProvider>
  );
}
