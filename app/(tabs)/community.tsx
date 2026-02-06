import { useState, useEffect, useCallback } from 'react';
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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb, getCurrentUser } from '../../lib/pocketbase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

const FILTER_OPTIONS: Array<'all' | 'win_of_the_day' | 'question' | 'success_story'> = [
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

  useEffect(() => {
    fetchUserId();
    fetchPosts();
  }, [activeFilter]);

  const fetchUserId = async () => {
    try {
      const user = getCurrentUser();
      setUserId(user?.id || null);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchPosts = async () => {
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
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [activeFilter]);

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
        <TouchableOpacity
          style={styles.newPostButton}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
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
