import { getCustomerInfo, hasPremiumAccess } from './revenuecat';

export const hasPremiumAccessFromRevenueCat = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    return hasPremiumAccess(customerInfo);
  } catch (error) {
    console.error('RevenueCat access check failed', error);
    return false;
  }
};
