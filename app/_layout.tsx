import { useCallback, useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { getByOwnerId } from '../lib/data/repositories/dogProfileRepo';
import { getLocalOwnerId, initializeLocalApp } from '../lib/localApp';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
// TODO: PostHog - import { PostHogProvider } from '../lib/posthog';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash screen was already prevented.
});

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

const appTheme = {
  ...MD3LightTheme,
  roundness: 18,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1D4ED8',
    secondary: '#0F766E',
    tertiary: '#0EA5E9',
    surface: '#FFFFFF',
    background: '#F3F7FB',
    surfaceVariant: '#EAF0F8',
    outline: '#C7D2E3',
    outlineVariant: '#D9E2EC',
    elevation: {
      level0: 'transparent',
      level1: '#F8FAFF',
      level2: '#F1F6FF',
      level3: '#EAF2FF',
      level4: '#E3EEFF',
      level5: '#DCEAFF',
    },
  },
  fonts: {
    ...MD3LightTheme.fonts,
    displaySmall: {
      ...MD3LightTheme.fonts.displaySmall,
      fontWeight: '700' as const,
      letterSpacing: -0.3,
    },
    headlineMedium: {
      ...MD3LightTheme.fonts.headlineMedium,
      fontWeight: '700' as const,
      letterSpacing: -0.2,
    },
    titleLarge: {
      ...MD3LightTheme.fonts.titleLarge,
      fontWeight: '700' as const,
      letterSpacing: -0.1,
    },
    titleMedium: {
      ...MD3LightTheme.fonts.titleMedium,
      fontWeight: '600' as const,
    },
    labelLarge: {
      ...MD3LightTheme.fonts.labelLarge,
      fontWeight: '700' as const,
      letterSpacing: 0.2,
    },
    bodyLarge: {
      ...MD3LightTheme.fonts.bodyLarge,
      lineHeight: 24,
    },
  },
};

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkRoute = async () => {
      await initializeLocalApp();
      const ownerId = await getLocalOwnerId();
      const topSegment = segments[0];

      if (!ownerId) {
        if (topSegment !== 'onboarding') {
          router.replace('/onboarding');
        }

        if (mounted) {
          setIsReady(true);
        }

        return;
      }

      try {
        const profile = await getByOwnerId(ownerId);
        const hasDogProfile = Boolean(profile);
        const inOnboarding = topSegment === 'onboarding';

        if (!hasDogProfile && !inOnboarding) {
          router.replace('/onboarding');
        } else if (hasDogProfile && (inOnboarding || !topSegment)) {
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Error checking local dog profile:', error);
      }

      if (mounted) {
        setIsReady(true);
      }
    };

    checkRoute().catch((error) => {
      console.error('Route guard failed:', error);
      if (mounted) {
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [router, segments]);

  return isReady;
}

function RootLayoutNav() {
  const isReady = useProtectedRoute();
  const [isSplashDone, setIsSplashDone] = useState(false);

  const handleSplashComplete = useCallback(() => {
    SplashScreen.hideAsync().finally(() => {
      setIsSplashDone(true);
    });
  }, []);

  if (!isSplashDone) {
    return <AnimatedSplashScreen start={isReady} onComplete={handleSplashComplete} />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={appTheme}>
        {/* TODO: PostHog - Wrap with PostHogProvider when ready
        <PostHogProvider 
          apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
          options={{
            host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
          }}
        >
        */}
          <RootLayoutNav />
        {/* TODO: PostHog - </PostHogProvider> */}
      </PaperProvider>
    </SafeAreaProvider>
  );
}
