import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getByOwnerId } from '../../lib/data/repositories/dogProfileRepo';
import { create as createWalk } from '../../lib/data/repositories/walkRepo';
import { getLocalOwnerId } from '../../lib/localApp';
import { syncWeeklyPlanReminders } from '../../lib/notifications/notificationService';

const TECHNIQUE_OPTIONS = [
  { 
    id: 'U_Turn', 
    label: 'U-Turn', 
    description: 'Quickly turn and walk away from trigger',
    icon: 'arrow-u-left-top' 
  },
  { 
    id: 'Find_It', 
    label: 'Find It', 
    description: 'Scatter treats on ground for sniffing',
    icon: 'magnify' 
  },
  { 
    id: 'LAT', 
    label: 'Look at That', 
    description: 'Reward for calmly looking at trigger',
    icon: 'eye' 
  },
  { 
    id: 'Other', 
    label: 'Other', 
    description: 'Custom technique or combination',
    icon: 'dots-horizontal' 
  },
];

const DISTANCE_OPTIONS = [5, 10, 15, 20, 30, 50];

interface DogProfile {
  id: string;
  name: string;
  triggers: string[];
  training_method: string | null;
}

interface WeeklyPlan {
  plannedDays: string[];
  weeklyGoal: number;
}

interface WalkSetupPreferences {
  distanceThreshold: number;
  technique: string;
}

const WEEK_DAYS = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' },
];

const WEEKLY_GOAL_OPTIONS = [2, 3, 4, 5, 6, 7];
const DEFAULT_DISTANCE_THRESHOLD = 15;
const DEFAULT_TECHNIQUE = 'U_Turn';
const WALK_SETUP_STORAGE_KEY_PREFIX = 'bat_walk_setup_';
const DEFAULT_WEEKLY_PLAN: WeeklyPlan = {
  plannedDays: ['Mon', 'Wed', 'Fri'],
  weeklyGoal: 3,
};

export default function WalkSetupScreen() {
  const [dogProfile, setDogProfile] = useState<DogProfile | null>(null);
  const [distanceThreshold, setDistanceThreshold] = useState(DEFAULT_DISTANCE_THRESHOLD);
  const [selectedTechnique, setSelectedTechnique] = useState<string>(DEFAULT_TECHNIQUE);
  const [checklist, setChecklist] = useState({
    treats: false,
    harness: false,
    water: false,
    calm: false,
  });
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(DEFAULT_WEEKLY_PLAN);
  const [loading, setLoading] = useState(false);

  const loadWeeklyPlan = useCallback(async (userId: string) => {
    try {
      const stored = await AsyncStorage.getItem(`bat_weekly_plan_${userId}`);
      if (!stored) {
        return DEFAULT_WEEKLY_PLAN;
      }

      const parsed = JSON.parse(stored) as WeeklyPlan;
      if (Array.isArray(parsed.plannedDays) && typeof parsed.weeklyGoal === 'number') {
        const loadedPlan = {
          plannedDays: parsed.plannedDays.filter((day) => WEEK_DAYS.some((weekDay) => weekDay.key === day)),
          weeklyGoal: parsed.weeklyGoal,
        };
        setWeeklyPlan(loadedPlan);
        return loadedPlan;
      }

      return DEFAULT_WEEKLY_PLAN;
    } catch (error) {
      console.error('Error loading weekly BAT plan:', error);
      return DEFAULT_WEEKLY_PLAN;
    }
  }, []);

  const loadWalkSetupPreferences = useCallback(async (userId: string) => {
    try {
      const stored = await AsyncStorage.getItem(`${WALK_SETUP_STORAGE_KEY_PREFIX}${userId}`);
      if (!stored) {
        return { hasStoredTechnique: false };
      }

      const parsed = JSON.parse(stored) as Partial<WalkSetupPreferences>;
      const validTechniques = TECHNIQUE_OPTIONS.map((technique) => technique.id);

      const hasValidDistance =
        typeof parsed.distanceThreshold === 'number' && DISTANCE_OPTIONS.includes(parsed.distanceThreshold);
      const hasValidTechnique =
        typeof parsed.technique === 'string' && validTechniques.includes(parsed.technique);
      const nextDistance: number | null = hasValidDistance ? parsed.distanceThreshold as number : null;
      const nextTechnique: string | null = hasValidTechnique ? parsed.technique as string : null;

      if (nextDistance !== null) {
        setDistanceThreshold(nextDistance);
      }

      if (nextTechnique !== null) {
        setSelectedTechnique(nextTechnique);
      }

      return { hasStoredTechnique: hasValidTechnique };
    } catch (error) {
      console.error('Error loading walk setup preferences:', error);
      return { hasStoredTechnique: false };
    }
  }, []);

  const fetchDogProfile = useCallback(async () => {
    try {
      const localOwnerId = await getLocalOwnerId();
      setOwnerId(localOwnerId);
      const loadedPlan = await loadWeeklyPlan(localOwnerId);
      const walkSetupPreferences = await loadWalkSetupPreferences(localOwnerId);

      const data = await getByOwnerId(localOwnerId);
      if (data) {
        setDogProfile(data);
        if (!walkSetupPreferences.hasStoredTechnique) {
          // Pre-select technique based on dog's training method
          if (data.training_method === 'BAT') {
            setSelectedTechnique('U_Turn');
          } else if (data.training_method === 'LAT') {
            setSelectedTechnique('LAT');
          }
        }
      }

      await syncWeeklyPlanReminders({
        plannedDays: loadedPlan.plannedDays,
        dogName: data?.name,
        requestPermissionIfNeeded: false,
      });
    } catch (error) {
      console.error('Error fetching dog profile:', error);
    }
  }, [loadWalkSetupPreferences, loadWeeklyPlan]);

  useEffect(() => {
    fetchDogProfile();
  }, [fetchDogProfile]);

  const saveWeeklyPlan = async (nextPlan: WeeklyPlan) => {
    try {
      const resolvedOwnerId = ownerId ?? await getLocalOwnerId();
      if (!ownerId) {
        setOwnerId(resolvedOwnerId);
      }

      await AsyncStorage.setItem(`bat_weekly_plan_${resolvedOwnerId}`, JSON.stringify(nextPlan));
      await syncWeeklyPlanReminders({
        plannedDays: nextPlan.plannedDays,
        dogName: dogProfile?.name,
        requestPermissionIfNeeded: false,
      });
    } catch (error) {
      console.error('Error saving weekly BAT plan:', error);
    }
  };

  const saveWalkSetupPreferences = async (nextPreferences: WalkSetupPreferences) => {
    try {
      const resolvedOwnerId = ownerId ?? await getLocalOwnerId();
      if (!ownerId) {
        setOwnerId(resolvedOwnerId);
      }

      await AsyncStorage.setItem(
        `${WALK_SETUP_STORAGE_KEY_PREFIX}${resolvedOwnerId}`,
        JSON.stringify(nextPreferences)
      );
    } catch (error) {
      console.error('Error saving walk setup preferences:', error);
    }
  };

  const togglePlannedDay = (dayKey: string) => {
    const exists = weeklyPlan.plannedDays.includes(dayKey);
    const updatedDays = exists
      ? weeklyPlan.plannedDays.filter((day) => day !== dayKey)
      : [...weeklyPlan.plannedDays, dayKey];

    const nextPlan = {
      ...weeklyPlan,
      plannedDays: updatedDays,
    };

    setWeeklyPlan(nextPlan);
    saveWeeklyPlan(nextPlan);
  };

  const setWeeklyGoal = (goal: number) => {
    const nextPlan = {
      ...weeklyPlan,
      weeklyGoal: goal,
    };

    setWeeklyPlan(nextPlan);
    saveWeeklyPlan(nextPlan);
  };

  const handleDistanceThresholdChange = (distance: number) => {
    setDistanceThreshold(distance);
    saveWalkSetupPreferences({
      distanceThreshold: distance,
      technique: selectedTechnique,
    });
  };

  const handleTechniqueChange = (technique: string) => {
    setSelectedTechnique(technique);
    saveWalkSetupPreferences({
      distanceThreshold,
      technique,
    });
  };

  const toggleChecklistItem = (item: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);

  const handleStartWalk = async () => {
    if (!allChecked) {
      Alert.alert(
        'Checklist Incomplete',
        'Are you sure you want to start without completing the checklist?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Anyway', onPress: () => startWalk() }
        ]
      );
      return;
    }

    startWalk();
  };

  const startWalk = async () => {
    if (!dogProfile) {
      Alert.alert('Error', 'No dog profile found');
      return;
    }

    setLoading(true);
    try {
      const localOwnerId = await getLocalOwnerId();

      // Create walk record
      const walk = await createWalk({
        dog_id: dogProfile.id,
        owner_id: localOwnerId,
        distance_threshold_meters: distanceThreshold,
        started_at: new Date().toISOString(),
      });

      // Navigate to active walk screen
      router.push({
        pathname: '/walk/active',
        params: { 
          walkId: walk.id,
          distanceThreshold: distanceThreshold.toString(),
          technique: selectedTechnique,
        }
      });
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BAT Walk Setup</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>BAT Walk Setup</Text>
        <Text style={styles.subtitle}>
          {dogProfile ? `Preparing for a walk with ${dogProfile.name}` : 'Prepare for your training walk'}
        </Text>

        {/* Checklist Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pre-Walk Checklist</Text>
          <View style={styles.checklist}>
            <TouchableOpacity 
              style={[styles.checklistItem, checklist.treats && styles.checklistItemChecked]}
              onPress={() => toggleChecklistItem('treats')}
            >
              <MaterialCommunityIcons 
                name={checklist.treats ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                size={24} 
                color={checklist.treats ? '#10B981' : '#6B7280'} 
              />
              <View style={styles.checklistContent}>
                <Text style={[styles.checklistLabel, checklist.treats && styles.checklistLabelChecked]}>
                  High-value treats ready
                </Text>
                <Text style={styles.checklistHint}>Chicken, cheese, or favorite snacks</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.checklistItem, checklist.harness && styles.checklistItemChecked]}
              onPress={() => toggleChecklistItem('harness')}
            >
              <MaterialCommunityIcons 
                name={checklist.harness ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                size={24} 
                color={checklist.harness ? '#10B981' : '#6B7280'} 
              />
              <View style={styles.checklistContent}>
                <Text style={[styles.checklistLabel, checklist.harness && styles.checklistLabelChecked]}>
                  Proper equipment on
                </Text>
                <Text style={styles.checklistHint}>Harness fitted, leash secure</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.checklistItem, checklist.water && styles.checklistItemChecked]}
              onPress={() => toggleChecklistItem('water')}
            >
              <MaterialCommunityIcons 
                name={checklist.water ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                size={24} 
                color={checklist.water ? '#10B981' : '#6B7280'} 
              />
              <View style={styles.checklistContent}>
                <Text style={[styles.checklistLabel, checklist.water && styles.checklistLabelChecked]}>
                  Water available
                </Text>
                <Text style={styles.checklistHint}>For breaks and calming</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.checklistItem, checklist.calm && styles.checklistItemChecked]}
              onPress={() => toggleChecklistItem('calm')}
            >
              <MaterialCommunityIcons 
                name={checklist.calm ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                size={24} 
                color={checklist.calm ? '#10B981' : '#6B7280'} 
              />
              <View style={styles.checklistContent}>
                <Text style={[styles.checklistLabel, checklist.calm && styles.checklistLabelChecked]}>
                  You&apos;re calm and ready
                </Text>
                <Text style={styles.checklistHint}>Dogs sense our energy</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Distance Threshold Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance Threshold</Text>
          <Text style={styles.sectionSubtitle}>
            Alert when trigger is within this distance
          </Text>
          <View style={styles.distanceGrid}>
            {DISTANCE_OPTIONS.map((distance) => (
              <TouchableOpacity
                key={distance}
                style={[
                  styles.distanceButton,
                  distanceThreshold === distance && styles.distanceButtonActive
                ]}
                onPress={() => handleDistanceThresholdChange(distance)}
              >
                <Text 
                  style={[
                    styles.distanceButtonText,
                    distanceThreshold === distance && styles.distanceButtonTextActive
                  ]}
                >
                  {distance}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Technique Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Technique</Text>
          <View style={styles.techniquesGrid}>
            {TECHNIQUE_OPTIONS.map((technique) => (
              <TouchableOpacity
                key={technique.id}
                style={[
                  styles.techniqueCard,
                  selectedTechnique === technique.id && styles.techniqueCardActive
                ]}
                onPress={() => handleTechniqueChange(technique.id)}
              >
                <MaterialCommunityIcons 
                  name={technique.icon as keyof typeof MaterialCommunityIcons.glyphMap} 
                  size={28} 
                  color={selectedTechnique === technique.id ? '#7C3AED' : '#6B7280'} 
                />
                <Text 
                  style={[
                    styles.techniqueLabel,
                    selectedTechnique === technique.id && styles.techniqueLabelActive
                  ]}
                >
                  {technique.label}
                </Text>
                <Text style={styles.techniqueDescription}>
                  {technique.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Weekly BAT Session Planner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly BAT Session Planner</Text>
          <Text style={styles.sectionSubtitle}>
            Choose your target days and weekly session goal
          </Text>

          <View style={styles.daysGrid}>
            {WEEK_DAYS.map((day) => {
              const isSelected = weeklyPlan.plannedDays.includes(day.key);
              return (
                <TouchableOpacity
                  key={day.key}
                  style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                  onPress={() => togglePlannedDay(day.key)}
                >
                  <Text style={[styles.dayButtonText, isSelected && styles.dayButtonTextActive]}>{day.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.goalLabel}>Weekly goal</Text>
          <View style={styles.goalRow}>
            {WEEKLY_GOAL_OPTIONS.map((goal) => {
              const isSelected = weeklyPlan.weeklyGoal === goal;
              return (
                <TouchableOpacity
                  key={goal}
                  style={[styles.goalButton, isSelected && styles.goalButtonActive]}
                  onPress={() => setWeeklyGoal(goal)}
                >
                  <Text style={[styles.goalButtonText, isSelected && styles.goalButtonTextActive]}>{goal}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.plannerHintCard}>
            <MaterialCommunityIcons name="calendar-check" size={18} color="#2563EB" />
            <Text style={styles.plannerHintText}>
              Planned days: {weeklyPlan.plannedDays.length} • Goal: {weeklyPlan.weeklyGoal} session(s)
            </Text>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, loading && styles.startButtonDisabled]}
          onPress={handleStartWalk}
          disabled={loading}
        >
          <MaterialCommunityIcons 
            name="play-circle" 
            size={28} 
            color="#fff" 
            style={styles.startButtonIcon}
          />
          <Text style={styles.startButtonText}>
            {loading ? 'Starting...' : 'Start BAT Walk'}
          </Text>
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={20} color="#7C3AED" />
          <Text style={styles.infoText}>
            BAT (Behavior Adjustment Training) helps your dog learn to make good choices when seeing triggers. Keep sessions short (10-15 min) and positive!
          </Text>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
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
  checklist: {
    gap: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checklistItemChecked: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  checklistContent: {
    marginLeft: 12,
    flex: 1,
  },
  checklistLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  checklistLabelChecked: {
    color: '#059669',
  },
  checklistHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  distanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  distanceButton: {
    flex: 1,
    minWidth: '25%',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  distanceButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  distanceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  distanceButtonTextActive: {
    color: '#fff',
  },
  techniquesGrid: {
    gap: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  dayButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  dayButtonTextActive: {
    color: '#1D4ED8',
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  goalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  goalButtonTextActive: {
    color: '#fff',
  },
  plannerHintCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plannerHintText: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  techniqueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  techniqueCardActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
    borderWidth: 2,
  },
  techniqueLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 12,
    width: 80,
  },
  techniqueLabelActive: {
    color: '#7C3AED',
  },
  techniqueDescription: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  startButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
});
