import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TRIGGER_OPTIONS = [
  { id: 'Dog_OffLeash', label: 'Dog (Off-leash)', emoji: '🐕', color: '#EF4444' },
  { id: 'Dog_OnLeash', label: 'Dog (On-leash)', emoji: '🐕‍🦺', color: '#F97316' },
  { id: 'Human', label: 'Human', emoji: '👤', color: '#3B82F6' },
  { id: 'Bike', label: 'Bike', emoji: '🚲', color: '#10B981' },
  { id: 'Car', label: 'Car', emoji: '🚗', color: '#6B7280' },
  { id: 'Noise', label: 'Noise', emoji: '🔊', color: '#8B5CF6' },
  { id: 'Other', label: 'Other', emoji: '❓', color: '#6B7280' },
];

const SEVERITY_LABELS: { [key: number]: string } = {
  1: 'Alert only',
  2: 'Mild bark',
  3: 'Moderate reaction',
  4: 'Strong lunging',
  5: 'Severe/aggressive',
};

interface TriggerLog {
  id: string;
  trigger_type: string;
  severity: number;
  distance_meters: number | null;
  notes: string | null;
  logged_at: string;
}

export default function LogScreen() {
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [severity, setSeverity] = useState(3);
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState<TriggerLog[]>([]);
  const [dogId, setDogId] = useState<string | null>(null);

  useEffect(() => {
    fetchDogProfile();
    fetchRecentLogs();
  }, []);

  const fetchDogProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('dog_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching dog profile:', error);
        return;
      }

      setDogId(data?.id || null);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trigger_logs')
        .select('*')
        .eq('owner_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching recent logs:', error);
        return;
      }

      setRecentLogs(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedTrigger) {
      Alert.alert('Error', 'Please select a trigger type');
      return;
    }

    if (!dogId) {
      Alert.alert('Error', 'No dog profile found. Please complete onboarding first.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const { error } = await supabase
        .from('trigger_logs')
        .insert({
          dog_id: dogId,
          owner_id: user.id,
          trigger_type: selectedTrigger,
          severity: severity,
          distance_meters: distance ? parseFloat(distance) : null,
          notes: notes.trim() || null,
        });

      if (error) {
        console.error('Error saving trigger log:', error);
        Alert.alert('Error', 'Failed to save log. Please try again.');
        return;
      }

      // Reset form
      setSelectedTrigger(null);
      setSeverity(3);
      setDistance('');
      setNotes('');

      // Refresh recent logs
      fetchRecentLogs();

      Alert.alert('Success', 'Trigger logged successfully!');
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTriggerEmoji = (type: string) => {
    return TRIGGER_OPTIONS.find(t => t.id === type)?.emoji || '❓';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Quick Log</Text>
        <Text style={styles.subtitle}>
          Log a reaction in 2 taps - track patterns over time
        </Text>

        {/* Trigger Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What triggered your dog? *</Text>
          <View style={styles.triggersGrid}>
            {TRIGGER_OPTIONS.map((trigger) => (
              <TouchableOpacity
                key={trigger.id}
                style={[
                  styles.triggerButton,
                  selectedTrigger === trigger.id && { 
                    backgroundColor: trigger.color + '20',
                    borderColor: trigger.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSelectedTrigger(trigger.id)}
              >
                <Text style={styles.triggerEmoji}>{trigger.emoji}</Text>
                <Text 
                  style={[
                    styles.triggerLabel,
                    selectedTrigger === trigger.id && { color: trigger.color, fontWeight: '700' }
                  ]}
                >
                  {trigger.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How intense was the reaction?</Text>
          <View style={styles.severityContainer}>
            {[1, 2, 3, 4, 5].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.severityButton,
                  severity === level && styles.severityButtonActive,
                  severity === level && { backgroundColor: level <= 2 ? '#10B981' : level === 3 ? '#F59E0B' : '#EF4444' }
                ]}
                onPress={() => setSeverity(level)}
              >
                <Text
                  style={[
                    styles.severityButtonText,
                    severity === level && styles.severityButtonTextActive,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.severityLabel}>{SEVERITY_LABELS[severity]}</Text>
        </View>

        {/* Distance Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance (optional)</Text>
          <View style={styles.distanceInputContainer}>
            <TextInput
              style={styles.distanceInput}
              value={distance}
              onChangeText={setDistance}
              placeholder="e.g., 10"
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.distanceUnit}>meters</Text>
          </View>
        </View>

        {/* Notes Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional context..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, !selectedTrigger && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!selectedTrigger || loading}
        >
          <MaterialCommunityIcons 
            name="check-circle" 
            size={24} 
            color="#fff" 
            style={styles.saveButtonIcon}
          />
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Log Trigger'}
          </Text>
        </TouchableOpacity>

        {/* Recent Logs */}
        {recentLogs.length > 0 && (
          <View style={styles.recentLogsSection}>
            <Text style={styles.recentLogsTitle}>Recent Logs</Text>
            {recentLogs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <Text style={styles.logEmoji}>{getTriggerEmoji(log.trigger_type)}</Text>
                <View style={styles.logDetails}>
                  <Text style={styles.logType}>
                    {TRIGGER_OPTIONS.find(t => t.id === log.trigger_type)?.label || log.trigger_type}
                  </Text>
                  <Text style={styles.logMeta}>
                    Severity: {log.severity}/5
                    {log.distance_meters ? ` • ${log.distance_meters}m away` : ''}
                  </Text>
                </View>
                <Text style={styles.logTime}>{formatTime(log.logged_at)}</Text>
              </View>
            ))}
          </View>
        )}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  triggersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: '45%',
  },
  triggerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  triggerLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#7C3AED',
  },
  severityButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  severityButtonTextActive: {
    color: '#fff',
  },
  severityLabel: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  distanceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distanceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  distanceUnit: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    minHeight: 100,
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 32,
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
  recentLogsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 24,
  },
  recentLogsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
  },
  logEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  logDetails: {
    flex: 1,
  },
  logType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  logMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  logTime: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
