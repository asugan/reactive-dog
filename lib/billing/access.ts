import { getCustomerInfo, hasPremiumAccess, isRevenueCatReady } from './revenuecat';
import { logBillingError } from './telemetry';

export type PremiumAccessStatus = 'active' | 'inactive' | 'unknown';

export interface PremiumAccessState {
  status: PremiumAccessStatus;
  checkedAt: string;
  errorMessage?: string;
}

export const getPremiumAccessStateFromRevenueCat = async (): Promise<PremiumAccessState> => {
  const checkedAt = new Date().toISOString();

  if (!isRevenueCatReady()) {
    return {
      status: 'unknown',
      checkedAt,
      errorMessage: 'RevenueCat is not ready.',
    };
  }

  try {
    const customerInfo = await getCustomerInfo();

    if (!customerInfo) {
      return {
        status: 'unknown',
        checkedAt,
        errorMessage: 'Customer info is unavailable.',
      };
    }

    return {
      status: hasPremiumAccess(customerInfo) ? 'active' : 'inactive',
      checkedAt,
    };
  } catch (error) {
    logBillingError('premium_access_check_failed', error);
    return {
      status: 'unknown',
      checkedAt,
      errorMessage: 'RevenueCat access check failed.',
    };
  }
};
