import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getByOwnerId, update as updateDogProfile } from '../../lib/data/repositories/dogProfileRepo';
import { getLocalOwnerId } from '../../lib/localApp';
import {
  clearOnboardingSessionData,
  getOnboardingRecommendedTechnique,
  setOnboardingComplete,
  setOnboardingStep,
  type TechniqueKey,
} from '../../lib/data/repositories/settingsRepo';

const TECHNIQUES: Record<string, {
  name: string;
  fullName: string;
  description: string;
  bestFor: string[];
  keyPoints: string[];
  color: string;
}> = {
  BAT: {
    name: 'BAT',
    fullName: 'Behavior Adjustment Training',
    description: 'Helps your dog learn to make better choices around triggers by rewarding calm behavior at a safe distance.',
    bestFor: ['Dogs who bark/lunge', 'Dogs who need to learn to move away', 'Owners who want clear protocols'],
    keyPoints: [
      'Find your dog\'s threshold distance',
      'Mark and reward calm behavior',
      'Use "U-turns" and "Find It" when needed',
      'Gradually decrease distance over time',
    ],
    color: '#7C3AED',
  },
  'CC_DS': {
    name: 'CC/DS',
    fullName: 'Counter-Conditioning & Desensitization',
    description: 'Changes your dog\'s emotional response to triggers by pairing them with good things at low intensity.',
    bestFor: ['Fearful/anxious dogs', 'Dogs who hide or try to escape', 'Dogs who notice triggers from far away'],
    keyPoints: [
      'Start at a distance where your dog is calm',
      'Pair trigger with high-value treats',
      'Never force closer to triggers',
      'Gradual exposure over weeks/months',
    ],
    color: '#059669',
  },
  LAT: {
    name: 'LAT',
    fullName: 'Look at That',
    description: 'Teaches your dog to look at triggers calmly, then look back at you for rewards.',
    bestFor: ['Dogs who stare intensely', 'Dogs who need alternative behaviors', 'Food-motivated dogs'],
    keyPoints: [
      'Mark when dog looks at trigger',
      'Reward for looking back at you',
      'Build "auto check-ins" over time',
      'Great for preventing reactions',
    ],
    color: '#DC2626',
  },
};

export default function TechniqueScreen() {
  const router = useRouter();
  const { technique } = useLocalSearchParams<{ technique?: string | string[] }>();
  const [resolvedTechnique, setResolvedTechnique] = useState<TechniqueKey>('BAT');
  const [loadingTechnique, setLoadingTechnique] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolveTechnique = async () => {
      try {
        await setOnboardingComplete(false);
        await setOnboardingStep('technique');

        const paramTechnique = Array.isArray(technique) ? technique[0] : technique;
        if (paramTechnique && (paramTechnique === 'BAT' || paramTechnique === 'CC_DS' || paramTechnique === 'LAT')) {
          if (mounted) {
            setResolvedTechnique(paramTechnique);
          }
          return;
        }

        const storedTechnique = await getOnboardingRecommendedTechnique();
        if (storedTechnique && mounted) {
          setResolvedTechnique(storedTechnique);
        }
      } catch (error) {
        console.error('Failed to resolve recommended technique:', error);
      } finally {
        if (mounted) {
          setLoadingTechnique(false);
        }
      }
    };

    resolveTechnique().catch((error) => {
      console.error('Failed to initialize technique screen:', error);
      if (mounted) {
        setLoadingTechnique(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [technique]);

  const techniqueData = TECHNIQUES[resolvedTechnique] || TECHNIQUES.BAT;

  const handleComplete = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const ownerId = await getLocalOwnerId();
      const profile = await getByOwnerId(ownerId);

      if (!profile) {
        router.replace('/onboarding/dog-profile');
        return;
      }

      await updateDogProfile(profile.id, {
        training_method: resolvedTechnique,
      });

      await setOnboardingComplete(true);
      await setOnboardingStep('completed');
      await clearOnboardingSessionData();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error updating training method:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTechnique) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Preparing your plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.stepLabel}>Step 4 of 4</Text>
        <View style={styles.header}>
          <Text style={styles.title}>Your recommended training method</Text>
          <Text style={styles.subtitle}>
            Based on your answers, this approach should work best for your dog
          </Text>
        </View>

        <View style={[styles.techniqueCard, { borderColor: techniqueData.color }]}>
          <View style={[styles.techniqueBadge, { backgroundColor: techniqueData.color }]}>
            <Text style={styles.techniqueBadgeText}>{techniqueData.name}</Text>
          </View>
          
          <Text style={styles.techniqueFullName}>{techniqueData.fullName}</Text>
          
          <Text style={styles.techniqueDescription}>
            {techniqueData.description}
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Best for:</Text>
            {techniqueData.bestFor.map((item, index) => (
              <View key={index} style={styles.bulletPoint}>
                <Text style={styles.bullet}>✓</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key points:</Text>
            {techniqueData.keyPoints.map((point, index) => (
              <View key={index} style={styles.bulletPoint}>
                <Text style={[styles.bullet, { color: techniqueData.color }]}>•</Text>
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            💡 You can always change your approach in settings. Many dogs benefit from combining multiple techniques!
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleComplete} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Saving...' : 'Start Training'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FAFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#475569',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  stepLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    color: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  techniqueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#D5E3F4',
  },
  techniqueBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  techniqueBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  techniqueFullName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  techniqueDescription: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#1D4ED8',
    marginRight: 8,
    fontWeight: '700',
  },
  bulletText: {
    fontSize: 15,
    color: '#334155',
    flex: 1,
    lineHeight: 22,
  },
  note: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  noteText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#D5E3F4',
  },
  button: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
