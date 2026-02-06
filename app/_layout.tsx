import { useCallback, useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { pb, initializePocketBase, isAuthenticated, subscribeToAuthChanges } from '../lib/pocketbase';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
// TODO: PostHog - import { PostHogProvider } from '../lib/posthog';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash screen was already prevented.
});

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      await initializePocketBase();
      
      if (!isAuthenticated()) {
        // Not authenticated, should be in auth group
        if (segments[0] !== '(auth)') {
          router.replace('/(auth)/login');
        }
      } else {
        // Authenticated, check if they have a dog profile
        const userId = pb.authStore.model?.id;
        try {
          const dogProfiles = await pb.collection('dog_profiles').getList(1, 1, {
            filter: `owner_id = "${userId}"`,
            $autoCancel: false,
          });
          
          const hasDogProfile = dogProfiles.items.length > 0;
          const inOnboarding = segments[0] === 'onboarding';
          const inAuth = segments[0] === '(auth)';
          
          if (!hasDogProfile && !inOnboarding && !inAuth) {
            // No dog profile and not in onboarding, redirect to onboarding
            router.replace('/onboarding');
          } else if (hasDogProfile && (inOnboarding || inAuth)) {
            // Has dog profile but in onboarding or auth, redirect to main app
            router.replace('/(tabs)');
          }
        } catch (error) {
          console.error('Error checking dog profile:', error);
        }
      }
      
      setIsReady(true);
    };

    checkAuth();

    // Listen for auth changes
    const unsubscribe = subscribeToAuthChanges(() => {
      if (!isAuthenticated()) {
        router.replace('/(auth)/login');
      }
    });

    return () => unsubscribe();
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
      <PaperProvider>
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
