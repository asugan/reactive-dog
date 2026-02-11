import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Card, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCurrentUser, logout } from '../../lib/pocketbase';
import { getCustomerInfo, getEntitlementId, hasPremiumAccess, restorePurchases } from '../../lib/billing/revenuecat';
import { hasPremiumAccessWithFallback } from '../../lib/billing/access';

export default function SettingsScreen() {
  const user = getCurrentUser();
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const loadSubscriptionStatus = useCallback(async () => {
    setIsLoadingSubscription(true);
    setSubscriptionError(null);

    try {
      const customerInfo = await getCustomerInfo();
      if (!customerInfo) {
        const fallbackAccess = await hasPremiumAccessWithFallback();
        setIsPremium(fallbackAccess);
        if (!fallbackAccess) {
          setSubscriptionError('RevenueCat henuz yapilandirilmamis gorunuyor.');
        }
        return;
      }

      const access = hasPremiumAccess(customerInfo);
      if (access) {
        setIsPremium(true);
        return;
      }

      const fallbackAccess = await hasPremiumAccessWithFallback();
      setIsPremium(fallbackAccess);
    } catch (error) {
      console.error('Failed to load subscription status', error);
      setSubscriptionError('Abonelik durumu alinamadi. Lutfen tekrar deneyin.');
    } finally {
      setIsLoadingSubscription(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setSubscriptionError(null);

    try {
      const customerInfo = await restorePurchases();
      const hasAccess = hasPremiumAccess(customerInfo);
      setIsPremium(hasAccess);

      Alert.alert(
        hasAccess ? 'Restored' : 'Nothing to restore',
        hasAccess
          ? 'Premium erisiminiz bu cihaz icin geri yuklendi.'
          : 'Bu hesap icin geri yuklenecek aktif bir abonelik bulunamadi.'
      );
    } catch (error) {
      console.error('Failed to restore purchases', error);
      setSubscriptionError('Restore islemi basarisiz oldu. Lutfen tekrar deneyin.');
      Alert.alert('Restore failed', 'Restore islemi basarisiz oldu. Lutfen tekrar deneyin.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your account and app preferences</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="dog" size={28} color="#0F766E" />
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileTitle}>Petopia Account</Text>
            <Text style={styles.profileEmail}>{user?.email ?? 'Unknown user'}</Text>
          </View>
        </View>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{user?.email ?? '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>User ID</Text>
              <Text style={styles.rowValue}>{user?.id ?? '-'}</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Authentication</Text>
              <Text style={styles.rowValue}>Google OAuth</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Session</Text>
              <Text style={styles.rowValue}>Active</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Entitlement</Text>
              <Text style={styles.rowValue}>{getEntitlementId()}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <Text style={[styles.rowValue, isPremium ? styles.premiumText : styles.freeText]}>
                {isLoadingSubscription ? 'Checking...' : isPremium ? 'Premium active' : 'Free plan'}
              </Text>
            </View>
            {subscriptionError ? <Text style={styles.subscriptionError}>{subscriptionError}</Text> : null}
            <View style={styles.subscriptionActions}>
              <Button mode="outlined" onPress={loadSubscriptionStatus} disabled={isLoadingSubscription || isRestoring}>
                Refresh
              </Button>
              <Button mode="contained" onPress={handleRestorePurchases} loading={isRestoring} disabled={isRestoring || isLoadingSubscription}>
                Restore Purchases
              </Button>
            </View>
            {!isPremium && !isLoadingSubscription ? (
              <Button mode="text" onPress={() => router.push('/paywall')}>
                View Premium Plans
              </Button>
            ) : null}
          </Card.Content>
        </Card>

        <Card style={styles.dangerCard}>
          <Card.Content>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerText}>Logging out removes your local session from this device.</Text>
            <Button mode="contained" buttonColor="#DC2626" style={styles.logoutButton} onPress={handleLogout}>
              Log out
            </Button>
          </Card.Content>
        </Card>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 15,
    color: '#475569',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#E8F5F2',
    borderWidth: 1,
    borderColor: '#CBE8E2',
    padding: 16,
    marginBottom: 14,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  profileMeta: {
    marginLeft: 12,
    flex: 1,
  },
  profileTitle: {
    fontSize: 13,
    color: '#0F766E',
    marginBottom: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  rowLabel: {
    fontSize: 14,
    color: '#475569',
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    color: '#0F172A',
  },
  divider: {
    marginVertical: 10,
  },
  premiumText: {
    color: '#166534',
  },
  freeText: {
    color: '#475569',
  },
  subscriptionError: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 13,
    color: '#B45309',
  },
  subscriptionActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dangerCard: {
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  dangerText: {
    fontSize: 13,
    color: '#7F1D1D',
    marginBottom: 12,
  },
  logoutButton: {
    marginTop: 2,
  },
});
