import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearOnboardingSessionData, setOnboardingComplete, setOnboardingStep } from '../../lib/data/repositories/settingsRepo';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleStart = async () => {
    try {
      await setOnboardingComplete(false);
      await setOnboardingStep('dog_profile');
      await clearOnboardingSessionData();
    } catch (error) {
      console.error('Failed to prime onboarding state:', error);
    }

    router.push('/onboarding/dog-profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View pointerEvents="none" style={styles.backgroundOrbTop} />
      <View pointerEvents="none" style={styles.backgroundOrbBottom} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>Personalized 4-step onboarding</Text>
          </View>

          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🐾</Text>
          </View>

          <Text style={styles.title}>Calmer walks start here</Text>
          <Text style={styles.subtitle}>
            We will map your dog&apos;s triggers, pick the best training approach, and give you a clear day-one plan in minutes.
          </Text>

        </View>

        <View style={styles.valueCard}>
          <View style={styles.valueRow}>
            <Text style={styles.valueEmoji}>🎯</Text>
            <View style={styles.valueTextWrap}>
              <Text style={styles.valueTitle}>Personalized method</Text>
              <Text style={styles.valueText}>Get a BAT, LAT, or CC/DS recommendation based on your answers.</Text>
            </View>
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.valueEmoji}>🧭</Text>
            <View style={styles.valueTextWrap}>
              <Text style={styles.valueTitle}>Resume anytime</Text>
              <Text style={styles.valueText}>If onboarding is interrupted, users continue exactly where they left off.</Text>
            </View>
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.valueEmoji}>⚡</Text>
            <View style={styles.valueTextWrap}>
              <Text style={styles.valueTitle}>Fast setup</Text>
              <Text style={styles.valueText}>Only the inputs needed to start useful guidance right away.</Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.stepsRow}
          showsHorizontalScrollIndicator={false}
        >
            {['1. Welcome', '2. Dog Profile', '3. Assessment', '4. Technique'].map((stepLabel) => (
              <View key={stepLabel} style={styles.stepChip}>
                <Text style={styles.stepChipText}>{stepLabel}</Text>
              </View>
            ))}
        </ScrollView>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>Start Onboarding</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FAFF',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -66,
    right: -44,
    width: 230,
    height: 230,
    borderRadius: 130,
    backgroundColor: '#DBEAFE',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: -146,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 150,
    backgroundColor: '#CCFBF1',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  badgeRow: {
    marginBottom: 18,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    color: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  icon: {
    fontSize: 46,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 620,
  },
  valueCard: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCEAFE',
    padding: 14,
    gap: 10,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  valueTextWrap: {
    flex: 1,
  },
  valueEmoji: {
    fontSize: 18,
    marginTop: 1,
  },
  valueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  valueText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  stepsRow: {
    paddingRight: 6,
    gap: 8,
    paddingBottom: 2,
  },
  stepChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stepChipText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  button: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
