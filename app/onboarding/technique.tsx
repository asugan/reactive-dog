import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

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
  const { technique = 'BAT' } = useLocalSearchParams<{ technique: string }>();
  
  const techniqueData = TECHNIQUES[technique] || TECHNIQUES.BAT;

  const handleComplete = async () => {
    try {
      // Update dog profile with recommended technique
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: dogProfile } = await supabase
          .from('dog_profiles')
          .select('id')
          .eq('owner_id', user.id)
          .single();
        
        if (dogProfile) {
          await supabase
            .from('dog_profiles')
            .update({ training_method: technique })
            .eq('id', dogProfile.id);
        }
      }
    } catch (error) {
      console.error('Error updating training method:', error);
    }
    
    // Navigate to main app
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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
        <TouchableOpacity style={styles.button} onPress={handleComplete}>
          <Text style={styles.buttonText}>Start Training</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  techniqueCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#7C3AED',
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
    color: '#1F2937',
    marginBottom: 12,
  },
  techniqueDescription: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#7C3AED',
    marginRight: 8,
    fontWeight: '700',
  },
  bulletText: {
    fontSize: 15,
    color: '#4B5563',
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
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
