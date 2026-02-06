import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb, initializePocketBase } from '../../lib/pocketbase';

const TRIGGER_OPTIONS = [
  { id: 'Dog_OffLeash', label: 'Dogs (off-leash)', emoji: '🐕' },
  { id: 'Dog_OnLeash', label: 'Dogs (on-leash)', emoji: '🐕‍🦺' },
  { id: 'Human', label: 'Humans', emoji: '👤' },
  { id: 'Bike', label: 'Bikes', emoji: '🚲' },
  { id: 'Car', label: 'Cars', emoji: '🚗' },
  { id: 'Noise', label: 'Noises', emoji: '🔊' },
  { id: 'Other', label: 'Other', emoji: '❓' },
];

export default function DogProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [reactivityLevel, setReactivityLevel] = useState(3);
  const [loading, setLoading] = useState(false);

  const toggleTrigger = (triggerId: string) => {
    setSelectedTriggers(prev => 
      prev.includes(triggerId) 
        ? prev.filter(id => id !== triggerId)
        : [...prev, triggerId]
    );
  };

  const handleContinue = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      // Direct check from pb.authStore which is the source of truth
      let user = pb.authStore.model;
      
      if (!user) {
        // Try one more time after a small delay or re-initialization
        await initializePocketBase();
        user = pb.authStore.model;
      }
      
      if (!user) {
        alert('Authentication session not found. Please log in again.');
        router.replace('/(auth)/login');
        return;
      }

      await pb.collection('dog_profiles').create({
        owner_id: user.id,
        name: name.trim(),
        breed: breed.trim() || '',
        age: age ? parseInt(age) : 0,
        weight: weight ? parseFloat(weight) : 0,
        triggers: selectedTriggers,
        reactivity_level: reactivityLevel,
      });

      router.push('/onboarding/assessment');
    } catch (error: unknown) {
      console.error('Error saving dog profile:', error);
      const message = error instanceof Error ? error.message : 'Failed to save dog profile';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tell us about your dog</Text>
        <Text style={styles.subtitle}>
          This helps us personalize your experience
        </Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your dog's name"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Breed</Text>
            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder="e.g., Golden Retriever, Mixed"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Age (years)</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="3"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="25"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reactivity Level</Text>
              <Text style={styles.helperText}>
              How intense are your dog&apos;s reactions? (1 = mild, 5 = severe)
              </Text>
            <View style={styles.levelContainer}>
              {[1, 2, 3, 4, 5].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelButton,
                    reactivityLevel === level && styles.levelButtonActive,
                  ]}
                  onPress={() => setReactivityLevel(level)}
                >
                  <Text
                    style={[
                      styles.levelButtonText,
                      reactivityLevel === level && styles.levelButtonTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>What triggers your dog?</Text>
            <Text style={styles.helperText}>
              Select all that apply
            </Text>
            <View style={styles.triggersContainer}>
              {TRIGGER_OPTIONS.map((trigger) => (
                <TouchableOpacity
                  key={trigger.id}
                  style={[
                    styles.triggerButton,
                    selectedTriggers.includes(trigger.id) && styles.triggerButtonActive,
                  ]}
                  onPress={() => toggleTrigger(trigger.id)}
                >
                  <Text style={styles.triggerEmoji}>{trigger.emoji}</Text>
                  <Text
                    style={[
                      styles.triggerText,
                      selectedTriggers.includes(trigger.id) && styles.triggerTextActive,
                    ]}
                  >
                    {trigger.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isValid || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Saving...' : 'Continue'}
          </Text>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  levelContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  levelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  levelButtonActive: {
    backgroundColor: '#7C3AED',
  },
  levelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  levelButtonTextActive: {
    color: '#fff',
  },
  triggersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  triggerButtonActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  triggerEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  triggerText: {
    fontSize: 14,
    color: '#374151',
  },
  triggerTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
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
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
