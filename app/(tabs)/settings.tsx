import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Card, Divider, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clearAllLocalData, exportLocalData, importLocalData } from '../../lib/data/repositories/settingsRepo';
import { getEntitlementId, hasPremiumAccess, restorePurchases } from '../../lib/billing/revenuecat';
import { useSubscription } from '../../lib/billing/subscription';
import { logBillingError, logBillingInfo } from '../../lib/billing/telemetry';
import { getLocalOwnerId } from '../../lib/localApp';

export default function SettingsScreen() {
  const [ownerId, setOwnerId] = useState<string>('-');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const {
    status: subscriptionStatus,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
    refresh: refreshSubscription,
  } = useSubscription();
  const isPremium = subscriptionStatus === 'active';

  const [exportingData, setExportingData] = useState(false);
  const [showImportEditor, setShowImportEditor] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importingData, setImportingData] = useState(false);
  const [lastExportPreview, setLastExportPreview] = useState<string | null>(null);

  const refreshOwnerId = useCallback(async () => {
    const localOwnerId = await getLocalOwnerId();
    setOwnerId(localOwnerId);
  }, []);

  const loadSubscriptionStatus = useCallback(async () => {
    setRestoreError(null);

    try {
      await refreshSubscription();
    } catch (error) {
      logBillingError('settings_subscription_refresh_failed', error);
    }
  }, [refreshSubscription]);

  useEffect(() => {
    refreshOwnerId().catch((error) => {
      console.error('Failed to load local owner id', error);
    });
    loadSubscriptionStatus().catch((error) => {
      logBillingError('settings_initial_subscription_load_failed', error);
    });
  }, [loadSubscriptionStatus, refreshOwnerId]);

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setRestoreError(null);

    try {
      const customerInfo = await restorePurchases();
      const hasAccess = hasPremiumAccess(customerInfo);
      await refreshSubscription();

      logBillingInfo('settings_restore_completed', {
        hasAccess,
      });

      Alert.alert(
        hasAccess ? 'Restored' : 'Nothing to restore',
        hasAccess
          ? 'Premium erisiminiz bu cihaz icin geri yuklendi.'
          : 'Bu cihaz icin geri yuklenecek aktif bir abonelik bulunamadi.'
      );
    } catch (error) {
      logBillingError('settings_restore_failed', error);
      setRestoreError('Restore islemi basarisiz oldu. Lutfen tekrar deneyin.');
      Alert.alert('Restore failed', 'Restore islemi basarisiz oldu. Lutfen tekrar deneyin.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const payload = await exportLocalData();
      const json = JSON.stringify(payload, null, 2);
      setLastExportPreview(json.slice(0, 280));

      await Share.share({
        title: 'Reactive Dog Local Data',
        message: json,
      });
    } catch (error) {
      console.error('Failed to export local data', error);
      Alert.alert('Export failed', 'Local data export failed. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleImportData = async () => {
    if (!importJson.trim()) {
      Alert.alert('Missing data', 'Please paste the exported JSON first.');
      return;
    }

    setImportingData(true);
    try {
      const parsed = JSON.parse(importJson);
      await importLocalData(parsed);
      await refreshOwnerId();

      setImportJson('');
      setShowImportEditor(false);
      Alert.alert('Import complete', 'Local data imported successfully.');
    } catch (error) {
      console.error('Failed to import local data', error);
      Alert.alert('Import failed', 'Invalid JSON or unsupported backup format.');
    } finally {
      setImportingData(false);
    }
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete all local data?',
      'This removes all walks, logs, and dog profile data from this device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllLocalData();
              await refreshOwnerId();
              router.replace('/onboarding');
            } catch (error) {
              console.error('Failed to clear local data', error);
              Alert.alert('Delete failed', 'Could not clear local data. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage local data and subscription preferences</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="cellphone-lock" size={26} color="#0F766E" />
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileTitle}>This Device</Text>
            <Text style={styles.profileEmail}>Owner ID: {ownerId}</Text>
          </View>
        </View>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Local Data</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Storage</Text>
              <Text style={styles.rowValue}>On-device SQLite</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Local owner id</Text>
              <Text style={styles.rowValue}>{ownerId}</Text>
            </View>

            <View style={styles.dataActions}>
              <Button
                mode="contained"
                style={styles.dataActionButton}
                onPress={handleExportData}
                loading={exportingData}
                disabled={exportingData || importingData}
              >
                Export JSON
              </Button>
              <Button
                mode="outlined"
                style={styles.dataActionButton}
                onPress={() => setShowImportEditor((value) => !value)}
                disabled={importingData || exportingData}
              >
                {showImportEditor ? 'Hide Import' : 'Import JSON'}
              </Button>
            </View>

            {showImportEditor ? (
              <View style={styles.importWrap}>
                <TextInput
                  mode="outlined"
                  label="Paste exported JSON"
                  multiline
                  value={importJson}
                  onChangeText={setImportJson}
                  style={styles.importInput}
                />
                <Button mode="contained" onPress={handleImportData} loading={importingData} disabled={importingData || exportingData}>
                  Import now
                </Button>
              </View>
            ) : null}

            {lastExportPreview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Last export preview</Text>
                <Text style={styles.previewText}>{lastExportPreview}...</Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              buttonColor="#DC2626"
              style={styles.deleteButton}
              onPress={handleDeleteAllData}
              disabled={importingData || exportingData}
            >
              Delete all local data
            </Button>
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
                {isLoadingSubscription
                  ? 'Checking...'
                  : isPremium
                    ? 'Premium active'
                    : subscriptionStatus === 'unknown'
                      ? 'Status unavailable'
                      : 'Free plan'}
              </Text>
            </View>
            {restoreError || subscriptionError ? <Text style={styles.subscriptionError}>{restoreError || subscriptionError}</Text> : null}

            <View style={styles.dataActions}>
              <Button mode="outlined" style={styles.dataActionButton} onPress={loadSubscriptionStatus} disabled={isLoadingSubscription || isRestoring}>
                Refresh
              </Button>
              <Button
                mode="contained"
                style={styles.dataActionButton}
                onPress={handleRestorePurchases}
                loading={isRestoring}
                disabled={isRestoring || isLoadingSubscription}
              >
                Restore Purchases
              </Button>
            </View>

            {subscriptionStatus !== 'active' && !isLoadingSubscription ? (
              <Button
                mode="contained"
                buttonColor="#0F766E"
                textColor="#FFFFFF"
                style={styles.premiumPlansButton}
                onPress={() => router.push('/paywall')}
              >
                View Premium Plans
              </Button>
            ) : null}
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
    fontSize: 15,
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
  dataActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dataActionButton: {
    flex: 1,
  },
  importWrap: {
    marginTop: 14,
    gap: 10,
  },
  importInput: {
    minHeight: 140,
  },
  previewCard: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  previewText: {
    fontSize: 12,
    color: '#475569',
  },
  deleteButton: {
    marginTop: 14,
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
  premiumPlansButton: {
    marginTop: 12,
  },
});
