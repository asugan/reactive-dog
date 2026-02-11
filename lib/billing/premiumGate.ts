import { useCallback } from 'react';
import { router } from 'expo-router';
import { useSubscription } from './subscription';

export const usePremiumGate = (source: string) => {
  const subscription = useSubscription();
  const hasPremiumAccess = subscription.status === 'active' || subscription.status === 'trial';

  const openPaywall = useCallback(() => {
    router.push({
      pathname: '/paywall',
      params: {
        source,
      },
    });
  }, [source]);

  const runWithPremium = useCallback((onAllowed: () => void, onUnknown?: () => void) => {
    if (hasPremiumAccess) {
      onAllowed();
      return;
    }

    if (subscription.status === 'inactive') {
      openPaywall();
      return;
    }

    if (onUnknown) {
      onUnknown();
    }
  }, [hasPremiumAccess, openPaywall, subscription.status]);

  return {
    ...subscription,
    isPremium: hasPremiumAccess,
    openPaywall,
    runWithPremium,
  };
};
