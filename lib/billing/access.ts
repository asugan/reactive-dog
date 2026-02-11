import { getCurrentUser, pb } from '../pocketbase';
import { getCustomerInfo, hasPremiumAccess } from './revenuecat';

const isProfilePremium = (profile: Record<string, unknown>) => {
  const tier = profile.subscription_tier;
  const expiresAt = profile.subscription_expires_at;

  if (tier !== 'premium') {
    return false;
  }

  if (!expiresAt || typeof expiresAt !== 'string') {
    return true;
  }

  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) {
    return true;
  }

  return expiresDate.getTime() > Date.now();
};

export const hasPremiumAccessWithFallback = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    if (hasPremiumAccess(customerInfo)) {
      return true;
    }
  } catch (error) {
    console.error('RevenueCat access check failed, falling back to profile tier', error);
  }

  const user = getCurrentUser();
  if (!user?.id) {
    return false;
  }

  try {
    const profile = await pb.collection('user_profiles').getFirstListItem(`user = "${user.id}"`, {
      requestKey: null,
    });
    return isProfilePremium(profile as unknown as Record<string, unknown>);
  } catch (error: any) {
    if (error?.status !== 404) {
      console.error('Failed to read user profile for premium fallback', error);
    }
    return false;
  }
};
