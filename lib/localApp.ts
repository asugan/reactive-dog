import { initializeRevenueCat } from './billing/revenuecat';
import { logBillingError, logBillingWarning } from './billing/telemetry';
import { initializeLocalData } from './data/database';
import { ensureLocalOwnerId } from './data/repositories/settingsRepo';

let initializePromise: Promise<string> | null = null;

export const initializeLocalApp = async () => {
  if (!initializePromise) {
    initializePromise = (async () => {
      await initializeLocalData();
      const ownerId = await ensureLocalOwnerId();

      try {
        const initialized = await initializeRevenueCat(ownerId);
        if (!initialized) {
          logBillingWarning('revenuecat_not_initialized_during_bootstrap', {
            ownerId,
          });
        }
      } catch (error) {
        logBillingError('revenuecat_bootstrap_failed', error, {
          ownerId,
        });
      }

      return ownerId;
    })().catch((error) => {
      initializePromise = null;
      throw error;
    });
  }

  return initializePromise;
};

export const getLocalOwnerId = async () => {
  return initializeLocalApp();
};
