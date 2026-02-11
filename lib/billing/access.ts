import type { CustomerInfo } from 'react-native-purchases';
import { getCustomerInfo, getEntitlementId, hasPremiumAccess, isRevenueCatReady } from './revenuecat';
import { logBillingError } from './telemetry';

export type PremiumAccessStatus = 'active' | 'trial' | 'inactive' | 'unknown';

export interface PremiumAccessState {
  status: PremiumAccessStatus;
  checkedAt: string;
  errorMessage?: string;
}

const resolveEntitlementPeriodType = (customerInfo: CustomerInfo) => {
  const entitlement = customerInfo.entitlements.active[getEntitlementId()] as
    | { periodType?: string }
    | undefined;

  const periodType = entitlement?.periodType;
  if (typeof periodType !== 'string') {
    return null;
  }

  return periodType.toLowerCase();
};

export const resolvePremiumAccessStatus = (customerInfo: CustomerInfo | null): PremiumAccessStatus => {
  if (!customerInfo) {
    return 'unknown';
  }

  if (!hasPremiumAccess(customerInfo)) {
    return 'inactive';
  }

  const periodType = resolveEntitlementPeriodType(customerInfo);
  if (periodType === 'trial') {
    return 'trial';
  }

  return 'active';
};

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
      status: resolvePremiumAccessStatus(customerInfo),
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
