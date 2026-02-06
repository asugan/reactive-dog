import { useState, useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { pb, getCurrentUser } from '../../lib/pocketbase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Surface } from 'react-native-paper';
// TODO: PostHog - import { usePostHog } from 'posthog-react-native';

interface Walk {
  id: string;
  started_at: string;
  ended_at: string | null;
  success_rating: number | null;
  technique_used: string | null;
}

interface DogProfile {
  name: string;
}

export default function Dashboard() {
  // TODO: PostHog - const posthog = usePostHog();
  const [dogProfile, setDogProfile] = useState<DogProfile | null>(null);
  const [recentWalks, setRecentWalks] = useState<Walk[]>([]);
  const [stats, setStats] = useState({
    totalWalks: 0,
    thisWeekWalks: 0,
  });
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // TODO: PostHog - posthog?.capture('dashboard_viewed');
    fetchDogProfile();
    fetchRecentWalks();
    fetchStats();

    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  const fetchDogProfile = async () => {
    try {
      const user = getCurrentUser();
      if (!user) return;

      const records = await pb.collection('dog_profiles').getList(1, 1, {
        filter: `owner_id = "${user.id}"`,
        requestKey: null,
      });

      if (records.items.length > 0) {
        setDogProfile(records.items[0] as unknown as DogProfile);
      }
    } catch (error) {
      console.error('Error fetching dog profile:', error);
    }
  };

  const fetchRecentWalks = async () => {
    try {
      const user = getCurrentUser();
      if (!user) return;

      const records = await pb.collection('walks').getList(1, 3, {
        filter: `owner_id = "${user.id}"`,
        sort: '-started_at',
        requestKey: null,
      });

      setRecentWalks(records.items as unknown as Walk[]);
    } catch (error) {
      console.error('Error fetching walks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const user = getCurrentUser();
      if (!user) return;

      // Get total walks count
      const totalResult = await pb.collection('walks').getList(1, 1, {
        filter: `owner_id = "${user.id}"`,
        requestKey: null,
      });
      const totalCount = totalResult.totalItems;

      // Get this week's walks
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weekResult = await pb.collection('walks').getList(1, 1, {
        filter: `owner_id = "${user.id}" && started_at >= "${oneWeekAgo.toISOString()}"`,
        requestKey: null,
      });
      const weekCount = weekResult.totalItems;

      setStats({
        totalWalks: totalCount || 0,
        thisWeekWalks: weekCount || 0,
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatDuration = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return '';
    if (!end) return 'In progress';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    return `${mins} min`;
  };

  const getSuccessStars = (rating: number | null) => {
    if (!rating) return 'Not rated';
    return '⭐'.repeat(rating);
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello! 👋</Text>
            <Text style={styles.dogName}>
              {dogProfile?.name ? `Walking with ${dogProfile.name}` : 'Ready to train?'}
            </Text>
          </View>
        </View>

        {/* Main CTA - BAT Walk */}
        <Card style={styles.batWalkCard} onPress={() => router.push('/walk')}>
          <Card.Content style={styles.batWalkCardContent}>
          <View style={styles.batWalkIconContainer}>
              <MaterialCommunityIcons name="walk" size={40} color="#0F766E" />
          </View>
          <View style={styles.batWalkContent}>
            <Text style={styles.batWalkTitle}>Start BAT Walk</Text>
            <Text style={styles.batWalkDescription}>
              Begin a training session with distance alerts and technique reminders
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#0F766E" />
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [styles.quickActionButton, pressed && styles.quickActionPressed]}
            onPress={() => router.push('/(tabs)/log')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="alert-circle" size={24} color="#EF4444" />
            </View>
            <Text style={styles.quickActionLabel}>Log Trigger</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionButton, pressed && styles.quickActionPressed]}
            onPress={() => router.push('/(tabs)/progress')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.quickActionLabel}>Progress</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickActionButton, pressed && styles.quickActionPressed]}
            onPress={() => router.push('/(tabs)/community')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
              <MaterialCommunityIcons name="message-text" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickActionLabel}>Community</Text>
          </Pressable>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
            <Text style={styles.statValue}>{stats.thisWeekWalks}</Text>
            <Text style={styles.statLabel}>This Week</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
            <Text style={styles.statValue}>{stats.totalWalks}</Text>
            <Text style={styles.statLabel}>Total Walks</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Recent Walks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Walks</Text>
            {recentWalks.length > 0 && (
              <Text style={styles.sectionSubtitle}>Last {recentWalks.length} sessions</Text>
            )}
          </View>

          {recentWalks.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="walk" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No walks yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start your first BAT training session today!
              </Text>
            </View>
          ) : (
            <View style={styles.walksList}>
              {recentWalks.map((walk) => (
                <Card key={walk.id} style={styles.walkCard}>
                  <Card.Content>
                  <View style={styles.walkHeader}>
                    <Text style={styles.walkDate}>{formatDate(walk.started_at)}</Text>
                    <Text style={styles.walkDuration}>
                      {formatDuration(walk.started_at, walk.ended_at)}
                    </Text>
                  </View>
                  {walk.success_rating != null && (
                    <Text style={styles.walkRating}>
                      {getSuccessStars(walk.success_rating)}
                    </Text>
                  )}
                  {walk.technique_used != null && (
                    <View style={styles.techniqueBadge}>
                      <Text style={styles.techniqueText}>
                        {walk.technique_used.replace('_', ' ')}
                      </Text>
                    </View>
                  )}
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Motivational Quote */}
        <Surface style={styles.quoteCard} elevation={1}>
          <MaterialCommunityIcons name="format-quote-open" size={24} color="#0F766E" />
          <Text style={styles.quoteText}>
            &ldquo;Progress, not perfection. Every walk is a step forward.&rdquo;
          </Text>
        </Surface>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7F6',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  dogName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  batWalkCard: {
    backgroundColor: '#E6F6F4',
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C6ECE7',
  },
  batWalkCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  batWalkIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batWalkContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  batWalkTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F766E',
    marginBottom: 4,
  },
  batWalkDescription: {
    fontSize: 14,
    color: '#475569',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionPressed: {
    transform: [{ scale: 0.98 }],
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE7E5',
  },
  statCardContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F766E',
  },
  statLabel: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5EA',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  walksList: {
    gap: 12,
  },
  walkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDE7E5',
  },
  walkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  walkDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  walkDuration: {
    fontSize: 14,
    color: '#64748B',
  },
  walkRating: {
    fontSize: 14,
    marginBottom: 8,
  },
  techniqueBadge: {
    backgroundColor: '#E6F6F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  techniqueText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0F766E',
  },
  quoteCard: {
    backgroundColor: '#EAF4F3',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4E7E4',
  },
  quoteText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
  },
});
