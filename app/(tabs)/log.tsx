import { useState, useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, SegmentedButtons, TextInput } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { getByOwnerId } from '../../lib/data/repositories/dogProfileRepo';
import { create as createTriggerLog, listByOwner as listTriggerLogsByOwner } from '../../lib/data/repositories/triggerLogRepo';
import { getLocalOwnerId } from '../../lib/localApp';

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

const SEVERITY_OPTIONS = [1, 2, 3, 4, 5];

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
  const entranceAnim = useRef(new Animated.Value(0)).current;

  const triggerTapHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const triggerSuccessHaptic = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const triggerErrorHaptic = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  useEffect(() => {
    fetchDogProfile();
    fetchRecentLogs();

    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  const fetchDogProfile = async () => {
    try {
      const ownerId = await getLocalOwnerId();
      const profile = await getByOwnerId(ownerId);
      if (profile) {
        setDogId(profile.id);
      }
    } catch (error) {
      console.error('Error fetching dog profile:', error);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const ownerId = await getLocalOwnerId();
      const records = await listTriggerLogsByOwner(ownerId, {
        limit: 5,
        sort: '-logged_at',
      });
      setRecentLogs(records as TriggerLog[]);
    } catch (error) {
      console.error('Error fetching recent logs:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedTrigger) {
      triggerErrorHaptic();
      Alert.alert('Error', 'Please select a trigger type');
      return;
    }

    if (!dogId) {
      triggerErrorHaptic();
      Alert.alert('Error', 'No dog profile found. Please complete onboarding first.');
      return;
    }

    triggerTapHaptic();
    setLoading(true);
    try {
      const ownerId = await getLocalOwnerId();

      await createTriggerLog({
        dog_id: dogId,
        owner_id: ownerId,
        trigger_type: selectedTrigger,
        severity,
        distance_meters: distance ? parseFloat(distance) : null,
        notes: notes.trim() || null,
        logged_at: new Date().toISOString(),
      });

      // Reset form
      setSelectedTrigger(null);
      setSeverity(3);
      setDistance('');
      setNotes('');

      // Refresh recent logs
      fetchRecentLogs();

      triggerSuccessHaptic();
      Alert.alert('Success', 'Trigger logged successfully!');
    } catch (error) {
      console.error('Error saving trigger log:', error);
      triggerErrorHaptic();
      Alert.alert('Error', 'Failed to save log. Please try again.');
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
        <Animated.View
          style={{
            opacity: entranceAnim,
            transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
        <Text style={styles.title}>Quick Log</Text>
        <Text style={styles.subtitle}>
          Log a reaction in 2 taps - track patterns over time
        </Text>

        {/* Trigger Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What triggered your dog? *</Text>
          <View style={styles.triggersGrid}>
            {TRIGGER_OPTIONS.map((trigger) => (
              <Chip
                key={trigger.id}
                style={[
                  styles.triggerButton,
                  selectedTrigger === trigger.id && {
                    backgroundColor: trigger.color + '20',
                    borderColor: trigger.color,
                    borderWidth: 2,
                  },
                ]}
                mode={selectedTrigger === trigger.id ? 'flat' : 'outlined'}
                onPress={() => setSelectedTrigger(trigger.id)}
              >
                {`${trigger.emoji} ${trigger.label}`}
              </Chip>
            ))}
          </View>
        </View>

        {/* Severity Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How intense was the reaction?</Text>
          <SegmentedButtons
            style={styles.severitySegmented}
            value={String(severity)}
            onValueChange={(value) => setSeverity(Number(value))}
            buttons={SEVERITY_OPTIONS.map((value) => ({
              value: String(value),
              label: String(value),
              style: styles.severitySegmentButton,
            }))}
          />
          <Text style={styles.severityLabel}>{SEVERITY_LABELS[severity]}</Text>
        </View>

        {/* Distance Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance (optional)</Text>
          <TextInput
            mode="outlined"
            style={styles.distanceInput}
            value={distance}
            onChangeText={setDistance}
            placeholder="e.g., 10"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
            right={<TextInput.Affix text="meters" textStyle={styles.distanceAffix} />}
          />
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
        <Button
          mode="contained"
          icon="check-circle"
          style={[styles.saveButton, !selectedTrigger && styles.saveButtonDisabled]}
          contentStyle={styles.saveButtonContent}
          labelStyle={styles.saveButtonText}
          onPress={handleSave}
          disabled={!selectedTrigger || loading}
        >
          {loading ? 'Saving...' : 'Log Trigger'}
        </Button>

        {/* Recent Logs */}
        {recentLogs.length > 0 && (
          <View style={styles.recentLogsSection}>
            <Text style={styles.recentLogsTitle}>Recent Logs</Text>
            {recentLogs.map((log) => (
              <Card key={log.id} style={styles.logItem}>
                <Card.Content style={styles.logItemContent}>
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
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  triggersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  triggerButton: {
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    minWidth: 140,
  },
  severityLabel: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  severitySegmented: {
    width: '100%',
  },
  severitySegmentButton: {
    flex: 1,
    minWidth: 0,
  },
  distanceInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  distanceAffix: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    minHeight: 100,
  },
  saveButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  recentLogsSection: {
    borderTopWidth: 1,
    borderTopColor: '#D9E2EC',
    paddingTop: 24,
  },
  recentLogsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  logItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  logItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    color: '#334155',
  },
  logMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  logTime: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
