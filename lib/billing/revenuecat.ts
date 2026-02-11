import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { logBillingError, logBillingInfo, logBillingWarning } from './telemetry';

const entitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'premium';

let configured = false;
let currentUserId: string | null = null;

type CustomerInfoListener = (customerInfo: CustomerInfo) => void;

type PurchasesWithCustomerInfoListener = typeof Purchases & {
  addCustomerInfoUpdateListener?: (listener: CustomerInfoListener) => void;
  removeCustomerInfoUpdateListener?: (listener: CustomerInfoListener) => void;
};

const getApiKey = () => {
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  }

  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  }

  return null;
};

const canUseRevenueCat = () => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  return Boolean(getApiKey());
};

export const isRevenueCatReady = () => configured && canUseRevenueCat();

export const initializeRevenueCat = async (appUserId?: string | null) => {
  const apiKey = getApiKey();

  if (!apiKey || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    if (__DEV__) {
      console.warn('RevenueCat is not configured. Missing platform API key or unsupported platform.');
    }
    logBillingWarning('revenuecat_initialize_skipped', {
      platform: Platform.OS,
      hasApiKey: Boolean(apiKey),
    });
    return false;
  }

  try {
    if (!configured) {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({
        apiKey,
        appUserID: appUserId ?? undefined,
      });
      configured = true;
      currentUserId = appUserId ?? null;

      logBillingInfo('revenuecat_initialized', {
        platform: Platform.OS,
        hasUserId: Boolean(appUserId),
      });
      return true;
    }

    await syncRevenueCatUser(appUserId ?? null);
    return true;
  } catch (error) {
    configured = false;
    currentUserId = null;
    logBillingError('revenuecat_initialize_failed', error, {
      platform: Platform.OS,
      hasUserId: Boolean(appUserId),
    });
    return false;
  }
};

export const syncRevenueCatUser = async (appUserId: string | null) => {
  if (!configured || !canUseRevenueCat()) {
    return;
  }

  if (appUserId && currentUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    currentUserId = appUserId;
    return;
  }

  if (!appUserId && currentUserId) {
    await Purchases.logOut();
    currentUserId = null;
  }
};

export const getOfferings = async (): Promise<PurchasesOfferings | null> => {
  if (!configured || !canUseRevenueCat()) {
    return null;
  }

  return Purchases.getOfferings();
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  if (!configured || !canUseRevenueCat()) {
    return null;
  }

  return Purchases.getCustomerInfo();
};

export const addCustomerInfoListener = (listener: CustomerInfoListener) => {
  if (!isRevenueCatReady()) {
    return () => {
      // no-op
    };
  }

  const purchasesClient = Purchases as PurchasesWithCustomerInfoListener;

  if (
    typeof purchasesClient.addCustomerInfoUpdateListener !== 'function'
    || typeof purchasesClient.removeCustomerInfoUpdateListener !== 'function'
  ) {
    return () => {
      // no-op
    };
  }

  purchasesClient.addCustomerInfoUpdateListener(listener);

  return () => {
    purchasesClient.removeCustomerInfoUpdateListener?.(listener);
  };
};

export const purchasePackage = async (selectedPackage: PurchasesPackage) => {
  if (!configured || !canUseRevenueCat()) {
    throw new Error('RevenueCat is not configured.');
  }

  return Purchases.purchasePackage(selectedPackage);
};

export const restorePurchases = async () => {
  if (!configured || !canUseRevenueCat()) {
    throw new Error('RevenueCat is not configured.');
  }

  return Purchases.restorePurchases();
};

export const hasPremiumAccess = (customerInfo: CustomerInfo | null, overrideEntitlementId?: string) => {
  if (!customerInfo) {
    return false;
  }

  const resolvedEntitlementId = overrideEntitlementId || entitlementId;
  return Boolean(customerInfo.entitlements.active[resolvedEntitlementId]);
};

export const getEntitlementId = () => entitlementId;
