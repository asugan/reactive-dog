import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { getOfferings, hasPremiumAccess, purchasePackage, restorePurchases } from '../lib/billing/revenuecat';
import { useSubscription } from '../lib/billing/subscription';
import { logBillingError, logBillingInfo } from '../lib/billing/telemetry';

const FREE_TRIAL_DAYS = 7;

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const hasLoggedPaywallViewed = useRef(false);
  const { refresh: refreshSubscription } = useSubscription();
  const isMobilePlatform = Platform.OS === 'ios' || Platform.OS === 'android';

  const sourceLabel = useMemo(() => {
    if (!params.source) {
      return 'premium features';
    }

    return `${params.source}`;
  }, [params.source]);

  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL || null;
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL || null;

  const manageSubscriptionUrl = useMemo(() => {
    if (Platform.OS === 'ios') {
      return 'https://apps.apple.com/account/subscriptions';
    }

    if (Platform.OS === 'android') {
      return 'https://play.google.com/store/account/subscriptions';
    }

    return null;
  }, []);

  const legalDisclosureText = useMemo(() => {
    if (Platform.OS === 'android') {
      return [
        'Payment will be charged to your Google Play account at confirmation of purchase.',
        'Subscription automatically renews unless canceled at least 24 hours before the end of the current period.',
        'You can manage and cancel your subscription in your Google Play account settings.',
      ].join('\n');
    }

    if (Platform.OS === 'ios') {
      return [
        'Payment will be charged to your Apple ID account at confirmation of purchase.',
        'Subscription automatically renews unless canceled at least 24 hours before the end of the current period.',
        'You can manage and cancel your subscription in your App Store account settings.',
      ].join('\n');
    }

    return [
      'Payment will be charged to your store account at confirmation of purchase.',
      'Subscription automatically renews unless canceled at least 24 hours before the end of the current period.',
      'You can manage and cancel your subscription in your store account settings.',
    ].join('\n');
  }, []);

  const openExternalLink = async (url: string | null, label: string) => {
    if (!url) {
      Alert.alert('Link unavailable', `${label} URL is not configured.`);
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Link unavailable', `Could not open ${label}.`);
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      logBillingError('paywall_external_link_open_failed', error, {
        label,
        url,
      });
      Alert.alert('Link unavailable', `Could not open ${label}.`);
    }
  };

  const rankedPackages = useMemo(() => {
    const getRank = (value: PurchasesPackage) => {
      const type = value.packageType;
      if (type === 'ANNUAL') return 0;
      if (type === 'SIX_MONTH') return 1;
      if (type === 'THREE_MONTH') return 2;
      if (type === 'MONTHLY') return 3;
      if (type === 'WEEKLY') return 4;
      return 5;
    };

    return [...packages].sort((a, b) => getRank(a) - getRank(b));
  }, [packages]);

  const annualPackage = useMemo(() => {
    return rankedPackages.find((item) => item.packageType === 'ANNUAL') ?? null;
  }, [rankedPackages]);

  const monthlyPackage = useMemo(() => {
    return rankedPackages.find((item) => item.packageType === 'MONTHLY') ?? null;
  }, [rankedPackages]);

  const annualSavingsPercent = useMemo(() => {
    if (!annualPackage || !monthlyPackage) {
      return null;
    }

    const annualPrice = Number(annualPackage.product.price ?? 0);
    const monthlyPrice = Number(monthlyPackage.product.price ?? 0);
    if (annualPrice <= 0 || monthlyPrice <= 0) {
      return null;
    }

    const yearlyMonthlyCost = monthlyPrice * 12;
    if (yearlyMonthlyCost <= annualPrice) {
      return null;
    }

    const savingsRatio = 1 - annualPrice / yearlyMonthlyCost;
    const savingsPercent = Math.round(savingsRatio * 100);
    return savingsPercent >= 5 ? savingsPercent : null;
  }, [annualPackage, monthlyPackage]);

  useEffect(() => {
    const loadOfferings = async () => {
      if (!isMobilePlatform) {
        setLoading(false);
        logBillingInfo('paywall_mobile_only_platform', {
          platform: Platform.OS,
        });
        return;
      }

      try {
        const offerings = await getOfferings();
        setPackages(offerings?.current?.availablePackages ?? []);
      } catch (error) {
        logBillingError('paywall_offerings_load_failed', error);
      } finally {
        setLoading(false);
      }
    };

    loadOfferings();
  }, [isMobilePlatform]);

  useEffect(() => {
    if (loading || hasLoggedPaywallViewed.current) {
      return;
    }

    hasLoggedPaywallViewed.current = true;
    logBillingInfo('paywall_viewed', {
      source: sourceLabel,
      packageCount: rankedPackages.length,
      isMobilePlatform,
    });
  }, [isMobilePlatform, loading, rankedPackages.length, sourceLabel]);

  const handlePurchase = async (selectedPackage: PurchasesPackage) => {
    try {
      setPurchasingId(selectedPackage.identifier);
      logBillingInfo('paywall_plan_selected', {
        packageId: selectedPackage.identifier,
        packageType: selectedPackage.packageType,
        price: selectedPackage.product.price,
      });

      const result = await purchasePackage(selectedPackage);
      const unlocked = hasPremiumAccess(result.customerInfo);
      await refreshSubscription();

      logBillingInfo('paywall_purchase_completed', {
        packageId: selectedPackage.identifier,
        unlocked,
      });

      if (unlocked) {
        Alert.alert('Premium active', 'Your subscription is now active.', [
          {
            text: 'Continue',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Purchased', 'Purchase completed. Access will refresh shortly.');
      }
    } catch (error: any) {
      if (error?.userCancelled) {
        logBillingInfo('paywall_purchase_cancelled', {
          packageId: selectedPackage.identifier,
        });
        return;
      }

      logBillingError('paywall_purchase_failed', error, {
        packageId: selectedPackage.identifier,
      });
      Alert.alert('Purchase failed', 'Could not complete purchase. Please try again.');
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const customerInfo = await restorePurchases();
      const unlocked = hasPremiumAccess(customerInfo);
      await refreshSubscription();

      logBillingInfo('paywall_restore_completed', {
        unlocked,
      });

      Alert.alert(
        unlocked ? 'Restored' : 'Nothing to restore',
        unlocked ? 'Your premium access has been restored.' : 'No active subscription found for this account.'
      );

      if (unlocked) {
        router.back();
      }
    } catch (error) {
      logBillingError('paywall_restore_failed', error);
      Alert.alert('Restore failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleMaybeLater = () => {
    logBillingInfo('paywall_dismissed', {
      source: sourceLabel,
      hadPackages: rankedPackages.length > 0,
    });

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topActionRow}>
          <Button compact mode="text" onPress={handleMaybeLater}>
            Maybe later
          </Button>
        </View>

        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="dog-service" size={30} color="#1D4ED8" />
        </View>
        <Text style={styles.title}>Calmer Walks Premium</Text>
        <Text style={styles.subtitle}>Unlock {sourceLabel} with weekly coaching insights and long-range progress tools.</Text>

        <View style={styles.benefitsWrap}>
          <View style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#0F766E" />
            <Text style={styles.benefitText}>Get a weekly coach summary with one action to try next walk</Text>
          </View>
          <View style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#0F766E" />
            <Text style={styles.benefitText}>Track longer trends to spot what really improves reactivity</Text>
          </View>
          <View style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#0F766E" />
            <Text style={styles.benefitText}>Share polished PDF progress reports with trainers or family</Text>
          </View>
        </View>

        <View style={styles.trialBanner}>
          <MaterialCommunityIcons name="timer-sand" size={20} color="#1D4ED8" />
          <View style={styles.trialBannerTextWrap}>
            <Text style={styles.trialBannerTitle}>Start with a {FREE_TRIAL_DAYS}-day free trial</Text>
            <Text style={styles.trialBannerBody}>Try premium coaching and progress tools free for 7 days. Cancel any time in your store settings.</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1D4ED8" />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : !isMobilePlatform ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyTitle}>Subscriptions are mobile-only</Text>
              <Text style={styles.emptyText}>Please open this screen on iOS or Android to purchase or restore subscriptions.</Text>
            </Card.Content>
          </Card>
        ) : rankedPackages.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyTitle}>Plans are not ready yet</Text>
              <Text style={styles.emptyText}>RevenueCat offering could not be loaded. Check API keys and default offering.</Text>
            </Card.Content>
          </Card>
        ) : (
            <View style={styles.packagesWrap}>
              {rankedPackages.map((item, index) => {
              const isAnnual = item.packageType === 'ANNUAL';
              const hasFreeTrial = item.packageType === 'ANNUAL' || item.packageType === 'MONTHLY';
              const isRecommended = isAnnual || index === 0;
              const recommendedLabel = isAnnual && annualSavingsPercent
                ? `Best value - Save ${annualSavingsPercent}%`
                : 'Best value';

              return (
              <Card key={item.identifier} style={[styles.packageCard, isRecommended && styles.packageCardRecommended]}>
                <Card.Content>
                  {isRecommended ? (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>{recommendedLabel}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.packageTitle}>{item.product.title}</Text>
                  <Text style={styles.packageDescription}>{item.product.description}</Text>
                  <Text style={styles.packagePrice}>{item.product.priceString}</Text>
                  {item.product.pricePerMonthString ? (
                    <Text style={styles.packageSubPrice}>{item.product.pricePerMonthString} per month</Text>
                  ) : null}
                  {hasFreeTrial ? (
                    <Text style={styles.packageTrialText}>{FREE_TRIAL_DAYS}-day free trial included, then auto-renewal starts.</Text>
                  ) : null}
                  {isAnnual && annualSavingsPercent ? (
                    <Text style={styles.packageSavings}>Roughly {annualSavingsPercent}% cheaper than paying monthly for a year.</Text>
                  ) : null}
                  <Button
                    mode="contained"
                    buttonColor={isRecommended ? '#1D4ED8' : undefined}
                    style={styles.purchaseButton}
                    loading={purchasingId === item.identifier}
                    disabled={Boolean(purchasingId)}
                  onPress={() => handlePurchase(item)}
                >
                    {hasFreeTrial ? `Start ${FREE_TRIAL_DAYS}-day free trial` : 'Start plan'}
                  </Button>
                </Card.Content>
              </Card>
            );})}
          </View>
        )}

        <View style={styles.footerActions}>
          <Button mode="outlined" onPress={handleRestore} loading={restoring} disabled={restoring || loading || !isMobilePlatform}>
            Restore Purchases
          </Button>
        </View>

        <View style={styles.legalSection}>
          <Text style={styles.legalDisclosureText}>{legalDisclosureText}</Text>
          <View style={styles.legalLinksRow}>
            <Text style={styles.legalLink} onPress={() => openExternalLink(privacyUrl, 'Privacy Policy')}>
              Privacy Policy
            </Text>
            <Text style={styles.legalLinkSeparator}>|</Text>
            <Text style={styles.legalLink} onPress={() => openExternalLink(termsUrl, 'Terms of Use')}>
              Terms of Use
            </Text>
            <Text style={styles.legalLinkSeparator}>|</Text>
            <Text style={styles.legalLink} onPress={() => openExternalLink(manageSubscriptionUrl, 'Manage Subscription')}>
              Manage Subscription
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7FB',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0EDFF',
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 16,
  },
  benefitsWrap: {
    marginBottom: 12,
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#155E75',
    fontWeight: '600',
  },
  trialBanner: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EEF4FF',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  trialBannerTextWrap: {
    flex: 1,
  },
  trialBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  trialBannerBody: {
    marginTop: 2,
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 36,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyCard: {
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9A3412',
    lineHeight: 20,
  },
  packagesWrap: {
    gap: 12,
  },
  packageCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  packageCardRecommended: {
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  recommendedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  packageTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  packageDescription: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  packagePrice: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  packageSubPrice: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  packageTrialText: {
    marginTop: 6,
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  packageSavings: {
    marginTop: 6,
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
  },
  purchaseButton: {
    marginTop: 12,
  },
  footerActions: {
    marginTop: 18,
    marginBottom: 2,
  },
  legalSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    gap: 10,
  },
  legalDisclosureText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#718096',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  legalLink: {
    fontSize: 11,
    color: '#718096',
    textDecorationLine: 'underline',
  },
  legalLinkSeparator: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
