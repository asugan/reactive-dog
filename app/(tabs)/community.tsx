import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Animated,
  Easing,
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  ScrollView, 
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { pb, getCurrentUser } from '../../lib/pocketbase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { ActivityIndicator, Button, Card, Chip, Dialog, FAB, IconButton, Modal as PaperModal, Portal, TextInput } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { PremiumGate } from '../../components/PremiumGate';

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  post_type: 'general' | 'win_of_the_day' | 'question' | 'success_story';
  likes_count: number;
  created: string;
  author_id: string;
  expand?: {
    author_id?: {
      username: string;
    };
  };
}

interface OwnerLocation {
  id: string;
  owner_id: string;
  latitude: number;
  longitude: number;
  is_visible: boolean;
  updated: string;
}

interface ExpertSession {
  id: string;
  expert_name: string;
  credentials: string;
  topic: string;
  description: string;
  scheduled_at: string;
  capacity: number;
}

type RadiusFilter = 'all' | 5 | 10 | 20;

interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

const DEFAULT_MAP_REGION = {
  latitude: 39.9334,
  longitude: 32.8597,
  latitudeDelta: 0.25,
  longitudeDelta: 0.2,
};

const LOCATION_PRECISION = 3;
const LOCATION_PRECISION_METERS = 110;
const EARTH_RADIUS_KM = 6371;
const ACCENT_COLOR = '#1D4ED8';

const toRad = (value: number) => {
  return (value * Math.PI) / 180;
};

const distanceKmBetween = (from: CoordinatePoint, to: CoordinatePoint) => {
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const POST_TYPE_CONFIG = {
  general: { 
    label: 'General', 
    icon: 'chat-outline', 
    color: '#6B7280',
    bgColor: '#F3F4F6'
  },
  win_of_the_day: { 
    label: 'Win of the Day', 
    icon: 'trophy-outline', 
    color: '#F59E0B',
    bgColor: '#FEF3C7'
  },
  question: { 
    label: 'Question', 
    icon: 'help-circle-outline', 
    color: '#3B82F6',
    bgColor: '#DBEAFE'
  },
  success_story: { 
    label: 'Success Story', 
    icon: 'star-outline', 
    color: '#10B981',
    bgColor: '#D1FAE5'
  },
};

const FILTER_OPTIONS: ('all' | 'win_of_the_day' | 'question' | 'success_story')[] = [
  'all', 'win_of_the_day', 'question', 'success_story'
];

const buildUpcomingDate = (daysFromNow: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const FALLBACK_EXPERT_SESSIONS: ExpertSession[] = [
  {
    id: 'ama-thresholds',
    expert_name: 'Dr. Elif Arman',
    credentials: 'DACVB',
    topic: 'Threshold Management in Busy Areas',
    description: 'Ask anything about distance, recovery windows, and reading early stress signals.',
    scheduled_at: buildUpcomingDate(3, 19),
    capacity: 80,
  },
  {
    id: 'ama-patterns',
    expert_name: 'Merve Tan',
    credentials: 'IAABC-CDBC',
    topic: 'Pattern Games for Reactive Walks',
    description: 'Live AMA focused on practical BAT/LAT pattern games for real city walks.',
    scheduled_at: buildUpcomingDate(7, 20),
    capacity: 100,
  },
  {
    id: 'ama-recovery',
    expert_name: 'Arda Aksoy',
    credentials: 'CCPDT-KA',
    topic: 'After-Reaction Recovery Routines',
    description: 'How to reset after a rough encounter and prevent trigger stacking for the rest of the day.',
    scheduled_at: buildUpcomingDate(12, 19),
    capacity: 60,
  },
];

function CommunityScreenContent() {
  const insets = useSafeAreaInsets();
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'win_of_the_day' | 'question' | 'success_story'>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'general' | 'win_of_the_day' | 'question' | 'success_story'>('general');
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [localMapVisible, setLocalMapVisible] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [loadingLocationStatus, setLoadingLocationStatus] = useState(true);
  const [updatingLocationShare, setUpdatingLocationShare] = useState(false);
  const [nearbyOwners, setNearbyOwners] = useState<OwnerLocation[]>([]);
  const [loadingNearbyOwners, setLoadingNearbyOwners] = useState(false);
  const [ownerMapRegion, setOwnerMapRegion] = useState(DEFAULT_MAP_REGION);
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('all');
  const [myLocationPoint, setMyLocationPoint] = useState<CoordinatePoint | null>(null);
  const [expertSessions, setExpertSessions] = useState<ExpertSession[]>([]);
  const [loadingExpertSessions, setLoadingExpertSessions] = useState(true);
  const [rsvpSessionIds, setRsvpSessionIds] = useState<string[]>([]);
  const [sessionRsvpCounts, setSessionRsvpCounts] = useState<Record<string, number>>({});
  const [privacyDialogVisible, setPrivacyDialogVisible] = useState(false);

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
    fetchUserId();

    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    fetchLocationSharingStatus();
  }, []);

  const fetchUserId = async () => {
    try {
      const user = getCurrentUser();
      setUserId(user?.id || null);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchSessionRsvps = useCallback(async (sessions: ExpertSession[]) => {
    try {
      if (sessions.length === 0) {
        setSessionRsvpCounts({});
        setRsvpSessionIds([]);
        return;
      }

      const user = getCurrentUser();
      const sessionsFilter = sessions.map((session) => `session_id = "${session.id}"`).join(' || ');

      const records = await pb.collection('expert_qa_rsvps').getFullList({
        filter: sessionsFilter,
        requestKey: null,
      });

      const counts: Record<string, number> = {};
      const userRsvpIds: string[] = [];

      (records as unknown as { session_id: string; owner_id: string }[]).forEach((record) => {
        counts[record.session_id] = (counts[record.session_id] || 0) + 1;
        if (user && record.owner_id === user.id) {
          userRsvpIds.push(record.session_id);
        }
      });

      setSessionRsvpCounts(counts);
      setRsvpSessionIds(userRsvpIds);
    } catch (error: any) {
      if (error?.status !== 404) {
        console.error('Error fetching expert RSVP records:', error);
      }
      setSessionRsvpCounts({});
      setRsvpSessionIds([]);
    }
  }, []);

  const fetchExpertSessions = useCallback(async () => {
    try {
      setLoadingExpertSessions(true);
      const nowIso = new Date().toISOString();
      const result = await pb.collection('expert_qa_sessions').getList(1, 10, {
        filter: `scheduled_at >= "${nowIso}" && is_active = true`,
        sort: 'scheduled_at',
        requestKey: null,
      });

      let nextSessions: ExpertSession[] = [];
      if (result.items.length > 0) {
        nextSessions = result.items as unknown as ExpertSession[];
      } else {
        nextSessions = FALLBACK_EXPERT_SESSIONS;
      }

      setExpertSessions(nextSessions);
      await fetchSessionRsvps(nextSessions);
    } catch {
      setExpertSessions(FALLBACK_EXPERT_SESSIONS);
      await fetchSessionRsvps(FALLBACK_EXPERT_SESSIONS);
    } finally {
      setLoadingExpertSessions(false);
    }
  }, [fetchSessionRsvps]);

  useEffect(() => {
    fetchExpertSessions();
  }, [fetchExpertSessions]);

  useEffect(() => {
    if (expertSessions.length > 0) {
      fetchSessionRsvps(expertSessions);
    }
  }, [userId, expertSessions, fetchSessionRsvps]);

  const toggleSessionRsvp = async (sessionId: string) => {
    const user = getCurrentUser();
    if (!user) {
      triggerErrorHaptic();
      Alert.alert('Login required', 'Please log in to RSVP for expert Q&A sessions.');
      return;
    }

    const alreadyRsvped = rsvpSessionIds.includes(sessionId);
    triggerTapHaptic();

    try {
      if (alreadyRsvped) {
        const record = await pb.collection('expert_qa_rsvps').getFirstListItem(
          `session_id = "${sessionId}" && owner_id = "${user.id}"`,
          { requestKey: null }
        );
        await pb.collection('expert_qa_rsvps').delete(record.id);

        setRsvpSessionIds((prev) => prev.filter((id) => id !== sessionId));
        setSessionRsvpCounts((prev) => ({
          ...prev,
          [sessionId]: Math.max((prev[sessionId] || 1) - 1, 0),
        }));
        triggerSuccessHaptic();
      } else {
        await pb.collection('expert_qa_rsvps').create({
          session_id: sessionId,
          owner_id: user.id,
        });

        setRsvpSessionIds((prev) => [...prev, sessionId]);
        setSessionRsvpCounts((prev) => ({
          ...prev,
          [sessionId]: (prev[sessionId] || 0) + 1,
        }));
        triggerSuccessHaptic();
      }
    } catch (error: any) {
      triggerErrorHaptic();
      if (error?.status === 404) {
        Alert.alert(
          'Setup needed',
          'expert_qa_sessions/expert_qa_rsvps collections are not available yet. Please import the updated PocketBase schema.'
        );
      } else {
        Alert.alert('Action failed', 'Could not update RSVP. Please try again.');
      }
    }
  };

  const openQuestionComposer = (session: ExpertSession) => {
    setNewPostType('question');
    if (!newPostTitle.trim()) {
      setNewPostTitle(`Q&A: ${session.topic}`);
    }
    setModalVisible(true);
  };

  const roundCoordinate = (value: number) => {
    return Number(value.toFixed(LOCATION_PRECISION));
  };

  const formatDistance = (distanceKm: number | null) => {
    if (distanceKm === null) {
      return '-';
    }

    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }

    return `${distanceKm.toFixed(1)} km`;
  };

  const getOwnerAlias = (ownerId: string) => {
    const adjectives = ['Brave', 'Calm', 'Patient', 'Dedicated', 'Caring', 'Steady', 'Gentle', 'Wise'];
    const animals = ['Retriever', 'Shepherd', 'Hound', 'Terrier', 'Collie', 'Poodle', 'Bulldog', 'Spaniel'];
    let hash = 0;

    for (let i = 0; i < ownerId.length; i++) {
      hash = ((hash << 5) - hash) + ownerId.charCodeAt(i);
      hash = hash & hash;
    }

    const adjIndex = Math.abs(hash) % adjectives.length;
    const animalIndex = Math.abs(hash >> 8) % animals.length;

    return `${adjectives[adjIndex]} ${animals[animalIndex]}`;
  };

  const updateMapRegion = (owners: OwnerLocation[]) => {
    if (owners.length === 0) {
      return;
    }

    const latitudes = owners.map(owner => owner.latitude);
    const longitudes = owners.map(owner => owner.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    setOwnerMapRegion({
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.03),
      longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.03),
    });
  };

  const fetchLocationSharingStatus = async () => {
    try {
      setLoadingLocationStatus(true);
      const user = getCurrentUser();

      if (!user) {
        setLocationSharingEnabled(false);
        return;
      }

      const record = await pb.collection('community_owner_locations').getFirstListItem(
        `owner_id = "${user.id}"`,
        { requestKey: null }
      );

      setLocationSharingEnabled(Boolean(record.is_visible));
    } catch (error: any) {
      if (error?.status !== 404) {
        console.error('Error fetching location sharing status:', error);
      }
      setLocationSharingEnabled(false);
    } finally {
      setLoadingLocationStatus(false);
    }
  };

  const fetchNearbyOwners = async () => {
    try {
      setLoadingNearbyOwners(true);
      const user = getCurrentUser();

      if (!user) {
        setNearbyOwners([]);
        return;
      }

      const records = await pb.collection('community_owner_locations').getFullList({
        filter: 'is_visible = true',
        sort: '-updated',
        requestKey: null,
      });

      try {
        const ownRecord = await pb.collection('community_owner_locations').getFirstListItem(
          `owner_id = "${user.id}"`,
          { requestKey: null }
        ) as unknown as OwnerLocation;

        setMyLocationPoint({
          latitude: ownRecord.latitude,
          longitude: ownRecord.longitude,
        });
      } catch {
        setMyLocationPoint(null);
      }

      const owners = (records as unknown as OwnerLocation[]).filter(owner => owner.owner_id !== user.id);
      setNearbyOwners(owners);
      updateMapRegion(owners);
    } catch (error: any) {
      if (error?.status !== 404) {
        console.error('Error fetching nearby owners:', error);
      }
      setNearbyOwners([]);
    } finally {
      setLoadingNearbyOwners(false);
    }
  };

  const upsertLocationShare = async (enabled: boolean) => {
    try {
      setUpdatingLocationShare(true);
      const user = getCurrentUser();

      if (!user) {
        Alert.alert('Login required', 'Please log in again to update your map visibility.');
        return;
      }

      let existingRecord: OwnerLocation | null = null;

      try {
        existingRecord = await pb.collection('community_owner_locations').getFirstListItem(
          `owner_id = "${user.id}"`,
          { requestKey: null }
        ) as unknown as OwnerLocation;
      } catch (error: any) {
        if (error?.status !== 404) {
          throw error;
        }
      }

      if (!enabled) {
        if (existingRecord) {
          await pb.collection('community_owner_locations').delete(existingRecord.id);
        }
        setLocationSharingEnabled(false);
        setMyLocationPoint(null);
        await fetchNearbyOwners();
        return;
      }

      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'To appear on the local owner map, please allow location access.'
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = roundCoordinate(position.coords.latitude);
      const longitude = roundCoordinate(position.coords.longitude);

      setMyLocationPoint({ latitude, longitude });

      if (existingRecord) {
        await pb.collection('community_owner_locations').update(existingRecord.id, {
          latitude,
          longitude,
          is_visible: true,
        });
      } else {
        await pb.collection('community_owner_locations').create({
          owner_id: user.id,
          latitude,
          longitude,
          is_visible: true,
          share_precision_m: LOCATION_PRECISION_METERS,
        });
      }

      setLocationSharingEnabled(true);
      await fetchNearbyOwners();
    } catch (error: any) {
      console.error('Error updating location sharing:', error?.response?.data || error);

      if (error?.status === 404) {
        Alert.alert(
          'Setup needed',
          'community_owner_locations collection is not available yet. Please import the updated PocketBase schema.'
        );
      } else {
        Alert.alert('Update failed', 'Could not update map visibility. Please try again.');
      }
    } finally {
      setUpdatingLocationShare(false);
    }
  };

  const openLocalMap = async () => {
    setLocalMapVisible(true);
    await fetchNearbyOwners();
  };

  const nearbyOwnersWithDistance = useMemo(() => {
    return nearbyOwners.map((owner) => {
      const distanceKm = myLocationPoint
        ? distanceKmBetween(myLocationPoint, { latitude: owner.latitude, longitude: owner.longitude })
        : null;

      return {
        ...owner,
        distanceKm,
      };
    });
  }, [nearbyOwners, myLocationPoint]);

  const filteredNearbyOwners = useMemo(() => {
    if (radiusFilter === 'all') {
      return nearbyOwnersWithDistance;
    }

    return nearbyOwnersWithDistance.filter((owner) => owner.distanceKm !== null && owner.distanceKm <= radiusFilter);
  }, [nearbyOwnersWithDistance, radiusFilter]);

  useEffect(() => {
    const regionOwners = filteredNearbyOwners.map((owner) => ({
      id: owner.id,
      owner_id: owner.owner_id,
      latitude: owner.latitude,
      longitude: owner.longitude,
      is_visible: owner.is_visible,
      updated: owner.updated,
    }));

    updateMapRegion(regionOwners);
  }, [filteredNearbyOwners]);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      
      let filter = '';
      if (activeFilter !== 'all') {
        filter = `post_type = "${activeFilter}"`;
      }

      const records = await pb.collection('community_posts').getList(1, 100, {
        filter,
        sort: '-created',
        expand: 'author_id',
        requestKey: null,
      });

      setPosts(records.items as unknown as CommunityPost[]);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      triggerErrorHaptic();
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    try {
      triggerTapHaptic();
      setSubmitting(true);
      const user = getCurrentUser();
      
      if (!user) {
        triggerErrorHaptic();
        Alert.alert('Error', 'You must be logged in to post');
        return;
      }

      await pb.collection('community_posts').create({
        author_id: user.id,
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        post_type: newPostType,
        likes_count: 0,
      });

      // Reset form and close modal
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostType('general');
      setModalVisible(false);
      
      // Refresh posts
      fetchPosts();
      
      triggerSuccessHaptic();
      Alert.alert('Success', 'Your post has been published!');
    } catch (error) {
      console.error('Error creating post:', error);
      triggerErrorHaptic();
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      await pb.collection('community_posts').update(postId, {
        'likes_count+': 1,
      });

      // Update local state
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, likes_count: post.likes_count + 1 }
            : post
        )
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getAnonymousName = (postId: string) => {
    // Generate a consistent anonymous name based on post ID
    const adjectives = ['Brave', 'Calm', 'Patient', 'Dedicated', 'Caring', 'Strong', 'Gentle', 'Wise'];
    const animals = ['Puppy', 'Retriever', 'Shepherd', 'Hound', 'Terrier', 'Collie', 'Poodle', 'Bulldog'];
    
    // Simple hash function for consistent results
    let hash = 0;
    for (let i = 0; i < postId.length; i++) {
      hash = ((hash << 5) - hash) + postId.charCodeAt(i);
      hash = hash & hash;
    }
    
    const adjIndex = Math.abs(hash) % adjectives.length;
    const animalIndex = Math.abs(hash >> 8) % animals.length;
    
    return `${adjectives[adjIndex]} ${animals[animalIndex]}`;
  };

  const formatSessionTime = (dateValue: string) => {
    return new Date(dateValue).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getSpotsLeft = (session: ExpertSession) => {
    const joinedCount = sessionRsvpCounts[session.id] || 0;
    return Math.max(session.capacity - joinedCount, 0);
  };

  const renderFilterButton = (filter: typeof FILTER_OPTIONS[0]) => {
    const isActive = activeFilter === filter;
    const label = filter === 'all' ? 'All Posts' : POST_TYPE_CONFIG[filter].label;
    
    return (
      <Pressable
        key={filter}
        style={({ pressed }) => [
          styles.filterButton,
          isActive && styles.filterButtonActive,
          pressed && styles.pressScaleSoft,
        ]}
        onPress={() => setActiveFilter(filter)}
      >
        <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  const renderPost = (post: CommunityPost) => {
    const config = POST_TYPE_CONFIG[post.post_type];
    const isOwnPost = post.author_id === userId;
    
    return (
      <Card key={post.id} style={styles.postCard}>
        <Card.Content>
        <View style={styles.postHeader}>
          <View style={[styles.postTypeBadge, { backgroundColor: config.bgColor }]}> 
            <MaterialCommunityIcons name={config.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={14} color={config.color} />
            <Text style={[styles.postTypeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          <Text style={styles.postDate}>{formatDate(post.created)}</Text>
        </View>
        
        <Text style={styles.postTitle}>{post.title}</Text>
        <Text style={styles.postContent}>{post.content}</Text>
        
        <View style={styles.postFooter}>
          <View style={styles.authorContainer}>
            <MaterialCommunityIcons name="incognito" size={14} color="#9CA3AF" />
            <Text style={styles.authorText}>
              {isOwnPost ? 'You' : getAnonymousName(post.id)}
            </Text>
          </View>
          
          <Pressable
            style={({ pressed }) => [styles.likeButton, pressed && styles.pressScaleSoft]}
            onPress={() => handleLikePost(post.id)}
          >
            <MaterialCommunityIcons 
              name={post.likes_count > 0 ? "heart" : "heart-outline"} 
              size={18} 
              color={post.likes_count > 0 ? "#EF4444" : "#9CA3AF"} 
            />
            <Text style={[styles.likeCount, post.likes_count > 0 && styles.likeCountActive]}>
              {post.likes_count}
            </Text>
          </Pressable>
        </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={{
          flex: 1,
          opacity: entranceAnim,
          transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>
            Connect with other reactive dog owners
          </Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="map-marker-radius"
            mode="contained-tonal"
            containerColor="#E0EDFF"
            iconColor={ACCENT_COLOR}
            size={22}
            onPress={openLocalMap}
          />
          <IconButton
            icon="plus"
            mode="contained"
            containerColor={ACCENT_COLOR}
            iconColor="#fff"
            size={22}
            onPress={() => setModalVisible(true)}
          />
        </View>
      </View>

      <View style={styles.localMapCard}>
        <View style={styles.localMapCardTop}>
          <View style={styles.localMapCardIconWrap}>
            <MaterialCommunityIcons name="map-marker-account-outline" size={20} color="#1D4ED8" />
          </View>
          <View style={styles.localMapCardTextWrap}>
            <Text style={styles.localMapCardTitle}>Local owner map (opt-in)</Text>
            <Text style={styles.localMapCardSubtitle}>
              Share an approximate location to find nearby reactive dog owners.
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.localMapOpenCta, pressed && styles.pressScale]}
          onPress={openLocalMap}
        >
          <Text style={styles.localMapOpenCtaText}>Open map</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#1D4ED8" />
        </Pressable>
      </View>

      <View style={styles.expertSection}>
        <View style={styles.expertHeader}>
          <View>
            <Text style={styles.expertTitle}>Expert Q&A Sessions</Text>
            <Text style={styles.expertSubtitle}>Behaviorist AMAs from the reactive-dog community</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.expertRefreshButton, pressed && styles.pressScale]} onPress={fetchExpertSessions}>
            <MaterialCommunityIcons name="refresh" size={16} color="#0E7490" />
          </Pressable>
        </View>

        {loadingExpertSessions ? (
          <View style={styles.expertLoadingWrap}>
            <ActivityIndicator size="small" color="#0891B2" />
            <Text style={styles.expertLoadingText}>Loading sessions...</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.expertCardsWrap}
          >
            {expertSessions.map((session) => {
              const isRsvped = rsvpSessionIds.includes(session.id);
              const spotsLeft = getSpotsLeft(session);

              return (
                <View key={session.id} style={styles.expertCard}>
                  <Text style={styles.expertCardTopic}>{session.topic}</Text>
                  <Text style={styles.expertCardExpert}>{session.expert_name} • {session.credentials}</Text>
                  <Text style={styles.expertCardTime}>{formatSessionTime(session.scheduled_at)}</Text>
                  <Text style={styles.expertCardDescription}>{session.description}</Text>

                  <View style={styles.expertMetaRow}>
                    <View style={styles.expertMetaBadge}>
                      <MaterialCommunityIcons name="account-group-outline" size={14} color="#0E7490" />
                      <Text style={styles.expertMetaText}>{spotsLeft} spots left</Text>
                    </View>
                  </View>

                  <View style={styles.expertActionsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.expertPrimaryButton, isRsvped && styles.expertPrimaryButtonActive, pressed && styles.pressScale]}
                      onPress={() => toggleSessionRsvp(session.id)}
                    >
                      <MaterialCommunityIcons
                        name={isRsvped ? 'check-circle' : 'calendar-check-outline'}
                        size={16}
                        color={isRsvped ? '#065F46' : '#0E7490'}
                      />
                      <Text style={[styles.expertPrimaryButtonText, isRsvped && styles.expertPrimaryButtonTextActive]}>
                        {isRsvped ? 'RSVPd' : 'RSVP'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.expertSecondaryButton, pressed && styles.pressScale]}
                      onPress={() => openQuestionComposer(session)}
                    >
                      <Text style={styles.expertSecondaryButtonText}>Ask question</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map(renderFilterButton)}
        </ScrollView>
      </View>

      {/* Posts Feed */}
      <ScrollView
        style={styles.postsContainer}
        contentContainerStyle={styles.postsContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="message-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No posts yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Be the first to share your experience or ask a question!
            </Text>
            <Button mode="contained" style={styles.emptyStateButton} labelStyle={styles.emptyStateButtonText} onPress={() => setModalVisible(true)}>
              Create First Post
            </Button>
          </View>
        ) : (
          <View style={styles.postsList}>
            {posts.map(renderPost)}
          </View>
        )}
      </ScrollView>
      </Animated.View>

      <Portal>
        <PaperModal
          visible={localMapVisible}
          onDismiss={() => setLocalMapVisible(false)}
          contentContainerStyle={styles.mapModalOverlay}
        >
          <View style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <View>
                <Text style={styles.mapModalTitle}>Local Owner Map</Text>
                <Text style={styles.mapModalSubtitle}>Approximate locations only (about 110m precision)</Text>
              </View>
              <IconButton icon="close" mode="contained-tonal" onPress={() => setLocalMapVisible(false)} />
            </View>

            <View style={styles.mapShareRow}>
              <View style={styles.mapShareTextWrap}>
                <Text style={styles.mapShareTitle}>Share my location</Text>
                <Text style={styles.mapShareSubtitle}>
                  Turn on to appear for other owners nearby.
                </Text>
              </View>
              {loadingLocationStatus || updatingLocationShare ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <Switch
                  value={locationSharingEnabled}
                  onValueChange={upsertLocationShare}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={locationSharingEnabled ? '#1D4ED8' : '#F3F4F6'}
                />
              )}
            </View>

            <View style={styles.privacyNote}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color="#0369A1" />
              <Text style={styles.privacyNoteText}>
                Your exact address is never shared. Only approximate area is shown.
              </Text>
              <IconButton
                icon="information-outline"
                size={16}
                onPress={() => setPrivacyDialogVisible(true)}
              />
            </View>

            <View style={styles.radiusRow}>
              <Text style={styles.radiusRowLabel}>Radius</Text>
              <View style={styles.radiusButtonsWrap}>
                {(['all', 5, 10, 20] as RadiusFilter[]).map((radius) => {
                  const isActive = radiusFilter === radius;
                  const label = radius === 'all' ? 'All' : `${radius} km`;

                  return (
                    <Chip
                      key={String(radius)}
                      style={[styles.radiusButton, isActive && styles.radiusButtonActive]}
                      selected={isActive}
                      mode={isActive ? 'flat' : 'outlined'}
                      onPress={() => setRadiusFilter(radius)}
                    >
                      {label}
                    </Chip>
                  );
                })}
              </View>
            </View>

            {radiusFilter !== 'all' && !myLocationPoint && (
              <View style={styles.radiusHintBox}>
                <MaterialCommunityIcons name="information-outline" size={15} color="#92400E" />
                <Text style={styles.radiusHintText}>
                  Enable location sharing once to use km radius filtering.
                </Text>
              </View>
            )}

            <View style={styles.ownerMapWrap}>
              <MapView
                style={styles.ownerMap}
                region={ownerMapRegion}
                onRegionChangeComplete={setOwnerMapRegion}
              >
                {filteredNearbyOwners.map((owner) => (
                  <Marker
                    key={owner.id}
                    coordinate={{
                      latitude: owner.latitude,
                      longitude: owner.longitude,
                    }}
                    pinColor="#2563EB"
                    title={getOwnerAlias(owner.owner_id)}
                    description={`Approx. ${formatDistance(owner.distanceKm)}`}
                  />
                ))}
              </MapView>
              {(loadingNearbyOwners || updatingLocationShare) && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="large" color="#1D4ED8" />
                </View>
              )}
            </View>

            {filteredNearbyOwners.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.distanceBadgesWrap}
              >
                {filteredNearbyOwners.slice(0, 20).map((owner) => (
                  <View key={owner.id} style={styles.distanceBadge}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color="#1D4ED8" />
                    <Text style={styles.distanceBadgeName}>{getOwnerAlias(owner.owner_id)}</Text>
                    <Text style={styles.distanceBadgeValue}>{formatDistance(owner.distanceKm)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.mapFooterRow}>
              <Text style={styles.mapFooterText}>{filteredNearbyOwners.length} owner(s) nearby</Text>
              <Button mode="contained-tonal" icon="refresh" onPress={fetchNearbyOwners} style={styles.refreshNearbyButton}>
                Refresh
              </Button>
            </View>
          </View>
        </PaperModal>

        <Dialog visible={privacyDialogVisible} onDismiss={() => setPrivacyDialogVisible(false)}>
          <Dialog.Title>Privacy by Design</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Your map pin is rounded to an approximate area (about 110m precision). No exact address is stored or shared.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPrivacyDialogVisible(false)}>Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <PaperModal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <IconButton icon="close" mode="contained-tonal" onPress={() => setModalVisible(false)} />
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Post Type Selection */}
              <Text style={styles.inputLabel}>Post Type</Text>
              <View style={styles.typeSelection}>
                {Object.entries(POST_TYPE_CONFIG).map(([type, config]) => (
                  <Chip
                    key={type}
                    style={[
                      styles.typeButton,
                      newPostType === type && { 
                        backgroundColor: config.bgColor,
                        borderColor: config.color,
                        borderWidth: 2
                      }
                    ]}
                    selected={newPostType === type}
                    mode={newPostType === type ? 'flat' : 'outlined'}
                    onPress={() => setNewPostType(type as 'general' | 'win_of_the_day' | 'question' | 'success_story')}
                  >
                    {config.label}
                  </Chip>
                ))}
              </View>

              {/* Title Input */}
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="What's on your mind?"
                mode="outlined"
                value={newPostTitle}
                onChangeText={setNewPostTitle}
                maxLength={100}
              />

              {/* Content Input */}
              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={styles.contentInput}
                placeholder="Share your story, ask a question, or celebrate a win..."
                mode="outlined"
                value={newPostContent}
                onChangeText={setNewPostContent}
                multiline
                numberOfLines={6}
                maxLength={1000}
              />

              {/* Anonymous Notice */}
              <View style={styles.anonymousNotice}>
                <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
                <Text style={styles.anonymousText}>
                  Your post will be anonymous. Other users will see you as a randomly generated name.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonText}
                onPress={() => setModalVisible(false)}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                style={[
                  styles.submitButton,
                  (!newPostTitle.trim() || !newPostContent.trim() || submitting) && 
                    styles.submitButtonDisabled
                ]}
                labelStyle={styles.submitButtonText}
                onPress={handleCreatePost}
                disabled={!newPostTitle.trim() || !newPostContent.trim() || submitting}
              >
                {submitting ? 'Publishing...' : 'Publish Post'}
              </Button>
            </View>
          </KeyboardAvoidingView>
        </PaperModal>
      </Portal>

      <FAB
        icon="plus"
        color="#fff"
        style={[styles.createFab, { bottom: insets.bottom + 86 }]}
        label="New Post"
        onPress={() => setModalVisible(true)}
      />
    </SafeAreaView>
  );
}

export default function CommunityScreen() {
  return (
    <PremiumGate
      featureName="Community Hub"
      description="Access local owner map, expert Q&A sessions, and community posting tools."
      source="community"
    >
      <CommunityScreenContent />
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7FB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  mapOpenButton: {
    width: 48,
    height: 48,
    backgroundColor: '#E0EDFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPostButton: {
    width: 48,
    height: 48,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  localMapCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFD2EE',
    backgroundColor: '#F0F5FF',
    gap: 12,
  },
  localMapCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  localMapCardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0EDFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localMapCardTextWrap: {
    flex: 1,
  },
  localMapCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  localMapCardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: ACCENT_COLOR,
    lineHeight: 18,
  },
  localMapOpenCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E0EDFF',
  },
  localMapOpenCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  expertSection: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    borderRadius: 14,
    backgroundColor: '#ECFEFF',
    padding: 14,
  },
  expertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  expertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0E7490',
  },
  expertSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#155E75',
  },
  expertRefreshButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#CFFAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expertLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  expertLoadingText: {
    fontSize: 13,
    color: '#0E7490',
  },
  expertCardsWrap: {
    gap: 10,
    paddingRight: 4,
  },
  expertCard: {
    width: 275,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CFFAFE',
    borderRadius: 12,
    padding: 12,
  },
  expertCardTopic: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  expertCardExpert: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0E7490',
    marginBottom: 2,
  },
  expertCardTime: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  expertCardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#334155',
    minHeight: 54,
  },
  expertMetaRow: {
    marginTop: 10,
  },
  expertMetaBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFEFF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  expertMetaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
  },
  expertActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  expertPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CFFAFE',
    borderRadius: 10,
    paddingVertical: 8,
  },
  expertPrimaryButtonActive: {
    backgroundColor: '#D1FAE5',
  },
  expertPrimaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7490',
  },
  expertPrimaryButtonTextActive: {
    color: '#065F46',
  },
  expertSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  expertSecondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7490',
  },
  filterWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D9E2EC',
    backgroundColor: '#fff',
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EAF0F8',
  },
  filterButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: ACCENT_COLOR,
  },
  postsContainer: {
    flex: 1,
  },
  postsContent: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 140,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postsList: {
    gap: 12,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E2EC',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  postTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  postDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  postTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  pressScale: {
    transform: [{ scale: 0.98 }],
  },
  pressScaleSoft: {
    transform: [{ scale: 0.985 }],
  },
  likeCount: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  likeCountActive: {
    color: '#EF4444',
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  mapModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    paddingBottom: 18,
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D9E2EC',
  },
  mapModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  mapModalSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  mapShareRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapShareTextWrap: {
    flex: 1,
  },
  mapShareTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  mapShareSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  privacyNote: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#075985',
    lineHeight: 16,
  },
  radiusRow: {
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  radiusRowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  radiusButtonsWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFD2EE',
    backgroundColor: '#F0F5FF',
  },
  radiusButtonActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  radiusHintBox: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radiusHintText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },
  ownerMapWrap: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BFD2EE',
    flex: 1,
    minHeight: 260,
  },
  ownerMap: {
    flex: 1,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  distanceBadgesWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F5FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFD2EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  distanceBadgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  distanceBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  mapFooterRow: {
    marginTop: 14,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapFooterText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  refreshNearbyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0EDFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  refreshNearbyText: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  dialogText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#D9E2EC',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EAF0F8',
    gap: 6,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  titleInput: {
    backgroundColor: '#EEF2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 20,
  },
  contentInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 120,
    marginBottom: 20,
  },
  anonymousNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  anonymousText: {
    flex: 1,
    fontSize: 13,
    color: '#059669',
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: ACCENT_COLOR,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  createFab: {
    position: 'absolute',
    right: 18,
    backgroundColor: ACCENT_COLOR,
  },
});
