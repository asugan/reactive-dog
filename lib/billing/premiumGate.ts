import { useCallback } from 'react';
import { router } from 'expo-router';
import { useSubscription } from './subscription';

export const usePremiumGate = (source: string) => {
  const subscription = useSubscription();

  const openPaywall = useCallback(() => {
    router.push({
      pathname: '/paywall',
      params: {
        source,
      },
    });
  }, [source]);

  const runWithPremium = useCallback((onAllowed: () => void, onUnknown?: () => void) => {
    if (subscription.status === 'active') {
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
  }, [openPaywall, subscription.status]);

  return {
    ...subscription,
    isPremium: subscription.status === 'active',
    openPaywall,
    runWithPremium,
  };
};
