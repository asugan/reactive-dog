import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
// TODO: PostHog - import { PostHogProvider } from '../lib/posthog';

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Not authenticated, should be in auth group
        if (segments[0] !== '(auth)') {
          router.replace('/(auth)/login');
        }
      } else {
        // Authenticated, check if they have a dog profile
        const { data: dogProfiles } = await supabase
          .from('dog_profiles')
          .select('id')
          .eq('owner_id', session.user.id)
          .limit(1);
        
        const hasDogProfile = dogProfiles && dogProfiles.length > 0;
        const inOnboarding = segments[0] === 'onboarding';
        const inAuth = segments[0] === '(auth)';
        
        if (!hasDogProfile && !inOnboarding && !inAuth) {
          // No dog profile and not in onboarding, redirect to onboarding
          router.replace('/onboarding');
        } else if (hasDogProfile && (inOnboarding || inAuth)) {
          // Has dog profile but in onboarding or auth, redirect to main app
          router.replace('/(tabs)');
        }
      }
      
      setIsReady(true);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [segments]);

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
