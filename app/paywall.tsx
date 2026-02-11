import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { getOfferings, hasPremiumAccess, purchasePackage, restorePurchases } from '../lib/billing/revenuecat';

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  const sourceLabel = useMemo(() => {
    if (!params.source) {
      return 'premium features';
    }

    return `${params.source}`;
  }, [params.source]);

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

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const offerings = await getOfferings();
        setPackages(offerings?.current?.availablePackages ?? []);
      } catch (error) {
        console.error('Failed to load offerings', error);
      } finally {
        setLoading(false);
      }
    };

    loadOfferings();
  }, []);

  const handlePurchase = async (selectedPackage: PurchasesPackage) => {
    try {
      setPurchasingId(selectedPackage.identifier);
      const result = await purchasePackage(selectedPackage);
      const unlocked = hasPremiumAccess(result.customerInfo);

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
        return;
      }

      console.error('Purchase failed', error);
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

      Alert.alert(
        unlocked ? 'Restored' : 'Nothing to restore',
        unlocked ? 'Your premium access has been restored.' : 'No active subscription found for this account.'
      );

      if (unlocked) {
        router.back();
      }
    } catch (error) {
      console.error('Restore failed', error);
      Alert.alert('Restore failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="dog-service" size={30} color="#1D4ED8" />
        </View>
        <Text style={styles.title}>Go Premium</Text>
        <Text style={styles.subtitle}>Unlock {sourceLabel} and advanced tools for safer, calmer walks.</Text>

        <View style={styles.benefitsWrap}>
          <View style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#0F766E" />
            <Text style={styles.benefitText}>Community tools and expert Q&A sessions</Text>
          </View>
          <View style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#0F766E" />
            <Text style={styles.benefitText}>Premium reports and advanced progress insights</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1D4ED8" />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
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
              const isRecommended = item.packageType === 'ANNUAL' || index === 0;

              return (
              <Card key={item.identifier} style={[styles.packageCard, isRecommended && styles.packageCardRecommended]}>
                <Card.Content>
                  {isRecommended ? (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>Best value</Text>
                    </View>
                  ) : null}
                  <Text style={styles.packageTitle}>{item.product.title}</Text>
                  <Text style={styles.packageDescription}>{item.product.description}</Text>
                  <Text style={styles.packagePrice}>{item.product.priceString}</Text>
                  {item.product.pricePerMonthString ? (
                    <Text style={styles.packageSubPrice}>{item.product.pricePerMonthString} per month</Text>
                  ) : null}
                  <Button
                    mode="contained"
                    buttonColor={isRecommended ? '#1D4ED8' : undefined}
                    style={styles.purchaseButton}
                    loading={purchasingId === item.identifier}
                    disabled={Boolean(purchasingId)}
                    onPress={() => handlePurchase(item)}
                  >
                    Continue
                  </Button>
                </Card.Content>
              </Card>
            );})}
          </View>
        )}

        <View style={styles.footerActions}>
          <Button mode="outlined" onPress={handleRestore} loading={restoring} disabled={restoring || loading}>
            Restore Purchases
          </Button>
          <Button mode="text" onPress={() => router.back()}>
            Maybe later
          </Button>
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
  purchaseButton: {
    marginTop: 12,
  },
  footerActions: {
    marginTop: 18,
    gap: 6,
  },
});
