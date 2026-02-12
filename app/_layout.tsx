import { useCallback, useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { getByOwnerId } from '../lib/data/repositories/dogProfileRepo';
import { getOnboardingStep, isOnboardingComplete, type OnboardingStep } from '../lib/data/repositories/settingsRepo';
import { getLocalOwnerId, initializeLocalApp } from '../lib/localApp';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { SubscriptionProvider } from '../lib/billing/subscription';
import { PostHogProvider } from '../lib/posthog';
import { initializeNotifications } from '../lib/notifications/notificationService';

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

const getExpectedOnboardingPath = (step: OnboardingStep, hasDogProfile: boolean) => {
  if (!hasDogProfile) {
    return step === 'welcome' ? '/onboarding' : '/onboarding/dog-profile';
  }

  if (step === 'dog_profile') {
    return '/onboarding/dog-profile';
  }

  if (step === 'assessment') {
    return '/onboarding/assessment';
  }

  if (step === 'technique') {
    return '/onboarding/technique';
  }

  return '/onboarding';
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
      const currentOnboardingPath =
        topSegment === 'onboarding'
          ? segments[1]
            ? `/onboarding/${segments[1]}`
            : '/onboarding'
          : null;

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
        const [profile, onboardingComplete, onboardingStep] = await Promise.all([
          getByOwnerId(ownerId),
          isOnboardingComplete(),
          getOnboardingStep(),
        ]);

        const hasDogProfile = Boolean(profile);
        const isFullyOnboarded = hasDogProfile && onboardingComplete && onboardingStep === 'completed';

        if (!isFullyOnboarded) {
          const expectedPath = getExpectedOnboardingPath(onboardingStep, hasDogProfile);
          if (currentOnboardingPath !== expectedPath) {
            router.replace(expectedPath);
          }
        } else if (topSegment === 'onboarding' || !topSegment) {
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

  useEffect(() => {
    initializeNotifications().catch((error) => {
      console.error('Notification initialization failed:', error);
    });
  }, []);

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
      <PostHogProvider>
        <PaperProvider theme={appTheme}>
          <SubscriptionProvider>
            <RootLayoutNav />
          </SubscriptionProvider>
        </PaperProvider>
      </PostHogProvider>
    </SafeAreaProvider>
  );
}
