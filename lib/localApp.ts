import { initializeRevenueCat } from './billing/revenuecat';
import { initializeLocalData } from './data/database';
import { ensureLocalOwnerId } from './data/repositories/settingsRepo';

let initializePromise: Promise<string> | null = null;

export const initializeLocalApp = async () => {
  if (!initializePromise) {
    initializePromise = (async () => {
      await initializeLocalData();
      const ownerId = await ensureLocalOwnerId();
      await initializeRevenueCat(ownerId);
      return ownerId;
    })();
  }

  return initializePromise;
};

export const getLocalOwnerId = async () => {
  return initializeLocalApp();
};
