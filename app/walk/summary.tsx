import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { update as updateWalk } from '../../lib/data/repositories/walkRepo';

const SUCCESS_LABELS: { [key: number]: string } = {
  1: 'Very challenging',
  2: 'Difficult',
  3: 'Okay',
  4: 'Good',
  5: 'Great session!',
};

const TECHNIQUE_USED_OPTIONS = [
  { id: 'U_Turn', label: 'U-Turn', icon: 'arrow-u-left-top' },
  { id: 'Find_It', label: 'Find It', icon: 'magnify' },
  { id: 'LAT', label: 'Look at That', icon: 'eye' },
  { id: 'Other', label: 'Other/Combination', icon: 'dots-horizontal' },
];

export default function WalkSummaryScreen() {
  const { walkId, duration, logCount } = useLocalSearchParams();
  const [successRating, setSuccessRating] = useState(3);
  const [techniqueUsed, setTechniqueUsed] = useState<string>('U_Turn');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const formatDuration = (seconds: string) => {
    const secs = parseInt(seconds);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    if (mins === 0) {
      return `${secs}s`;
    }
    return `${mins}m ${remainingSecs}s`;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update walk with summary data
      await updateWalk(walkId as string, {
        success_rating: successRating,
        technique_used: techniqueUsed,
        notes: notes.trim() || null,
      });

      // Show celebration
      Alert.alert(
        'Walk Complete! 🎉',
        'Great job working with your dog today. Every session is progress!',
        [
          { 
            text: 'Back to Dashboard', 
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to save walk summary');
    } finally {
      setLoading(false);
    }
  };

  const getEncouragementMessage = () => {
    const logs = parseInt(logCount as string) || 0;
    if (logs === 0) {
      return "Perfect! A walk with no reactions is a huge win! 🌟";
    } else if (logs <= 2) {
      return "Great job managing those triggers! You're making progress! 💪";
    } else {
      return "Every walk is a learning opportunity. You both did your best! ❤️";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Walk Complete! 🎉</Text>
        
        {/* Encouragement Message */}
        <View style={styles.encouragementCard}>
          <MaterialCommunityIcons name="star-circle" size={32} color="#F59E0B" />
          <Text style={styles.encouragementText}>{getEncouragementMessage()}</Text>
        </View>

        {/* Walk Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="timer-outline" size={28} color="#7C3AED" />
            <Text style={styles.statValue}>{formatDuration(duration as string)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#EF4444" />
            <Text style={styles.statValue}>{logCount}</Text>
            <Text style={styles.statLabel}>Triggers Logged</Text>
          </View>
        </View>

        {/* Success Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How did it go?</Text>
          <Text style={styles.sectionSubtitle}>
            Rate your dog&apos;s overall performance
          </Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                style={[
                  styles.ratingButton,
                  successRating === rating && styles.ratingButtonActive,
                  successRating === rating && { 
                    backgroundColor: rating <= 2 ? '#FEE2E2' : rating === 3 ? '#FEF3C7' : '#D1FAE5',
                    borderColor: rating <= 2 ? '#EF4444' : rating === 3 ? '#F59E0B' : '#10B981',
                  }
                ]}
                onPress={() => setSuccessRating(rating)}
              >
                <MaterialCommunityIcons 
                  name={rating <= successRating ? 'star' : 'star-outline'} 
                  size={28} 
                  color={successRating === rating 
                    ? (rating <= 2 ? '#EF4444' : rating === 3 ? '#F59E0B' : '#10B981')
                    : '#D1D5DB'
                  } 
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[
            styles.ratingLabel,
            { color: successRating <= 2 ? '#EF4444' : successRating === 3 ? '#F59E0B' : '#10B981' }
          ]}>
            {SUCCESS_LABELS[successRating]}
          </Text>
        </View>

        {/* Technique Used */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What technique worked best?</Text>
          <View style={styles.techniquesContainer}>
            {TECHNIQUE_USED_OPTIONS.map((technique) => (
              <TouchableOpacity
                key={technique.id}
                style={[
                  styles.techniqueButton,
                  techniqueUsed === technique.id && styles.techniqueButtonActive
                ]}
                onPress={() => setTechniqueUsed(technique.id)}
              >
                <MaterialCommunityIcons 
                  name={technique.icon as keyof typeof MaterialCommunityIcons.glyphMap} 
                  size={24} 
                  color={techniqueUsed === technique.id ? '#7C3AED' : '#6B7280'} 
                />
                <Text 
                  style={[
                    styles.techniqueLabel,
                    techniqueUsed === technique.id && styles.techniqueLabelActive
                  ]}
                >
                  {technique.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <Text style={styles.sectionSubtitle}>
            What worked? What would you do differently?
          </Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g., Max did great with U-turns today. The park was quieter than usual..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Quick Reflection Questions */}
        <View style={styles.reflectionSection}>
          <Text style={styles.reflectionTitle}>Quick Reflection</Text>
          <View style={styles.reflectionItem}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            <Text style={styles.reflectionText}>Did you stay under threshold distance?</Text>
          </View>
          <View style={styles.reflectionItem}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            <Text style={styles.reflectionText}>Did you reward calm behavior?</Text>
          </View>
          <View style={styles.reflectionItem}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            <Text style={styles.reflectionText}>Did you end on a positive note?</Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <MaterialCommunityIcons 
            name="check-circle" 
            size={24} 
            color="#fff" 
            style={styles.saveButtonIcon}
          />
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save & Complete'}
          </Text>
        </TouchableOpacity>

        {/* Skip Button */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  encouragementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    gap: 16,
  },
  encouragementText: {
    flex: 1,
    fontSize: 16,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  ratingButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  ratingButtonActive: {
    borderWidth: 2,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  techniquesContainer: {
    gap: 10,
  },
  techniqueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  techniqueButtonActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
    borderWidth: 2,
  },
  techniqueLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  techniqueLabelActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    minHeight: 120,
  },
  reflectionSection: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  reflectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  reflectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  reflectionText: {
    fontSize: 15,
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});
