import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { pb, initializePocketBase, isAuthenticated, subscribeToAuthChanges } from '../lib/pocketbase';
// TODO: PostHog - import { PostHogProvider } from '../lib/posthog';

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
  
  if (!isReady) {
    return null; // Or a loading screen
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
