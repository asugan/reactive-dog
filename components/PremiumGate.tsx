import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ActivityIndicator, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { hasPremiumAccessFromRevenueCat } from '../lib/billing/access';

interface PremiumGateProps {
  children: ReactNode;
  featureName: string;
  description: string;
  source?: string;
}

export function PremiumGate({ children, featureName, description, source }: PremiumGateProps) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const allowed = await hasPremiumAccessFromRevenueCat();
        if (!mounted) {
          return;
        }

        setHasAccess(allowed);
      } catch (error) {
        console.error('Failed to check premium access', error);
        if (mounted) {
          setHasAccess(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Checking your plan...</Text>
      </View>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <View style={styles.lockedContainer}>
      <Card style={styles.lockedCard}>
        <Card.Content>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="lock" size={24} color="#1E3A8A" />
          </View>
          <Text style={styles.title}>Premium Required</Text>
          <Text style={styles.feature}>{featureName}</Text>
          <Text style={styles.description}>{description}</Text>
          <Button
            mode="contained"
            style={styles.ctaButton}
            onPress={() => router.push({ pathname: '/paywall', params: source ? { source } : undefined })}
          >
            View Plans
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F3F7FB',
  },
  loadingText: {
    fontSize: 14,
    color: '#475569',
  },
  lockedContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F3F7FB',
    justifyContent: 'center',
  },
  lockedCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  feature: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  ctaButton: {
    marginTop: 16,
  },
});
