import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Modal,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb, getCurrentUser } from '../../lib/pocketbase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

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

export default function CommunityScreen() {
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

  useEffect(() => {
    fetchUserId();
  }, []);

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
          await pb.collection('community_owner_locations').update(existingRecord.id, {
            is_visible: false,
          });
        }
        setLocationSharingEnabled(false);
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

      const payload = {
        owner_id: user.id,
        latitude,
        longitude,
        is_visible: true,
        share_precision_m: LOCATION_PRECISION_METERS,
      };

      if (existingRecord) {
        await pb.collection('community_owner_locations').update(existingRecord.id, payload);
      } else {
        await pb.collection('community_owner_locations').create(payload);
      }

      setLocationSharingEnabled(true);
      await fetchNearbyOwners();
    } catch (error: any) {
      console.error('Error updating location sharing:', error);

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
      Alert.alert('Error', 'Please fill in both title and content');
      return;
    }

    try {
      setSubmitting(true);
      const user = getCurrentUser();
      
      if (!user) {
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
      
      Alert.alert('Success', 'Your post has been published!');
    } catch (error) {
      console.error('Error creating post:', error);
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

  const renderFilterButton = (filter: typeof FILTER_OPTIONS[0]) => {
    const isActive = activeFilter === filter;
    const label = filter === 'all' ? 'All Posts' : POST_TYPE_CONFIG[filter].label;
    
    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterButton,
          isActive && styles.filterButtonActive
        ]}
        onPress={() => setActiveFilter(filter)}
      >
        <Text style={[
          styles.filterButtonText,
          isActive && styles.filterButtonTextActive
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPost = (post: CommunityPost) => {
    const config = POST_TYPE_CONFIG[post.post_type];
    const isOwnPost = post.author_id === userId;
    
    return (
      <View key={post.id} style={styles.postCard}>
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
          
          <TouchableOpacity 
            style={styles.likeButton}
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
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>
            Connect with other reactive dog owners
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.mapOpenButton}
            onPress={openLocalMap}
          >
            <MaterialCommunityIcons name="map-marker-radius" size={20} color="#1D4ED8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newPostButton}
            onPress={() => setModalVisible(true)}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.localMapOpenCta}
          onPress={openLocalMap}
        >
          <Text style={styles.localMapOpenCtaText}>Open map</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#1D4ED8" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_OPTIONS.map(renderFilterButton)}
      </ScrollView>

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
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.emptyStateButtonText}>Create First Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsList}>
            {posts.map(renderPost)}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={localMapVisible}
        onRequestClose={() => setLocalMapVisible(false)}
      >
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <View>
                <Text style={styles.mapModalTitle}>Local Owner Map</Text>
                <Text style={styles.mapModalSubtitle}>Approximate locations only (about 110m precision)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setLocalMapVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
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
            </View>

            <View style={styles.radiusRow}>
              <Text style={styles.radiusRowLabel}>Radius</Text>
              <View style={styles.radiusButtonsWrap}>
                {(['all', 5, 10, 20] as RadiusFilter[]).map((radius) => {
                  const isActive = radiusFilter === radius;
                  const label = radius === 'all' ? 'All' : `${radius} km`;

                  return (
                    <TouchableOpacity
                      key={String(radius)}
                      style={[styles.radiusButton, isActive && styles.radiusButtonActive]}
                      onPress={() => setRadiusFilter(radius)}
                    >
                      <Text style={[styles.radiusButtonText, isActive && styles.radiusButtonTextActive]}>{label}</Text>
                    </TouchableOpacity>
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
              <TouchableOpacity onPress={fetchNearbyOwners} style={styles.refreshNearbyButton}>
                <MaterialCommunityIcons name="refresh" size={16} color="#1D4ED8" />
                <Text style={styles.refreshNearbyText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Post Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Post Type Selection */}
              <Text style={styles.inputLabel}>Post Type</Text>
              <View style={styles.typeSelection}>
                {Object.entries(POST_TYPE_CONFIG).map(([type, config]) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newPostType === type && { 
                        backgroundColor: config.bgColor,
                        borderColor: config.color,
                        borderWidth: 2
                      }
                    ]}
                    onPress={() => setNewPostType(type as 'general' | 'win_of_the_day' | 'question' | 'success_story')}
                  >
                    <MaterialCommunityIcons 
                      name={config.icon as keyof typeof MaterialCommunityIcons.glyphMap} 
                      size={20} 
                      color={config.color} 
                    />
                    <Text style={[styles.typeButtonText, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title Input */}
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#9CA3AF"
                value={newPostTitle}
                onChangeText={setNewPostTitle}
                maxLength={100}
              />

              {/* Content Input */}
              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={styles.contentInput}
                placeholder="Share your story, ask a question, or celebrate a win..."
                placeholderTextColor="#9CA3AF"
                value={newPostContent}
                onChangeText={setNewPostContent}
                multiline
                numberOfLines={6}
                maxLength={1000}
                textAlignVertical="top"
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
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!newPostTitle.trim() || !newPostContent.trim() || submitting) && 
                    styles.submitButtonDisabled
                ]}
                onPress={handleCreatePost}
                disabled={!newPostTitle.trim() || !newPostContent.trim() || submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Publishing...' : 'Publish Post'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
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
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPostButton: {
    width: 48,
    height: 48,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
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
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
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
    backgroundColor: '#DBEAFE',
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
    color: '#1D4ED8',
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
    backgroundColor: '#DBEAFE',
  },
  localMapOpenCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  filterContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#EDE9FE',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#7C3AED',
  },
  postsContainer: {
    flex: 1,
  },
  postsContent: {
    padding: 16,
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
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
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
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
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
    borderBottomColor: '#E5E7EB',
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  radiusButtonActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  radiusButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  radiusButtonTextActive: {
    color: '#fff',
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
    borderColor: '#DBEAFE',
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
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
    color: '#1D4ED8',
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
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  refreshNearbyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  titleInput: {
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#C4B5FD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
