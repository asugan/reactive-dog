import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { addCustomerInfoListener, hasPremiumAccess } from './revenuecat';
import { getPremiumAccessStateFromRevenueCat, type PremiumAccessStatus } from './access';
import { logBillingError, logBillingInfo } from './telemetry';
import { initializeLocalApp } from '../localApp';

interface SubscriptionContextValue {
  status: PremiumAccessStatus;
  isLoading: boolean;
  error: string | null;
  lastCheckedAt: string | null;
  refresh: () => Promise<void>;
}

const defaultContextValue: SubscriptionContextValue = {
  status: 'unknown',
  isLoading: true,
  error: null,
  lastCheckedAt: null,
  refresh: async () => {
    // no-op
  },
};

const SubscriptionContext = createContext<SubscriptionContextValue>(defaultContextValue);

export const SubscriptionProvider = ({ children }: PropsWithChildren) => {
  const [status, setStatus] = useState<PremiumAccessStatus>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      await initializeLocalApp();

      const nextState = await getPremiumAccessStateFromRevenueCat();
      setStatus(nextState.status);
      setError(nextState.errorMessage ?? null);
      setLastCheckedAt(nextState.checkedAt);

      logBillingInfo('subscription_status_refreshed', {
        status: nextState.status,
      });
    } catch (refreshError) {
      logBillingError('subscription_refresh_failed', refreshError);
      setStatus('unknown');
      setError('Subscription status is temporarily unavailable.');
      setLastCheckedAt(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeCustomerInfo = () => {
      // no-op
    };

    refresh().then(() => {
      unsubscribeCustomerInfo = addCustomerInfoListener((customerInfo) => {
        const nextStatus = hasPremiumAccess(customerInfo) ? 'active' : 'inactive';
        setStatus(nextStatus);
        setError(null);
        setLastCheckedAt(new Date().toISOString());

        logBillingInfo('subscription_status_listener_update', {
          status: nextStatus,
        });
      });
    }).catch((listenerSetupError) => {
      logBillingError('subscription_listener_setup_failed', listenerSetupError);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') {
        return;
      }

      refresh().catch((resumeRefreshError) => {
        logBillingError('subscription_refresh_on_resume_failed', resumeRefreshError);
      });
    });

    return () => {
      unsubscribeCustomerInfo();
      appStateSubscription.remove();
    };
  }, [refresh]);

  const contextValue = useMemo<SubscriptionContextValue>(() => {
    return {
      status,
      isLoading,
      error,
      lastCheckedAt,
      refresh,
    };
  }, [error, isLoading, lastCheckedAt, refresh, status]);

  return <SubscriptionContext.Provider value={contextValue}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  return useContext(SubscriptionContext);
};
