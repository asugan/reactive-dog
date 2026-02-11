import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { pb, getCurrentUser } from '../../lib/pocketbase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const TRIGGER_OPTIONS = [
  { id: 'Dog_OffLeash', label: 'Dog Off-leash', emoji: '🐕' },
  { id: 'Dog_OnLeash', label: 'Dog On-leash', emoji: '🐕‍🦺' },
  { id: 'Human', label: 'Human', emoji: '👤' },
  { id: 'Bike', label: 'Bike', emoji: '🚲' },
  { id: 'Car', label: 'Car', emoji: '🚗' },
  { id: 'Noise', label: 'Noise', emoji: '🔊' },
];

interface LocationData {
  latitude: number;
  longitude: number;
}

export default function ActiveWalkScreen() {
  const { walkId, distanceThreshold, technique } = useLocalSearchParams();
  const [dogId, setDogId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [duration, setDuration] = useState(0);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState(3);
  const [pulseAnim] = useState(new Animated.Value(1));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Pulse animation for active indicator
  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  // Fetch dog profile
  useEffect(() => {
    fetchDogProfile();
  }, []);

  const fetchDogProfile = async () => {
    try {
      const user = getCurrentUser();
      if (!user) return;

      const records = await pb.collection('dog_profiles').getList(1, 1, {
        filter: `owner_id = "${user.id}"`,
        requestKey: null,
      });

      if (records.items.length > 0) {
        setDogId(records.items[0].id);
      }
    } catch (error) {
      console.error('Error fetching dog profile:', error);
    }
  };

  // Timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  // Location tracking
  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Location permission is required for BAT walks');
          return;
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (newLocation) => {
            if (isMounted) {
              setLocation({
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              });
            }
          }
        );
      } catch (error) {
        console.error('Error starting location tracking:', error);
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = () => {
    setIsActive(!isActive);
  };

  const handleEndWalk = () => {
    Alert.alert(
      'End Walk Session?',
      'Your progress will be saved. You can add final notes on the next screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Walk', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Update walk with end time
              await pb.collection('walks').update(walkId as string, {
                ended_at: new Date().toISOString(),
              });

              // Navigate to summary
              router.push({
                pathname: '/walk/summary',
                params: { 
                  walkId: walkId as string,
                  duration: duration.toString(),
                  logCount: logCount.toString(),
                }
              });
            } catch (error) {
              console.error('Error ending walk:', error);
            }
          }
        }
      ]
    );
  };

  const handleQuickLog = async () => {
    if (!selectedTrigger) {
      Alert.alert('Error', 'Please select a trigger type');
      return;
    }

    if (!dogId) {
      Alert.alert('Error', 'No dog profile found');
      return;
    }

    try {
      const user = getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Log trigger during walk
      await pb.collection('trigger_logs').create({
        dog_id: dogId,
        owner_id: user.id,
        trigger_type: selectedTrigger,
        severity: selectedSeverity,
        location_latitude: location?.latitude || null,
        location_longitude: location?.longitude || null,
        notes: 'Logged during BAT walk session',
        logged_at: new Date().toISOString(),
      });

      // Update log count
      setLogCount(prev => prev + 1);
      
      // Vibrate for feedback
      Vibration.vibrate(200);
      
      // Reset and close modal
      setSelectedTrigger(null);
      setSelectedSeverity(3);
      setShowQuickLog(false);

      // Show success feedback
      Alert.alert('Logged!', 'Trigger logged successfully', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const getTechniqueReminder = () => {
    switch (technique) {
      case 'U_Turn':
        return {
          icon: 'arrow-u-left-top',
          title: 'U-Turn Technique',
          description: 'Turn away calmly when you see a trigger',
        };
      case 'Find_It':
        return {
          icon: 'magnify',
          title: 'Find It Technique',
          description: 'Scatter treats and say "Find it!"',
        };
      case 'LAT':
        return {
          icon: 'eye',
          title: 'Look at That',
          description: 'Click/treat when dog looks at trigger calmly',
        };
      default:
        return {
          icon: 'walk',
          title: 'Stay Calm',
          description: 'Maintain distance and reward good choices',
        };
    }
  };

  const reminder = getTechniqueReminder();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>BAT Walk Active</Text>
          <View style={styles.activeIndicator}>
            <Animated.View 
              style={[
                styles.activeDot,
                { transform: [{ scale: pulseAnim }] }
              ]} 
            />
            <Text style={styles.activeText}>{isActive ? 'Recording' : 'Paused'}</Text>
          </View>
        </View>
        <View style={styles.durationContainer}>
          <MaterialCommunityIcons name="timer" size={24} color="#7C3AED" />
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Technique Reminder Card */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderIconContainer}>
            <MaterialCommunityIcons name={reminder.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={32} color="#7C3AED" />
          </View>
          <View style={styles.reminderContent}>
            <Text style={styles.reminderTitle}>{reminder.title}</Text>
            <Text style={styles.reminderDescription}>{reminder.description}</Text>
          </View>
        </View>

        {/* Distance Alert Simulation */}
        <View style={styles.alertCard}>
          <MaterialCommunityIcons name="bell-ring" size={28} color="#F59E0B" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Distance Alert</Text>
            <Text style={styles.alertText}>
              Will alert when trigger is within {distanceThreshold}m
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="map-marker" size={24} color="#6B7280" />
            <Text style={styles.statValue}>
              {location ? 'Tracking' : 'Waiting...'}
            </Text>
            <Text style={styles.statLabel}>Location</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.statValue}>{logCount}</Text>
            <Text style={styles.statLabel}>Triggers</Text>
          </View>
        </View>

        {/* Quick Log Button */}
        <TouchableOpacity
          style={styles.quickLogButton}
          onPress={() => setShowQuickLog(true)}
        >
          <MaterialCommunityIcons name="plus-circle" size={32} color="#fff" />
          <Text style={styles.quickLogButtonText}>Quick Log Trigger</Text>
        </TouchableOpacity>

        {/* Technique Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Stay below threshold distance</Text>
          </View>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Reward calm behavior immediately</Text>
          </View>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>End on a positive note</Text>
          </View>
        </View>
      </View>

      {/* Footer Controls */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.controlButton, styles.pauseButton]}
          onPress={handlePauseResume}
        >
          <MaterialCommunityIcons 
            name={isActive ? 'pause' : 'play'} 
            size={28} 
            color="#fff" 
          />
          <Text style={styles.controlButtonText}>
            {isActive ? 'Pause' : 'Resume'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endButton]}
          onPress={handleEndWalk}
        >
          <MaterialCommunityIcons name="stop" size={28} color="#fff" />
          <Text style={styles.controlButtonText}>End Walk</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Log Modal */}
      {showQuickLog && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quick Log Trigger</Text>
            
            {/* Trigger Selection */}
            <Text style={styles.modalSubtitle}>What triggered your dog?</Text>
            <View style={styles.triggerGrid}>
              {TRIGGER_OPTIONS.map((trigger) => (
                <TouchableOpacity
                  key={trigger.id}
                  style={[
                    styles.triggerButton,
                    selectedTrigger === trigger.id && styles.triggerButtonActive
                  ]}
                  onPress={() => setSelectedTrigger(trigger.id)}
                >
                  <Text style={styles.triggerEmoji}>{trigger.emoji}</Text>
                  <Text 
                    style={[
                      styles.triggerLabel,
                      selectedTrigger === trigger.id && styles.triggerLabelActive
                    ]}
                  >
                    {trigger.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity Selection */}
            <Text style={styles.modalSubtitle}>Severity (1-5)</Text>
            <View style={styles.severityContainer}>
              {[1, 2, 3, 4, 5].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.severityButton,
                    selectedSeverity === level && styles.severityButtonActive,
                    selectedSeverity === level && { 
                      backgroundColor: level <= 2 ? '#10B981' : level === 3 ? '#F59E0B' : '#EF4444' 
                    }
                  ]}
                  onPress={() => setSelectedSeverity(level)}
                >
                  <Text style={[
                    styles.severityButtonText,
                    selectedSeverity === level && styles.severityButtonTextActive
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setSelectedTrigger(null);
                  setSelectedSeverity(3);
                  setShowQuickLog(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleQuickLog}
                disabled={!selectedTrigger}
              >
                <Text style={styles.saveButtonText}>Log It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  activeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  duration: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C3AED',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  reminderIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reminderContent: {
    flex: 1,
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  alertText: {
    fontSize: 14,
    color: '#B45309',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  quickLogButton: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  quickLogButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  tipsContainer: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  pauseButton: {
    backgroundColor: '#6B7280',
  },
  endButton: {
    backgroundColor: '#EF4444',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  triggerButtonActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  triggerEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  triggerLabel: {
    fontSize: 14,
    color: '#374151',
  },
  triggerLabelActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#7C3AED',
  },
  severityButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  severityButtonTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
