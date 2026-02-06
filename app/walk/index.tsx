import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { pb, getCurrentUser } from '../../lib/pocketbase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  training_method: string;
}

export default function WalkSetupScreen() {
  const [dogProfile, setDogProfile] = useState<DogProfile | null>(null);
  const [distanceThreshold, setDistanceThreshold] = useState(15);
  const [selectedTechnique, setSelectedTechnique] = useState<string>('U_Turn');
  const [checklist, setChecklist] = useState({
    treats: false,
    harness: false,
    water: false,
    calm: false,
  });
  const [loading, setLoading] = useState(false);

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
        const data = records.items[0] as unknown as DogProfile;
        setDogProfile(data);
        // Pre-select technique based on dog's training method
        if (data.training_method === 'BAT') {
          setSelectedTechnique('U_Turn');
        } else if (data.training_method === 'LAT') {
          setSelectedTechnique('LAT');
        }
      }
    } catch (error) {
      console.error('Error fetching dog profile:', error);
    }
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
      const user = getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Create walk record
      const walk = await pb.collection('walks').create({
        dog_id: dogProfile.id,
        owner_id: user.id,
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
                  You're calm and ready
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
                onPress={() => setDistanceThreshold(distance)}
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
                onPress={() => setSelectedTechnique(technique.id)}
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
