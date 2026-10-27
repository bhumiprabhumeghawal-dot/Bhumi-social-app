import { StatusBar } from 'expo-status-bar';
import appConfig from './app.json';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Alert, Share, Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { applyZoomEffect, createVideoFromPhotos, addMusicToVideo } from './videoEditor';
import { editPhotoAsset } from './photoEditor';
import {
  loadContent, uploadContent, checkServer,
  loadProfile, updateProfile, uploadProfileAvatar,
  deleteProfileAvatar, loadProfileConnections,
  loadPrivacySettings, savePrivacySettings, changeAccountPassword,
  loadAccountSettings, saveAccountSettings,
  loadNotificationPreference, saveNotificationPreference, loadNotificationDetails, saveNotificationDetails,
  togglePostLike, loadPostComments, createPostComment,
  registerAccount, loginAccount, getAuthSession, clearAuthSession,
  requestPasswordReset, verifyPasswordReset, resetPasswordWithToken, verifyAuthSession} from './api';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  TouchableOpacity,
  Switch,
  Modal,
  Linking,
} from 'react-native';



function isVersionNewer(latest, current) {
  const a = String(latest || '0').split('.').map(n => parseInt(n, 10) || 0);
  const b = String(current || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

const stories = [
  { name: 'Your story', color: '#DDE7F5', own: true },
  { name: 'alex', color: '#F3C6B8' },
  { name: 'sophia', color: '#D7C4F1' },
  { name: 'mike', color: '#B8DCCB' },
  { name: 'emma', color: '#F1D69B' },
  { name: 'noah', color: '#B9D8EF' },
];

const posts = [
  {
    user: 'alex.morgan',
    location: 'San Francisco, CA',
    color: '#D8E7DF',
    emoji: '🌿',
    caption: 'Finding beauty in the little things.',
    likes: '1,284',
  },
  {
    user: 'sophia.lee',
    location: 'At the coast',
    color: '#D5E5F4',
    emoji: '🌊',
    caption: 'A little escape from the everyday.',
    likes: '856',
  },
];


function Story({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.story} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.storyRing, item.own && styles.ownRing]}>
        <View style={[styles.storyAvatar, { backgroundColor: item.color || '#DDE7F5' }]}>
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={{ width: 52, height: 52, borderRadius: 26 }} />
          ) : item.own ? (
            <Text style={styles.plus}>＋</Text>
          ) : (
            <Text style={styles.avatarLetter}>{(item.name || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
      </View>
      <Text style={styles.storyName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );
}

// SOCIALAPP_MEDIA_MASTER2
function ZoomableImage({ uri, style }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [fitMode, setFitMode] = React.useState('fit');
  const [zoomLevel, setZoomLevel] = React.useState(1);

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    setZoomLevel(1);
  };

  const pinch = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate(event => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = 2.5;
        savedScale.value = 2.5;
        setZoomLevel(2.5);
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const setZoom = value => {
    const next = Math.max(1, Math.min(Number(value) || 1, 5));
    scale.value = next;
    savedScale.value = next;
    setZoomLevel(next);
    if (next === 1) {
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  return (
    <View style={[{ width: '100%', alignItems: 'center' }, style]}>
      <GestureDetector gesture={gesture}>
        <Animated.Image
          source={{ uri }}
          style={[{ width: '100%', height: '82%' }, animatedStyle]}
          resizeMode={fitMode === 'fit' ? 'contain' : 'cover'}
        />
      </GestureDetector>
      <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', paddingVertical: 6 }}>
        <TouchableOpacity onPress={resetZoom} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Reset Zoom</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFitMode('fit')} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Fit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFitMode('fill')} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Fill</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 12, marginHorizontal: 6 }}>{zoomLevel.toFixed(1)}×</Text>
        <TouchableOpacity onPress={() => setZoom(zoomLevel - 0.5)} style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>−</Text>
        </TouchableOpacity>
        <View style={{ width: 90, justifyContent: 'center' }}>
          <View style={{ height: 4, backgroundColor: '#777777', borderRadius: 2 }}>
            <View style={{ width: `${((zoomLevel - 1) / 4) * 100}%`, height: 4, backgroundColor: '#1685D9', borderRadius: 2 }} />
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, top: -9, bottom: -9, flexDirection: 'row', justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5].map(value => (
              <TouchableOpacity key={value} onPress={() => setZoom(value)} style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: zoomLevel >= value ? '#1685D9' : '#BBBBBB' }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity onPress={() => setZoom(zoomLevel + 0.5)} style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


function PinchZoomImage({ uri, style, resizeMode = 'cover' }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate(event => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = 2.5;
        savedScale.value = 2.5;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <Animated.Image
          source={{ uri }}
          style={[{ width: '100%', height: '100%' }, animatedStyle]}
          resizeMode={resizeMode}
        />
      </GestureDetector>
    </View>
  );
}

function ReelVideo({ uri, zoomControls = false }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  const pinch = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate(event => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = 2.5;
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const setZoom = value => {
    const next = Math.max(1, Math.min(Number(value) || 1, 5));
    scale.value = next;
    savedScale.value = next;
    setZoomLevel(next);
    if (next === 1) {
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <View style={{ width: '100%', height: 420, backgroundColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: '100%', height: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
          <VideoView player={player} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      </GestureDetector>
    </View>
      {zoomControls && (
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}>
          <TouchableOpacity onPress={() => setZoom(1)} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12 }}>Reset Zoom</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setZoom(zoomLevel - 0.5)} style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16 }}>−</Text>
          </TouchableOpacity>
          <Text style={{ color: '#FFFFFF', fontSize: 12, marginHorizontal: 6 }}>{zoomLevel.toFixed(1)}×</Text>
          <TouchableOpacity onPress={() => setZoom(zoomLevel + 0.5)} style={{ paddingHorizontal: 8, paddingVertical: 5 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16 }}>＋</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function formatPostTime(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return 'Yesterday';
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function groupPostItems(items) {
  const result = [];
  const groups = new Map();

  for (const item of items) {
    if (item.type !== 'posts' || !item.groupId) {
      result.push({ ...item, mediaItems: [item] });
      continue;
    }

    let grouped = groups.get(item.groupId);
    if (!grouped) {
      grouped = { ...item, mediaItems: [] };
      groups.set(item.groupId, grouped);
      result.push(grouped);
    }
    grouped.mediaItems.push(item);
  }

  for (const item of result) {
    if (item.groupId && item.mediaItems?.length > 1) {
      item.mediaItems.sort((a, b) => Number(a.id) - Number(b.id));
    }
  }
  return result;
}

function PostCard({ post, onOpen = () => {} }) {
  const [mediaWidth, setMediaWidth] = React.useState(0);
  const [mediaIndex, setMediaIndex] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(
    Number(String(post.likes || '0').replace(/,/g, '')) || 0
  );
  const [saved, setSaved] = React.useState(false);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [comments, setComments] = React.useState([]);
  const [commentDraft, setCommentDraft] = React.useState('');
  const [interactionBusy, setInteractionBusy] = React.useState(false);

  const handleLike = async () => {
    if (interactionBusy) return;

    if (!post.id) {
      setLiked(previous => {
        setLikeCount(count => Math.max(0, count + (previous ? -1 : 1)));
        return !previous;
      });
      return;
    }

    setInteractionBusy(true);
    try {
      const result = await togglePostLike(post.id);
      setLiked(Boolean(result.liked));
      setLikeCount(Number(result.likes) || 0);
    } catch (error) {
      Alert.alert('Like failed', error.message || 'Could not update like.');
    } finally {
      setInteractionBusy(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    if (!post.id) {
      setComments([]);
      return;
    }

    try {
      const result = await loadPostComments(post.id);
      setComments(result);
    } catch (error) {
      Alert.alert('Comments', error.message || 'Could not load comments.');
    }
  };

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || interactionBusy) return;

    if (!post.id) {
      Alert.alert('Comments', 'Save this post to the server before commenting.');
      return;
    }

    setInteractionBusy(true);
    try {
      const comment = await createPostComment(post.id, text);
      setComments(previous => [...previous, comment]);
      setCommentDraft('');
    } catch (error) {
      Alert.alert('Comment failed', error.message || 'Could not post comment.');
    } finally {
      setInteractionBusy(false);
    }
  };

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <View style={styles.smallAvatar}>
          {post.avatarUrl ? (
            <Image source={{ uri: post.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Text style={styles.smallAvatarText}>{(post.user || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.postUserInfo}>
          <Text style={styles.username}>{post.user || 'you'}</Text>
          {!!post.location && <Text style={styles.location}>{post.location}</Text>}
        </View>
        <TouchableOpacity><Text style={styles.more}>•••</Text></TouchableOpacity>
      </View>

      <View
        onLayout={event => setMediaWidth(event.nativeEvent.layout.width)}
        style={{ width: '100%' }}
      >
        {(post.mediaItems?.length > 1) ? (
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={event => {
              const width = mediaWidth || event.nativeEvent.layoutMeasurement.width;
              if (width > 0) {
                setMediaIndex(Math.round(event.nativeEvent.contentOffset.x / width));
              }
            }}
          >
            {(post.mediaItems || []).map((media, index) => (
              <TouchableOpacity
                key={String(media.id || index)}
                activeOpacity={0.95}
                onPress={onOpen}
                style={{ width: mediaWidth || 320 }}
              >
                {media.uri && media.mediaType === 'video' ? (
                  <ReelVideo uri={media.uri} />
                ) : media.uri ? (
                  <PinchZoomImage
                    uri={media.uri}
                    style={[styles.postImage, mediaWidth ? { width: mediaWidth } : null]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.postImage, { backgroundColor: post.color || '#D8E7DF' }]}>
                    <Text style={styles.postEmoji}>{post.emoji || '🌿'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity activeOpacity={0.95} onPress={onOpen}>
            {post.uri && post.mediaType === 'video' ? (
              <ReelVideo uri={post.uri} />
            ) : post.uri ? (
              <PinchZoomImage uri={post.uri} style={styles.postImage} resizeMode="cover" />
            ) : (
              <View style={[styles.postImage, { backgroundColor: post.color || '#D8E7DF' }]}>
                <Text style={styles.postEmoji}>{post.emoji || '🌿'}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {(post.mediaItems?.length > 1) && (
          <Text style={{ textAlign: 'center', paddingVertical: 5, color: '#777777', fontSize: 12 }}>
            {mediaIndex + 1} / {post.mediaItems.length}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} disabled={interactionBusy}>
          <Text style={[styles.actionIcon, liked && styles.liked]}>{liked ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openComments}>
          <Text style={styles.actionIcon}>▢</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Share', 'Sharing will be added next.')}>
          <Text style={styles.actionIcon}>➤</Text>
        </TouchableOpacity>
        <View style={styles.actionSpacer} />
        <TouchableOpacity onPress={() => setSaved(!saved)}>
          <Text style={styles.actionIcon}>{saved ? '▣' : '♧'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.likes}>{likeCount.toLocaleString()} likes</Text>
      {!!post.caption && (
        <Text style={styles.caption}>
          <Text style={styles.username}>{post.user || 'you'} </Text>{post.caption}
        </Text>
      )}
      <TouchableOpacity onPress={openComments}>
        <Text style={styles.comments}>View all comments</Text>
      </TouchableOpacity>
      {!!post.createdAt && <Text style={styles.time}>{formatPostTime(post.createdAt)}</Text>}

      <Modal
        visible={commentsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '75%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#222222' }}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentsOpen(false)}>
                <Text style={{ fontSize: 22, color: '#222222' }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0, maxHeight: 360 }}>
              {comments.length === 0 ? (
                <Text style={{ color: '#777777', paddingVertical: 12 }}>No comments yet.</Text>
              ) : comments.map(comment => (
                <View key={String(comment.id)} style={{ paddingVertical: 8 }}>
                  <Text style={{ color: '#222222' }}>
                    <Text style={{ fontWeight: '600' }}>{comment.username || 'you'} </Text>
                    {comment.text}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="Write a comment..."
                maxLength={2000}
                editable={!interactionBusy}
                style={{ flex: 1, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, color: '#222222' }}
              />
              <TouchableOpacity onPress={submitComment} disabled={interactionBusy || !commentDraft.trim()} style={{ padding: 10 }}>
                <Text style={{ color: '#0095F6', fontWeight: '600' }}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
export default function App() {
  const [activeTab, setActiveTab] = React.useState('Home');
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraFacing, setCameraFacing] = React.useState('back');
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordedVideo, setRecordedVideo] = React.useState(null);
  const cameraRef = React.useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [updateInfo, setUpdateInfo] = React.useState(null);
  const [updatePromptVisible, setUpdatePromptVisible] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetch('https://bhumi-social-app-fresh.onrender.com/api/app-version')
      .then(response => {
        if (!response.ok) throw new Error('Version check failed');
        return response.json();
      })
      .then(info => {
        if (!active || !isVersionNewer(info.version, appConfig.expo?.version || '1.0.0')) return;
        setUpdateInfo(info);
        setUpdatePromptVisible(true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);


  const [feedPosts, setFeedPosts] = React.useState(posts);
  const [serverStories, setServerStories] = React.useState([]);
  const [selectedStory, setSelectedStory] = React.useState(null);
  const [storyQueue, setStoryQueue] = React.useState([]);
  const [storyIndex, setStoryIndex] = React.useState(0);
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [reels, setReels] = React.useState([]);
  const [serverOnline, setServerOnline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [mediaDraft, setMediaDraft] = React.useState(null);
  const [mediaDraftIndex, setMediaDraftIndex] = React.useState(0);
  const [mediaDraftCaption, setMediaDraftCaption] = React.useState('');
  const [zoomEffectEnabled, setZoomEffectEnabled] = React.useState(false);
  const [zoomEffectLevel, setZoomEffectLevel] = React.useState(1.5);
  const [zoomEffectDuration, setZoomEffectDuration] = React.useState(3);
  const [musicAsset, setMusicAsset] = React.useState(null);
  const [musicVolume, setMusicVolume] = React.useState(0.8);
  const [musicStart, setMusicStart] = React.useState(0);
  const [keepOriginalAudio, setKeepOriginalAudio] = React.useState(true);
  const musicPlayer = useAudioPlayer(null);
  const musicPlayerStatus = useAudioPlayerStatus(musicPlayer);


  // SOCIALAPP_AUTH_SCREEN_V1
  const [authReady, setAuthReady] = React.useState(false);
  const [authSession, setAuthSession] = React.useState(null);
  const [authMode, setAuthMode] = React.useState('login');
  const [authUsername, setAuthUsername] = React.useState('');
  const [authFullName, setAuthFullName] = React.useState('');
  const [authEmail, setAuthEmail] = React.useState('');
  const [authPassword, setAuthPassword] = React.useState('');
  const [authPhoneNumber, setAuthPhoneNumber] = React.useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = React.useState('');
  const [authBusy, setAuthBusy] = React.useState(false);
  const [forgotStep, setForgotStep] = React.useState('email');
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotOtp, setForgotOtp] = React.useState('');
  const [forgotResetToken, setForgotResetToken] = React.useState('');
  const [forgotNewPassword, setForgotNewPassword] = React.useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = React.useState('');


  React.useEffect(() => {
    let mounted = true;

    (async () => {
      let savedSession = null;
      try {
        savedSession = await getAuthSession();
        if (!mounted) return;

        setAuthSession(savedSession?.token ? savedSession : null);
        setAuthReady(true);

        if (!savedSession?.token) return;

        try {
          const result = await verifyAuthSession();
          if (!mounted) return;

          if (result.valid) {
            setAuthSession({
              token: savedSession.token,
              username: result.username || savedSession.username,
            });
          } else if (result.status === 401) {
            await clearAuthSession();
            if (mounted) setAuthSession(null);
          } else {
            console.warn('Session retained because verification did not return 401.');
          }
        } catch (error) {
          console.warn('Session retained after a temporary verification failure:', error?.message || error);
        }
      } catch (error) {
        console.error('Could not restore saved auth session:', error?.message || error);
        if (mounted) {
          setAuthSession(null);
          setAuthReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // SOCIALAPP_PROFILE_SCREEN_V1
  const [profile, setProfile] = React.useState(null);
  const [profileEditing, setProfileEditing] = React.useState(false);
  const [profileDraft, setProfileDraft] = React.useState({ displayName: '', bio: '' });
  const [profileBusy, setProfileBusy] = React.useState(false);

  const groupedStories = React.useMemo(() => {
    const groups = new Map();
    const currentUsername = String(
      profile?.username || profile?.user?.username || ''
    ).trim().toLowerCase();

    serverStories.forEach((item, index) => {
      const username = String(item.user || item.name || `story${index + 1}`).trim();
      const normalizedUsername = username.toLowerCase();
      const own = !!item.own ||
        normalizedUsername === 'you' ||
        (!!currentUsername && normalizedUsername === currentUsername);
      const key = own ? '__own__' : normalizedUsername;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: own ? 'Your story' : username,
          own,
          items: []
        });
      }

      const group = groups.get(key);
      group.items.push({ ...item, name: group.name, own });
    });

    return Array.from(groups.values());
  }, [serverStories, profile]);

  const openStoryGroup = (items) => {
    if (!items || items.length === 0) return;
    setStoryQueue(items);
    setStoryIndex(0);
    setSelectedStory(items[0]);
  };

  const moveStory = (direction) => {
    const nextIndex = storyIndex + direction;

    if (nextIndex < 0) return;

    if (nextIndex >= storyQueue.length) {
      setSelectedStory(null);
      setStoryQueue([]);
      setStoryIndex(0);
      return;
    }

    setStoryIndex(nextIndex);
    setSelectedStory(storyQueue[nextIndex]);
  };

  // SOCIALAPP_PRIVACY_SCREEN_V1
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [settingsHubOpen, setSettingsHubOpen] = React.useState(false);
  const [privacyBusy, setPrivacyBusy] = React.useState(false);
  const [privacySettings, setPrivacySettings] = React.useState({
    isPrivate: false,
    showActivity: true,
    allowMessages: true,
  });
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [accountSettingsOpen, setAccountSettingsOpen] = React.useState(false);
  const [accountSettingsBusy, setAccountSettingsBusy] = React.useState(false);
  const [accountEmail, setAccountEmail] = React.useState('');
  const [accountPhone, setAccountPhone] = React.useState('');
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [notificationsBusy, setNotificationsBusy] = React.useState(false);
  const [notificationDetailsOpen, setNotificationDetailsOpen] = React.useState(false);
  const [notificationDetails, setNotificationDetails] = React.useState({
    likes: true, comments: true, follows: true, messages: true, system_alerts: true,
  });





  const openAccountSettings = async () => {
    setAccountSettingsBusy(true);
    try {
      const data = await loadAccountSettings();
      setAccountEmail(data.email || '');
      setAccountPhone(data.phone_number || '');
      setAccountSettingsOpen(true);
    } catch (e) {
      Alert.alert('Account Settings', e.message || 'Could not load account settings.');
    } finally {
      setAccountSettingsBusy(false);
    }
  };

  const saveAccountSettingsChanges = async () => {
    setAccountSettingsBusy(true);
    try {
      await saveAccountSettings(accountEmail, accountPhone);
      setAccountSettingsOpen(false);
      Alert.alert('Success', 'Account details saved.');
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Could not save account details.');
    } finally {
      setAccountSettingsBusy(false);
    }
  };

  const changeNotificationPreference = async (enabled) => {
    setNotificationsBusy(true);
    try {
      const saved = await saveNotificationPreference(enabled);
      setNotificationsEnabled(saved);
    } catch (e) {
      Alert.alert('Notifications', e.message || 'Could not save notification preference.');
    } finally {
      setNotificationsBusy(false);
    }
  };

  const openNotificationSettings = async () => {
    setNotificationsBusy(true);
    try {
      const enabled = await loadNotificationPreference();
      const details = await loadNotificationDetails();
      setNotificationsEnabled(enabled);
      setNotificationDetails(current => ({ ...current, ...details }));
      setNotificationDetailsOpen(value => !value);
    } catch (e) {
      Alert.alert('Notifications', e.message || 'Could not load notification settings.');
    } finally {
      setNotificationsBusy(false);
    }
  };

  const changeNotificationDetail = async (key, value) => {
    const previous = notificationDetails;
    const updated = { ...previous, [key]: value };
    setNotificationDetails(updated);
    setNotificationsBusy(true);
    try {
      const saved = await saveNotificationDetails({ [key]: value });
      setNotificationDetails(current => ({ ...current, ...saved }));
    } catch (e) {
      setNotificationDetails(previous);
      Alert.alert('Notifications', e.message || 'Could not save notification settings.');
    } finally {
      setNotificationsBusy(false);
    }
  };

  const openPrivacySettings = async () => {
    setPrivacyBusy(true);
    try {
      const settings = await loadPrivacySettings(authSession.username);
      setPrivacySettings({
        isPrivate: settings.isPrivate,
        showActivity: settings.showActivity,
        allowMessages: settings.allowMessages,
      });
      setPrivacyOpen(true);
    } catch (e) {
      Alert.alert('Privacy settings unavailable', e.message || 'Check the server connection.');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const persistPrivacySettings = async () => {
    setPrivacyBusy(true);
    try {
      const settings = await savePrivacySettings(privacySettings, authSession.username);
      setPrivacySettings(settings);
      setPrivacyOpen(false);
      Alert.alert('Saved', 'Privacy settings have been saved.');
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Check the server connection.');
    } finally {
      setPrivacyBusy(false);
    }
  };

const refreshProfile = React.useCallback(async () => {
    if (!authSession?.username) return;
    try {
      const result = await loadProfile(authSession.username, authSession.username);
      const item = result.profile || result;
      setProfile(item);
      setProfileDraft({
        displayName: item.displayName || 'you',
        bio: item.bio || '',
      });
    } catch (e) {
      Alert.alert('प्रोफ़ाइल लोड नहीं हुई', e.message || 'सर्वर कनेक्शन जाँचें।');
    }
  }, [authSession]);

  React.useEffect(() => {
    if (authSession) refreshProfile();
  }, [refreshProfile, authSession]);

  const saveProfile = async () => {
    if (profileBusy) return;
    setProfileBusy(true);
    try {
      const result = await updateProfile(authSession.username, {
        displayName: profileDraft.displayName.trim(),
        bio: profileDraft.bio.trim(),
      });
      const item = result.profile || result;
      setProfile(item);
      setProfileDraft({
        displayName: item.displayName || 'you',
        bio: item.bio || '',
      });
      setProfileEditing(false);
      Alert.alert('सफल', 'प्रोफ़ाइल सेव हो गई।');
    } catch (e) {
      Alert.alert('सेव नहीं हुआ', e.message || 'सर्वर कनेक्शन जाँचें।');
    } finally {
      setProfileBusy(false);
    }
  };

  const chooseProfilePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('अनुमति चाहिए', 'Gallery की अनुमति दें।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      setProfileBusy(true);
      await uploadProfileAvatar(result.assets[0], authSession.username);
      await refreshProfile();
      Alert.alert('सफल', 'प्रोफ़ाइल फ़ोटो अपडेट हो गई।');
    } catch (e) {
      Alert.alert('फ़ोटो अपलोड नहीं हुई', e.message || 'सर्वर कनेक्शन जाँचें।');
    } finally {
      setProfileBusy(false);
    }
  };

  const removeProfilePhoto = () => {
    Alert.alert('फ़ोटो हटाएँ?', 'क्या प्रोफ़ाइल फ़ोटो हटानी है?', [
      { text: 'रद्द करें', style: 'cancel' },
      {
        text: 'हटाएँ',
        style: 'destructive',
        onPress: async () => {
          setProfileBusy(true);
          try {
            await deleteProfileAvatar(authSession.username);
            await refreshProfile();
          } catch (e) {
            Alert.alert('फ़ोटो नहीं हटी', e.message || 'फिर से कोशिश करें।');
          } finally {
            setProfileBusy(false);
          }
        },
      },
    ]);
  };

  const showProfileConnections = async (type) => {
    try {
      const result = await loadProfileConnections(authSession.username, type);
      const items = result.items || result.users || result[type] || [];
      const names = items.map(x => '@' + (x.username || x.user || x)).join('\n');
      Alert.alert(type === 'followers' ? 'Followers' : 'Following',
        names || 'अभी सूची खाली है।');
    } catch (e) {
      Alert.alert('सूची लोड नहीं हुई', e.message || 'सर्वर कनेक्शन जाँचें।');
    }
  };


  const refreshContent = React.useCallback(async () => {
    try {
      await checkServer();
      const [p, s, r] = await Promise.all([
        loadContent('posts'), loadContent('stories'), loadContent('reels')
      ]);
      setServerOnline(true);
      setFeedPosts([...p, ...posts]);
      setServerStories(s.map((item, i) => ({
        ...item, name: item.user || `story${i + 1}`, color: '#DDE7F5'
      })));
      setReels(r);
    } catch (e) {
      setServerOnline(false);
      console.error('Server load failed:', e);
    }
  }, []);

  React.useEffect(() => { refreshContent(); }, [refreshContent]);

  const openReelCamera = async () => {
    try {
      let permission = cameraPermission;
      if (!permission?.granted) {
        permission = await requestCameraPermission();
      }
      if (!permission?.granted) {
        Alert.alert('Camera permission required', 'Allow camera access to record a Reel.');
        return;
      }
      setRecordedVideo(null);
      setCameraOpen(true);
    } catch (e) {
      Alert.alert('Camera unavailable', e.message || 'Please try again.');
    }
  };

  const startCameraRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    setRecordedVideo(null);
    setIsRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 1200 });
      if (result?.uri) setRecordedVideo(result.uri);
    } catch (e) {
      Alert.alert('Recording failed', e.message || 'Please try again.');
    } finally {
      setIsRecording(false);
    }
  };

  const stopCameraRecording = () => {
    if (isRecording) cameraRef.current?.stopRecording();
  };

  const useRecordedVideo = () => {
    if (!recordedVideo) return;
    setMediaDraft({
      kind: 'reels',
      assets: [{
        uri: recordedVideo,
        type: 'video',
        fileName: 'recorded-reel.mp4',
        mimeType: 'video/mp4',
      }],
    });
    setMediaDraftIndex(0);
    setMediaDraftCaption('');
    setMusicAsset(null);
    setMusicStart(0);
    setCameraOpen(false);
    setRecordedVideo(null);
  };

  const chooseMedia = async (kind, mediaMode = 'default') => {
    if (busy || mediaDraft) return;
    if (kind === 'reels' && mediaMode === 'default') {
      Alert.alert('Create Reel', 'Choose your media', [
        { text: 'Record with Camera', onPress: openReelCamera },
        { text: 'Select Video', onPress: () => chooseMedia('reels', 'video') },
        { text: 'Create Video from Photos', onPress: createReelFromPhotos },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    try {
      const video = kind === 'reels';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: video ? ['videos'] : ['images', 'videos'],
        allowsMultipleSelection: kind === 'posts',
        selectionLimit: kind === 'posts' ? 10 : 1,
        allowsEditing: false,
        quality: 1,
        ...(kind === 'reels' ? { videoMaxDuration: 1200 } : kind === 'stories' ? { videoMaxDuration: 1200 } : kind === 'posts' ? { videoMaxDuration: 7200 } : {}),
      });
      if (result.canceled || !result.assets?.length) return;
      const maxBytes = kind === 'posts' ? 1024 * 1024 * 1024 : 500 * 1024 * 1024;
      const oversizedAsset = result.assets.find(asset => Number(asset.fileSize || 0) > maxBytes);
      if (oversizedAsset) {
        const limitMB = Math.floor(maxBytes / (1024 * 1024));
        Alert.alert('फ़ाइल बहुत बड़ी है', `इस अपलोड की अधिकतम सीमा ${limitMB} MB है। छोटी फ़ाइल चुनें।`);
        return;
      }
      setMediaDraft({ kind, assets: result.assets });
      setMediaDraftIndex(0);
      setMediaDraftCaption('');
    } catch (e) {
      console.error('Media selection failed:', e);
      Alert.alert('मीडिया नहीं खुला', e.message || 'कृपया फिर कोशिश करें।');
    }
  };

  const chooseMusicFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      setMusicAsset(result.assets[0]);
      musicPlayer.replace({ uri: result.assets[0].uri });
      Alert.alert('Music selected', result.assets[0].name || 'Audio file selected');
    } catch (e) {
      Alert.alert('Music selection failed', e.message || 'Please try again.');
    }
  };

  const createReelFromPhotos = async () => {
    if (busy || mediaDraft) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 20,
        orderedSelection: true,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      if (result.assets.length < 2) {
        Alert.alert('Select photos', 'Please select at least 2 photos to create a video.');
        return;
      }
      setBusy(true);
      const videoAsset = await createVideoFromPhotos(result.assets, { secondsPerPhoto: 3 });
      setMediaDraft({ kind: 'reels', assets: [videoAsset] });
      setMediaDraftIndex(0);
      setMediaDraftCaption('');
      setMusicAsset(null);
      setMusicStart(0);
    } catch (e) {
      console.error('Photo video creation failed:', e);
      Alert.alert('Video creation failed', e.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoEdit = async (action) => {
    if (!mediaDraft || busy) return;

    const index = mediaDraftIndex;
    const asset = mediaDraft.assets?.[index];
    const isVideo = asset?.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(asset?.uri || '');

    if (!asset || isVideo) return;

    setBusy(true);
    try {
      const editedAsset = await editPhotoAsset(asset, action);
      setMediaDraft(current => current ? {
        ...current,
        assets: current.assets.map((item, i) => i === index ? editedAsset : item),
      } : current);
    } catch (e) {
      Alert.alert('Photo editing failed', e.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const uploadDraftMedia = async () => {
    if (!mediaDraft || busy) return;
    const { kind, assets } = mediaDraft;
    setBusy(true);
    try {
      const uploadedItems = [];
      const groupId = kind === 'posts' && assets.length > 1
        ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        : '';
      for (const asset of assets) {
        let uploadAsset = asset;
        const assetIsVideo = asset.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(asset.uri || '');

        if (kind === 'reels' && assetIsVideo && zoomEffectEnabled) {
          uploadAsset = await applyZoomEffect(asset.uri, {
            zoom: zoomEffectLevel,
            duration: zoomEffectDuration,
          });
        }

        if (kind === 'reels' && assetIsVideo && musicAsset?.uri) {
          uploadAsset = await addMusicToVideo(uploadAsset.uri, musicAsset.uri, {
            musicVolume,
            musicStart,
            keepOriginalAudio,
          });
        }
        uploadedItems.push(
          await uploadContent(kind, uploadAsset, mediaDraftCaption.trim(), groupId)
        );
      }
      const item = uploadedItems[0];
      setMediaDraft(null);
      setMediaDraftIndex(0);
      setMediaDraftCaption('');
      setMusicAsset(null);
      setMusicStart(0);
      if (kind === 'posts') {
        await refreshContent();
        setActiveTab('Home');
      } else if (kind === 'stories') {
        setServerStories(current => [{ ...item, name: item.user || 'you', own: true, color: '#DDE7F5' }, ...current]);
        setActiveTab('Home');
      } else {
        setReels(current => [item, ...current]);
        setActiveTab('Reels');
      }
    } catch (e) {
      console.error('Upload failed:', e);
      Alert.alert('अपलोड विफल', e.message || 'सर्वर कनेक्शन जाँचें।');
    } finally {
      setBusy(false);
    }
  };

  const cancelDraftMedia = () => {
    setMediaDraft(null);
    setMediaDraftIndex(0);
    setMediaDraftCaption('');
  };

  const pickImage = () => chooseMedia('posts');
  const createStory = () => chooseMedia('stories');
  const createReel = () => chooseMedia('reels');

  const handleTab = (name) => {
    if (name === 'Create') {
      Alert.alert('Create', 'क्या अपलोड करना है?', [
        { text: 'पोस्ट', onPress: pickImage },
        { text: 'स्टोरी', onPress: createStory },
        { text: 'रील', onPress: createReel },
        { text: 'रद्द करें', style: 'cancel' },
      ]);
    } else {
      setActiveTab(name);
      if (name === 'Home') refreshContent();
      if (name === 'Reels' && reels.length === 0) {
        Alert.alert('Reels', 'अभी कोई रील नहीं है।', [
          { text: 'रील अपलोड करें', onPress: createReel },
          { text: 'ठीक है', style: 'cancel' },
        ]);
      }
    }
  };


  const submitAuth = async () => {
    if (authBusy) return;
    const username = authUsername.trim();
    console.log('Registration username check:', JSON.stringify({length: username.length, value: username, valid: /^[a-zA-Z0-9_.]{3,30}$/.test(username)}));
    const fullName = authFullName.trim();
    const email = authEmail.trim().toLowerCase();
    if (!username || !authPassword) {
      Alert.alert('Required', 'Enter your username and password.');
      return;
    }
    if (authMode === 'register') {
      if (!fullName) {
        Alert.alert('Required', 'Enter your full name.');
        return;
      }
      if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
        Alert.alert('Invalid username', 'Use 3 to 30 letters, numbers, dots, or underscores.');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Alert.alert('Invalid email', 'Enter a valid email address or leave it blank.');
        return;
      }
      const phoneDigits = authPhoneNumber.replace(/\D/g, '');
      if (authPhoneNumber.trim() && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
        Alert.alert('Invalid mobile number', 'Enter a valid mobile number or leave it blank.');
        return;
      }
      if (authPassword.length < 4 || authPassword.length > 24) {
        Alert.alert('Invalid password', 'Password must be 4 to 24 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        Alert.alert('Password mismatch', 'Password and confirm password do not match.');
        return;
      }
    }
    setAuthBusy(true);
    try {
      const result = authMode === 'register'
        ? await registerAccount(username, authPassword, authPhoneNumber, email, fullName)
        : await loginAccount(username, authPassword);
      setAuthSession({ token: result.token, username: result.username });
      setAuthPassword('');
      Alert.alert('Success', authMode === 'register' ? 'Account created.' : 'Login successful.');
    } catch (error) {
      Alert.alert('Authentication failed', error.message || 'Please check the server connection.');
    } finally {
      setAuthBusy(false);
    }
  };

  if (!authReady) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#555555' }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // SOCIALAPP_FORGOT_PASSWORD_SCREEN_V1
  if (authReady && !authSession && authMode === 'forgot') {
    const fieldStyle = {
      borderWidth: 1,
      borderColor: '#DDDDDD',
      borderRadius: 8,
      padding: 13,
      marginBottom: 12,
      color: '#222222',
    };

    const forgotAction = async (action) => {
      if (authBusy) return;

      if (action === 'request' && !forgotEmail.trim().includes('@')) {
        Alert.alert('Email required', 'Enter your registered email address.');
        return;
      }

      if (action === 'reset') {
        if (forgotNewPassword.length < 4 || forgotNewPassword.length > 24) {
          Alert.alert('Invalid password', 'Password must be 4 to 24 characters.');
          return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
          Alert.alert('Password mismatch', 'The passwords do not match.');
          return;
        }
      }

      setAuthBusy(true);
      try {
        if (action === 'request') {
          await requestPasswordReset(forgotEmail);
          setForgotStep('otp');
          Alert.alert('Check your email', 'If the account exists, a reset code has been sent.');
        } else if (action === 'verify') {
          const result = await verifyPasswordReset(forgotEmail, forgotOtp);
          const token = result.reset_token || result.resetToken;
          if (!token) throw new Error('The server did not return a reset token.');
          setForgotResetToken(token);
          setForgotStep('reset');
        } else if (action === 'reset') {
          await resetPasswordWithToken(
            forgotEmail,
            forgotResetToken,
            forgotNewPassword,
            forgotConfirmPassword
          );
          setForgotStep('email');
          setForgotOtp('');
          setForgotResetToken('');
          setForgotNewPassword('');
          setForgotConfirmPassword('');
          setAuthPassword('');
          setAuthMode('login');
          Alert.alert('Password updated', 'Log in with your new password.');
        }
      } catch (error) {
        Alert.alert('Password reset', error.message || 'Could not complete the password reset.');
      } finally {
        setAuthBusy(false);
      }
    };

    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#171717', marginBottom: 8 }}>Bhumi Social AI</Text>
          <Text style={{ color: '#777777', marginBottom: 22 }}>Forgot password</Text>

          <View style={{ flexDirection: 'row', marginBottom: 18 }}>
            <View style={{ flex: 1, backgroundColor: '#0095F6', borderRadius: 8, padding: 12, alignItems: 'center', marginRight: 8 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Email</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 8, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#888888', fontWeight: '600' }}>Mobile (SMS unavailable)</Text>
            </View>
          </View>

          {forgotStep === 'email' && (
            <>
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Registered email</Text>
              <TextInput
                value={forgotEmail}
                onChangeText={setForgotEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!authBusy}
                style={fieldStyle}
              />
              <TouchableOpacity
                onPress={() => forgotAction('request')}
                disabled={authBusy}
                style={{ backgroundColor: '#0095F6', borderRadius: 8, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{authBusy ? 'Please wait...' : 'Send email code'}</Text>
              </TouchableOpacity>
            </>
          )}

          {forgotStep === 'otp' && (
            <>
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Email verification code</Text>
              <TextInput
                value={forgotOtp}
                onChangeText={setForgotOtp}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                editable={!authBusy}
                style={fieldStyle}
              />
              <TouchableOpacity
                onPress={() => forgotAction('verify')}
                disabled={authBusy}
                style={{ backgroundColor: '#0095F6', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{authBusy ? 'Please wait...' : 'Verify code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => forgotAction('request')}
                disabled={authBusy}
                style={{ padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#1685D9' }}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}

          {forgotStep === 'reset' && (
            <>
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>New password (4 to 24 characters)</Text>
              <TextInput
                value={forgotNewPassword}
                onChangeText={setForgotNewPassword}
                placeholder="New password"
                secureTextEntry
                autoCapitalize="none"
                editable={!authBusy}
                style={fieldStyle}
              />
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Confirm new password</Text>
              <TextInput
                value={forgotConfirmPassword}
                onChangeText={setForgotConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry
                autoCapitalize="none"
                editable={!authBusy}
                style={fieldStyle}
              />
              <TouchableOpacity
                onPress={() => forgotAction('reset')}
                disabled={authBusy}
                style={{ backgroundColor: '#0095F6', borderRadius: 8, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{authBusy ? 'Please wait...' : 'Set new password'}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => { setAuthMode('login'); setForgotStep('email'); }}
            disabled={authBusy}
            style={{ padding: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#1685D9' }}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!authSession) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: '#171717', marginBottom: 8 }}>Bhumi Social AI</Text>
          <Text style={{ color: '#777777', marginBottom: 26 }}>
            {authMode === 'register' ? 'Create your account' : 'Sign in to your account'}
          </Text>
          {authMode === 'register' ? (
            <>
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Full Name</Text>
              <TextInput
                value={authFullName}
                onChangeText={setAuthFullName}
                placeholder="Full Name"
                autoCapitalize="words"
                editable={!authBusy}
                style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 12, color: '#222222' }}
              />
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Username</Text>
              <TextInput
                value={authUsername}
                onChangeText={setAuthUsername}
                placeholder="Choose a username"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authBusy}
                style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 12, color: '#222222' }}
              />
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Email address</Text>
              <TextInput
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authBusy}
                style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 12, color: '#222222' }}
              />
            </>
          ) : (
            <>
              <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Email or username</Text>
              <TextInput
                value={authUsername}
                onChangeText={setAuthUsername}
                placeholder="Email or username"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authBusy}
                style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 12, color: '#222222' }}
              />
            </>
          )}
          {authMode === 'register' && (
            <>
            <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Mobile number</Text>
            <TextInput
              value={authPhoneNumber}
              onChangeText={setAuthPhoneNumber}
              placeholder="Mobile number"
              keyboardType="phone-pad"
              editable={!authBusy}
              style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 12, color: '#222222' }}
            />
            </>
          )}
          <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Password (4 to 24 characters)</Text>
          <TextInput
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Password (4 to 24 characters)"
            secureTextEntry
            autoCapitalize="none"
            editable={!authBusy}
            onSubmitEditing={submitAuth}
            style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 16, color: '#222222' }}
          />
          {authMode === 'register' && (
            <>
            <Text style={{ color: '#333333', fontWeight: '600', marginBottom: 6 }}>Confirm password</Text>
            <TextInput
              value={authConfirmPassword}
              onChangeText={setAuthConfirmPassword}
              placeholder="Confirm password"
              secureTextEntry
              autoCapitalize="none"
              editable={!authBusy}
              style={{ borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8, padding: 13, marginBottom: 16, color: '#222222' }}
            />
            </>
          )}
          <TouchableOpacity
            onPress={submitAuth}
            disabled={authBusy}
            style={{ backgroundColor: '#0095F6', borderRadius: 8, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {authBusy ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Log in'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            disabled={authBusy}
            style={{ padding: 16, alignItems: 'center' }}
          >
            {authMode === 'login' && (
              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(authEmail);
                  setForgotStep('email');
                  setAuthMode('forgot');
                }}
                disabled={authBusy}
                style={{ padding: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#1685D9' }}>Forgot password?</Text>
              </TouchableOpacity>
            )}
            <Text style={{ color: '#1685D9' }}>
              {authMode === 'login' ? 'Create a new account' : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      <Modal
        visible={cameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (isRecording) cameraRef.current?.stopRecording();
          setCameraOpen(false);
          setRecordedVideo(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#090909' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity onPress={() => {
              if (isRecording) cameraRef.current?.stopRecording();
              setCameraOpen(false);
              setRecordedVideo(null);
            }} style={{ padding: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>Create Reel</Text>
            <TouchableOpacity
              onPress={() => setCameraFacing(current => current === 'back' ? 'front' : 'back')}
              disabled={isRecording || !!recordedVideo}
              style={{ padding: 8 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15 }}>Flip</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, backgroundColor: '#000000', overflow: 'hidden' }}>
            {recordedVideo ? (
              <ReelVideo key={recordedVideo} uri={recordedVideo} />
            ) : (
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                facing={cameraFacing}
                mode="video"
              />
            )}
          </View>

          <View style={{ minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 16, paddingVertical: 18 }}>
            {recordedVideo ? (
              <>
                <TouchableOpacity onPress={() => setRecordedVideo(null)} style={{ padding: 14 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={useRecordedVideo} style={{ backgroundColor: '#1685D9', borderRadius: 24, paddingHorizontal: 26, paddingVertical: 13 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Use Video</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={isRecording ? stopCameraRecording : startCameraRecording}
                style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: isRecording ? 27 : 48, height: isRecording ? 27 : 48, borderRadius: isRecording ? 6 : 24, backgroundColor: '#E53945' }} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(mediaDraft)}
        presentationStyle="fullScreen"
        animationType="slide"
        onRequestClose={cancelDraftMedia}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' }}>
            <TouchableOpacity onPress={cancelDraftMedia} style={{ paddingVertical: 8, paddingRight: 12 }}>
              <Text style={{ color: '#1685D9', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: '#222222', fontSize: 17, fontWeight: '700' }}>Edit media</Text>
            <View style={{ width: 54 }} />
          </View>

          {mediaDraft && (() => {
            const assets = mediaDraft.assets || [];
            const asset = assets[mediaDraftIndex];
            if (!asset) return null;
            const isVideo = asset.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(asset.uri || '');
            return (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 6 }} keyboardShouldPersistTaps="handled">
                <View style={{
                  height: Math.max(360, Dimensions.get('window').height - 190),
                  width: '100%',
                  backgroundColor: '#080808',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  {isVideo ? (
                    <ReelVideo uri={asset.uri} />
                  ) : (
                    <Image
                      source={{ uri: asset.uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  )}
                  <View style={{
                    position: 'absolute',
                    top: 12,
                    left: 8,
                    right: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                  }}>
                    {!isVideo ? (
                      [
                        { label: 'Crop', action: 'crop' },
                        { label: 'Rotate', action: 'rotate' },
                        { label: 'Flip', action: 'flip' },
                        { label: 'Filter', action: 'filter' },
                        { label: 'Brightness +', action: 'brightness' },
                      ].map(tool => (
                        <TouchableOpacity
                          key={tool.action}
                          disabled={busy}
                          onPress={() => handlePhotoEdit(tool.action)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.78)', paddingVertical: 10, paddingHorizontal: 11, margin: 3, borderRadius: 20, opacity: busy ? 0.5 : 1 }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12 }}>{tool.label}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <>
                        <TouchableOpacity
                          disabled={busy}
                          onPress={() => setZoomEffectEnabled(v => !v)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.78)', paddingVertical: 10, paddingHorizontal: 13, margin: 3, borderRadius: 20 }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{zoomEffectEnabled ? 'Zoom ON' : 'Zoom Effect'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={busy}
                          onPress={chooseMusicFile}
                          style={{ backgroundColor: 'rgba(0,0,0,0.78)', paddingVertical: 10, paddingHorizontal: 13, margin: 3, borderRadius: 20 }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{musicAsset ? 'Change Music' : 'Choose Music'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
                {assets.length > 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                    <TouchableOpacity
                      disabled={mediaDraftIndex === 0}
                      onPress={() => setMediaDraftIndex(index => Math.max(0, index - 1))}
                      style={{ padding: 10 }}
                    >
                      <Text style={{ color: '#1685D9', fontSize: 16 }}>Previous</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#555555' }}>{mediaDraftIndex + 1} / {assets.length}</Text>
                    <TouchableOpacity
                      disabled={mediaDraftIndex >= assets.length - 1}
                      onPress={() => setMediaDraftIndex(index => Math.min(assets.length - 1, index + 1))}
                      style={{ padding: 10 }}
                    >
                      <Text style={{ color: '#1685D9', fontSize: 16 }}>Next</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TextInput
                  value={mediaDraftCaption}
                  onChangeText={setMediaDraftCaption}
                  placeholder="Write a caption..."
                  multiline
                  maxLength={2200}
                  style={{ minHeight: 48, maxHeight: 110, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10, padding: 12, marginTop: 8, color: '#222222' }}
                />
                {mediaDraft.kind === 'reels' && isVideo && (
                  <View style={{ paddingTop: 10, paddingBottom: 8 }}>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={chooseMusicFile}
                      style={{ padding: 11, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}
                    >
                      <Text style={{ color: '#1685D9', fontWeight: '600' }}>
                        {musicAsset ? `Music: ${musicAsset.name || 'Selected'} · Change Music` : '♫ Choose Music File'}
                      </Text>
                    </TouchableOpacity>
                    {musicAsset && (
                      <TouchableOpacity
                        onPress={() => {
                          if (musicPlayerStatus.playing) {
                            musicPlayer.pause();
                          } else {
                            musicPlayer.play();
                          }
                        }}
                        style={{ marginTop: 8, padding: 10, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}
                      >
                        <Text style={{ color: '#1685D9', fontWeight: '600' }}>
                          {musicPlayerStatus.playing ? 'Ⅱ Pause Music Preview' : '▶ Preview Music'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {musicAsset && (
                      <View style={{ paddingTop: 8 }}>
                        <Text style={{ color: '#333333' }}>Music volume: {Math.round(musicVolume * 100)}%</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setMusicVolume(v => Math.max(0, Number((v - 0.1).toFixed(1))))} style={{ padding: 10, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>−</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMusicVolume(v => Math.min(1, Number((v + 0.1).toFixed(1))))} style={{ padding: 10, marginLeft: 8, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>＋</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { setMusicAsset(null); setMusicStart(0); }} style={{ padding: 10, marginLeft: 8 }}>
                            <Text style={{ color: '#D93025' }}>Remove Music</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={{ color: '#333333', paddingTop: 6 }}>Music start: {musicStart}s</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setMusicStart(v => Math.max(0, v - 5))} style={{ padding: 10, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>−5s</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setMusicStart(v => v + 5)} style={{ padding: 10, marginLeft: 8, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>＋5s</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => setKeepOriginalAudio(v => !v)} style={{ paddingVertical: 9 }}>
                          <Text style={{ color: '#1685D9', fontWeight: '600' }}>
                            Original video audio: {keepOriginalAudio ? 'ON' : 'OFF'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {mediaDraft.kind === 'reels' && isVideo && (
                  <View style={{ paddingTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => setZoomEffectEnabled(v => !v)}
                      style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: zoomEffectEnabled ? '#0095F6' : '#DDDDDD' }}
                    >
                      <Text style={{ color: zoomEffectEnabled ? '#0095F6' : '#333333', fontWeight: '600' }}>
                        {zoomEffectEnabled ? 'Zoom Effect ON' : 'Enable Zoom Effect'}
                      </Text>
                    </TouchableOpacity>
                    {zoomEffectEnabled && (
                      <View style={{ paddingTop: 8 }}>
                        <Text style={{ color: '#333333' }}>Zoom level: {zoomEffectLevel.toFixed(1)}x</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6 }}>
                          <TouchableOpacity onPress={() => setZoomEffectLevel(v => Math.max(1.2, Number((v - 0.1).toFixed(1))))} style={{ padding: 10, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>−</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setZoomEffectLevel(v => Math.min(2.5, Number((v + 0.1).toFixed(1))))} style={{ padding: 10, marginLeft: 8, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>＋</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={{ color: '#333333', paddingTop: 8 }}>Effect duration: {zoomEffectDuration}s</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6 }}>
                          <TouchableOpacity onPress={() => setZoomEffectDuration(v => Math.max(1, v - 1))} style={{ padding: 10, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>−</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setZoomEffectDuration(v => Math.min(15, v + 1))} style={{ padding: 10, marginLeft: 8, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 8 }}>
                            <Text style={{ color: '#1685D9' }}>＋</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={{ color: '#777777', fontSize: 12, paddingTop: 6 }}>
                          The effect is processed before upload.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            );
          })()}
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 22, borderTopWidth: 1, borderTopColor: '#EEEEEE', backgroundColor: '#FFFFFF' }}>
            <TouchableOpacity onPress={cancelDraftMedia} disabled={busy} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, marginRight: 8, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 10 }}>
              <Text style={{ color: '#1685D9', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={uploadDraftMedia} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, marginLeft: 8, backgroundColor: '#0095F6', borderRadius: 10, opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{busy ? 'Please wait...' : 'Done'}</Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.brand}>Bhumi Social AI</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={pickImage}><Text style={styles.headerIcon}>＋</Text></TouchableOpacity>
          <TouchableOpacity><Text style={styles.headerIcon}>♡</Text></TouchableOpacity>
          <TouchableOpacity><Text style={styles.headerIcon}>➤</Text></TouchableOpacity>
        </View>
      </View>

      {!serverOnline && (
        <Text style={{ paddingHorizontal: 12, paddingVertical: 4, color: '#888', fontSize: 11 }}>
          सर्वर से कनेक्शन नहीं है
        </Text>
      )}
      {busy && <Text style={{ padding: 5, color: '#1685D9' }}>मीडिया अपलोड हो रहा है…</Text>}

      {activeTab === 'Reels' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} pagingEnabled decelerationRate="fast">
          {reels.length ? reels.map((r, i) => (
            <View key={r.id || r.uri || i} style={styles.post}>
              {r.uri ? <ReelVideo uri={r.uri} zoomControls /> : null}
              {!!r.caption && <Text style={styles.caption}>{r.caption}</Text>}
              <Text style={styles.location}>@{r.user || 'you'}</Text>
            </View>
          )) : (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#555' }}>अभी कोई रील नहीं है।</Text>
              <TouchableOpacity onPress={createReel} style={{ padding: 14 }}>
                <Text style={{ color: '#1685D9', fontWeight: '700' }}>＋ रील अपलोड करें</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : activeTab === 'Home' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
            {(() => {
              const ownGroup = groupedStories.find(group => group.own);
              return (
                <Story
                  item={{
                    name: 'Your story',
                    color: '#DDE7F5',
                    own: true,
                    uri: profile?.avatarUrl
                  }}
                  onPress={() => {
                    if (ownGroup) openStoryGroup(ownGroup.items);
                    else createStory();
                  }}
                />
              );
            })()}
            {groupedStories.filter(group => !group.own).map(group => (
              <Story
                key={group.key}
                item={{ ...group.items[0], name: group.name, own: false }}
                onPress={() => openStoryGroup(group.items)}
              />
            ))}
            {stories.filter(s => !s.own).map(s => (
              <Story key={s.name} item={s} onPress={() => openStoryGroup([s])} />
            ))}
          </ScrollView>
          <View style={styles.feedDivider} />
          {groupPostItems(feedPosts).map((p, i) => <PostCard key={p.groupId || p.id || `${p.user}-${i}`} post={{ ...p, avatarUrl: (p.user || 'you') === 'you' ? (profile?.avatarUrl || p.avatarUrl) : p.avatarUrl }} onOpen={() => setSelectedPost(p)} />)}
        </ScrollView>
      ) : activeTab === 'Profile' ? (
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
          {!profile ? (
            <Text style={{ color: '#777', textAlign: 'center', padding: 24 }}>
              प्रोफ़ाइल लोड हो रही है…
            </Text>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
                <TouchableOpacity onPress={chooseProfilePhoto} disabled={profileBusy}>
                  {profile.avatarUrl ? (
                    <Image source={{ uri: profile.avatarUrl }}
                      onError={(e) => console.log('PROFILE_AVATAR_IMAGE_ERROR:', profile.avatarUrl, e.nativeEvent?.error)}
                      onLoad={() => console.log('PROFILE_AVATAR_IMAGE_LOADED:', profile.avatarUrl)}
                      style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#DDE7F5' }} />
                  ) : (
                    <View style={{ width: 88, height: 88, borderRadius: 44,
                      backgroundColor: '#DDE7F5', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#4F83CC', fontSize: 32, fontWeight: '700' }}>
                        {(profile.displayName || 'Y').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={{ color: '#1685D9', fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                    फ़ोटो बदलें
                  </Text>
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 22 }}>
                  <Text style={{ color: '#222', fontSize: 18, fontWeight: '700' }}>
                    {profile.displayName || 'you'}
                  </Text>
                  <Text style={{ color: '#777', marginTop: 3 }}>@{profile.username || 'you'}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#222', fontWeight: '700' }}>{profile.postsCount ?? 0}</Text>
                      <Text style={{ color: '#777', fontSize: 12 }}>Posts</Text>
                    </View>
                    <TouchableOpacity onPress={() => showProfileConnections('followers')} style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#222', fontWeight: '700' }}>{profile.followersCount ?? 0}</Text>
                      <Text style={{ color: '#777', fontSize: 12 }}>Followers</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => showProfileConnections('following')} style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#222', fontWeight: '700' }}>{profile.followingCount ?? 0}</Text>
                      <Text style={{ color: '#777', fontSize: 12 }}>Following</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {!!profile.bio && !profileEditing &&
                <Text style={{ color: '#444', marginBottom: 16 }}>{profile.bio}</Text>}

              {profileEditing ? (
                <View>
                  <Text style={{ color: '#555', marginBottom: 5 }}>Display Name</Text>
                  <TextInput value={profileDraft.displayName}
                    onChangeText={v => setProfileDraft(d => ({ ...d, displayName: v }))}
                    maxLength={60} placeholder="Display Name"
                    style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
                      padding: 11, color: '#222', marginBottom: 12 }} />
                  <Text style={{ color: '#555', marginBottom: 5 }}>Username (स्थायी)</Text>
                  <Text style={{ color: '#888', paddingVertical: 10 }}>@{profile.username || 'you'}</Text>
                  <Text style={{ color: '#555', marginBottom: 5 }}>Bio</Text>
                  <TextInput value={profileDraft.bio}
                    onChangeText={v => setProfileDraft(d => ({ ...d, bio: v }))}
                    maxLength={300} multiline placeholder="अपने बारे में लिखें"
                    style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
                      padding: 11, minHeight: 80, color: '#222', marginBottom: 12,
                      textAlignVertical: 'top' }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={saveProfile} disabled={profileBusy}
                      style={{ backgroundColor: '#1685D9', padding: 12, borderRadius: 8, marginRight: 10 }}>
                      <Text style={{ color: '#FFF', fontWeight: '700' }}>
                        {profileBusy ? 'सेव हो रहा है…' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setProfileDraft({ displayName: profile.displayName || 'you', bio: profile.bio || '' });
                      setProfileEditing(false);
                    }} style={{ padding: 12 }}>
                      <Text style={{ color: '#555' }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setProfileEditing(true)}
                    style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
                      paddingVertical: 10, paddingHorizontal: 18, marginRight: 8, marginBottom: 8 }}>
                    <Text style={{ color: '#333', fontWeight: '600' }}>Edit Profile</Text>
                  </TouchableOpacity>
                  {!!profile.avatarUrl && (
                    <TouchableOpacity onPress={removeProfilePhoto} disabled={profileBusy}
                      style={{ borderWidth: 1, borderColor: '#DDD', borderRadius: 8,
                        paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 }}>
                      <Text style={{ color: '#555' }}>फ़ोटो हटाएँ</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={{ height: 1, backgroundColor: '#E5E5E5', marginTop: 18, marginBottom: 14 }} />
              {/* SOCIALAPP_PROFILE_SETTINGS_V1 */}
              <View style={{ marginTop: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
  <Text style={{ color: '#26344D', fontWeight: '800', fontSize: 18 }}>Profile Settings</Text>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Settings" onPress={() => setSettingsHubOpen(true)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#172554', alignItems: 'center', justifyContent: 'center', elevation: 3 }}>
    <Text style={{ color: '#FFFFFF', fontSize: 23 }}>⚙</Text>
  </TouchableOpacity>
</View>
                <View>
                <View style={{ borderWidth: 1, borderColor: '#E1E8F3', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: '#26344D', fontWeight: '700', fontSize: 15 }}>Notifications</Text>
                      <Text style={{ color: '#7A879B', fontSize: 12, marginTop: 4 }}>
                        {notificationsEnabled ? 'Preference enabled' : 'Preference disabled'}
                      </Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={changeNotificationPreference}
                      disabled={notificationsBusy}
                      trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                      thumbColor={notificationsEnabled ? '#2563EB' : '#F8FAFC'}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={openNotificationSettings}
                  disabled={notificationsBusy}
                  style={{ borderWidth: 1, borderColor: '#E1E8F3', borderRadius: 10, padding: 12, marginBottom: 10 }}
                >
                  <Text style={{ color: '#26344D', fontWeight: '700' }}>
                    {notificationDetailsOpen ? 'Hide notification options' : 'Manage notification options'}
                  </Text>
                  <Text style={{ color: '#7A879B', fontSize: 12, marginTop: 4 }}>
                    Likes, comments, follows, messages and system alerts
                  </Text>
                </TouchableOpacity>
                {notificationDetailsOpen && (
                  <View style={{ borderWidth: 1, borderColor: '#E1E8F3', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    {[
                      { key: 'likes', label: 'Likes' },
                      { key: 'comments', label: 'Comments' },
                      { key: 'follows', label: 'Follows' },
                      { key: 'messages', label: 'Messages' },
                      { key: 'system_alerts', label: 'System Alerts' },
                    ].map(item => (
                      <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                        <Text style={{ color: '#26344D', fontWeight: '600' }}>{item.label}</Text>
                        <Switch
                          value={!!notificationDetails[item.key]}
                          onValueChange={value => changeNotificationDetail(item.key, value)}
                          disabled={notificationsBusy || !notificationsEnabled}
                        />
                      </View>
                    ))}
                  </View>
                )}
                {[
                  { title: 'Account Security', subtitle: 'Password and sign-in security' },
                  { title: 'Privacy', subtitle: 'Control your privacy' },
                  { title: 'Account Settings', subtitle: 'Manage your account' },
                ].map(item => (
                  <TouchableOpacity
                    key={item.title}
                    onPress={() => {
                      if (item.title === 'Privacy') {
                        openPrivacySettings();
                      } else if (item.title === 'Account Security') {
                        setPasswordOpen(true);
                      } else if (item.title === 'Account Settings') {
                        openAccountSettings();
                      } else if (item.title === 'Notifications') {
                        openNotificationSettings();
                      } else {
                        Alert.alert(item.title, 'This setting will be added in a later step.');
                      }
                    }}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: '#E5E5E5',
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#333', fontWeight: '600', fontSize: 15 }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: '#777', fontSize: 12, marginTop: 4 }}>
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                ))}


                              </View>
                <Text style={{ color: '#555', fontWeight: '700', marginBottom: 12 }}>आपकी पोस्ट</Text>
              {groupPostItems(feedPosts.filter(p => (p.user || 'you') === 'you')).length ? (
                groupPostItems(feedPosts.filter(p => (p.user || 'you') === 'you')).map((p, i) =>
                  <PostCard key={p.groupId || p.id || `my-post-${i}`} post={p} onOpen={() => setSelectedPost(p)} />)
              ) : (
                <Text style={{ color: '#888', paddingVertical: 12 }}>अभी आपकी कोई पोस्ट नहीं है।</Text>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#555' }}>{activeTab}</Text>
        </View>
      )}

      <View style={styles.bottomNav}>
        {[
          { name: 'Home', icon: '⌂', color: '#4F83CC' },
          { name: 'Search', icon: '⌕', color: '#9274CC' },
          { name: 'Create', icon: '＋', color: '#4A9D83' },
          { name: 'Reels', icon: '▻', color: '#D879A0' },
          { name: 'Profile', icon: '○', color: '#C69255' }
        ].map(tab => (
          <TouchableOpacity key={tab.name} style={styles.navItem} onPress={() => handleTab(tab.name)}>
            <Text style={[styles.navIcon, { color: tab.color }, activeTab === tab.name && { fontWeight: '800' }]}>{tab.icon}</Text>
            <Text style={[styles.navLabel, activeTab === tab.name && styles.activeNavLabel]}>{tab.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={!!selectedStory}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStory(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedStory(null)}
            style={{ position: 'absolute', top: 38, right: 18, zIndex: 2, padding: 12 }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 30 }}>×</Text>
          </TouchableOpacity>
          {selectedStory?.uri ? (
            selectedStory.mediaType === 'video' ? (
              <ReelVideo uri={selectedStory.uri} zoomControls />
            ) : (
              <ZoomableImage
                uri={selectedStory.uri}
                style={{ width: '100%', height: '78%' }}
              />
            )
          ) : (
            <Text style={{ color: '#FFFFFF', textAlign: 'center', padding: 24 }}>
              Story media is unavailable.
            </Text>
          )}
          {!!selectedStory?.caption && (
            <Text style={{ color: '#FFFFFF', textAlign: 'center', padding: 16 }}>
              {selectedStory.caption}
            </Text>
          )}
          <Text style={{ color: '#BBBBBB', textAlign: 'center', paddingBottom: 24 }}>
            {selectedStory?.name || selectedStory?.user || 'Story'}
          </Text>
          {!!selectedStory?.createdAt && (
            <Text style={{ color: '#BBBBBB', textAlign: 'center', paddingBottom: 12 }}>
              {formatPostTime(selectedStory.createdAt)}
            </Text>
          )}
          <TouchableOpacity
            accessibilityLabel="Previous story"
            onPress={() => moveStory(-1)}
            style={{ position: 'absolute', left: 0, top: 75, bottom: 65, width: '35%', zIndex: 1 }}
            activeOpacity={1}
          />
          <TouchableOpacity
            accessibilityLabel="Next story"
            onPress={() => moveStory(1)}
            style={{ position: 'absolute', right: 0, top: 75, bottom: 65, width: '65%', zIndex: 1 }}
            activeOpacity={1}
          />
        </View>
      </Modal>


      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedPost(null)}
            style={{ position: 'absolute', top: 38, right: 18, zIndex: 2, padding: 12 }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 30 }}>×</Text>
          </TouchableOpacity>
          {selectedPost?.uri && selectedPost.mediaType === 'video' ? (
            <ReelVideo uri={selectedPost.uri} zoomControls />
          ) : selectedPost?.uri ? (
            <ZoomableImage
              uri={selectedPost.uri}
              style={{ width: '100%', height: '72%' }}
            />
          ) : (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 48 }}>
                {selectedPost?.emoji || '🌿'}
              </Text>
            </View>
          )}
          {!!selectedPost?.caption && (
            <Text style={{ color: '#FFFFFF', textAlign: 'center', padding: 16 }}>
              {selectedPost.caption}
            </Text>
          )}
          <Text style={{ color: '#BBBBBB', textAlign: 'center', paddingBottom: 24 }}>
            {selectedPost?.user || 'you'}
          </Text>
        </View>
      </Modal>


      {/* SOCIALAPP_PREMIUM_SETTINGS_HUB_V1 */}
      <Modal
        visible={settingsHubOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsHubOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#F7F9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: '92%' }}>
            <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 4, backgroundColor: '#CBD5E1', marginBottom: 18 }} />
            <View style={{ backgroundColor: '#172554', borderRadius: 22, padding: 20, marginBottom: 20 }}>
              <Text style={{ color: '#BFDBFE', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>BHOOMI SOCIAL</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 7 }}>Settings</Text>
              <Text style={{ color: '#D8E3F8', fontSize: 13, marginTop: 5 }}>Manage your account and preferences</Text>
            </View>
            {[
              { title: 'Notifications', subtitle: 'Choose which alerts you receive', icon: '♧', color: '#DBEAFE', action: () => { setSettingsHubOpen(false); openNotificationSettings(); } },
              { title: 'Account Security', subtitle: 'Change your password', icon: '▣', color: '#F3E8FF', action: () => { setSettingsHubOpen(false); setPasswordOpen(true); } },
              { title: 'Privacy', subtitle: 'Manage account visibility and messages', icon: '◈', color: '#D1FAE5', action: () => { setSettingsHubOpen(false); openPrivacySettings(); } },
              { title: 'Account Settings', subtitle: 'Update your email and phone number', icon: '◎', color: '#FEF3C7', action: () => { setSettingsHubOpen(false); openAccountSettings(); } },
              { title: 'About Bhoomi Social', subtitle: 'App information', icon: 'ⓘ', color: '#E0E7FF', action: () => Alert.alert('About Bhoomi Social', 'Bhoomi Social is your social community app.') },
            ].map(item => (
              <TouchableOpacity
                key={item.title}
                onPress={item.action}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 17, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E7ECF5' }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <Text style={{ color: '#172554', fontSize: 23, fontWeight: '800' }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1E293B', fontWeight: '800', fontSize: 15 }}>{item.title}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{item.subtitle}</Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 23 }}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setSettingsHubOpen(false)}
              style={{ alignItems: 'center', paddingVertical: 14, marginTop: 2 }}
            >
              <Text style={{ color: '#475569', fontWeight: '800', fontSize: 14 }}>Close Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SOCIALAPP_PRIVACY_SCREEN_V1 */}
      <Modal
        visible={privacyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 }}>
            <Text style={{ color: '#333333', fontSize: 20, fontWeight: '700', marginBottom: 18 }}>
              Privacy Settings
            </Text>
            {[
              { key: 'isPrivate', title: 'Private Account', subtitle: 'Set your account as private' },
              { key: 'showActivity', title: 'Show Activity', subtitle: 'Allow your activity to be visible' },
              { key: 'allowMessages', title: 'Allow Messages', subtitle: 'Allow other users to message you' },
            ].map(item => (
              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: '#333333', fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: '#777777', fontSize: 12, marginTop: 3 }}>{item.subtitle}</Text>
                </View>
                <Switch
                  value={privacySettings[item.key]}
                  onValueChange={value => setPrivacySettings(current => ({ ...current, [item.key]: value }))}
                  disabled={privacyBusy}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => setPrivacyOpen(false)}
                disabled={privacyBusy}
                style={{ padding: 12, marginRight: 8 }}
              >
                <Text style={{ color: '#555555' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={persistPrivacySettings}
                disabled={privacyBusy}
                style={{ padding: 12, backgroundColor: '#E5E5E5', borderRadius: 8 }}
              >
                <Text style={{ color: '#333333', fontWeight: '700' }}>
                  {privacyBusy ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* SOCIALAPP_VERSION_UPDATE_MODAL_V1 */}
      <Modal
        visible={updatePromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!updateInfo?.force_update) setUpdatePromptVisible(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#171717', marginBottom: 12 }}>Update Available</Text>
            <Text style={{ fontSize: 15, color: '#555555', textAlign: 'center', lineHeight: 22, marginBottom: 22 }}>
              {updateInfo?.message || 'A new version of Bhumi Social AI is available.'}
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(updateInfo?.download_url || 'https://bhumi-social-app-fresh.onrender.com/download')}
              style={{ backgroundColor: '#1685D9', paddingVertical: 13, paddingHorizontal: 24, borderRadius: 10, width: '100%', alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Update Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Share.share({
                message: 'Download Bhumi Social AI: https://bhumi-social-app-fresh.onrender.com/download',
              })}
              style={{ backgroundColor: '#1685D9', paddingVertical: 13, paddingHorizontal: 24, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 10 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Share App Link</Text>
            </TouchableOpacity>
            {!updateInfo?.force_update && (
              <TouchableOpacity
                onPress={() => setUpdatePromptVisible(false)}
                style={{ paddingVertical: 14, paddingHorizontal: 24, marginTop: 6 }}
              >
                <Text style={{ color: '#555555', fontWeight: '600', fontSize: 15 }}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* SOCIALAPP_ACCOUNT_SETTINGS_V1 */}
      <Modal
        visible={accountSettingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!accountSettingsBusy) setAccountSettingsOpen(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#26344D', marginBottom: 6 }}>
              Account Settings
            </Text>
            <Text style={{ color: '#7A879B', marginBottom: 18 }}>
              Email and mobile number are optional.
            </Text>
            <Text style={{ color: '#26344D', fontWeight: '700', marginBottom: 6 }}>Email address</Text>
            <TextInput
              value={accountEmail}
              onChangeText={setAccountEmail}
              placeholder="Email address (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!accountSettingsBusy}
              style={{ borderWidth: 1, borderColor: '#D8E0EC', borderRadius: 12, padding: 13, marginBottom: 14, color: '#26344D' }}
            />
            <Text style={{ color: '#26344D', fontWeight: '700', marginBottom: 6 }}>Mobile number</Text>
            <TextInput
              value={accountPhone}
              onChangeText={setAccountPhone}
              placeholder="Mobile number (optional)"
              keyboardType="phone-pad"
              editable={!accountSettingsBusy}
              style={{ borderWidth: 1, borderColor: '#D8E0EC', borderRadius: 12, padding: 13, marginBottom: 18, color: '#26344D' }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
              <TouchableOpacity
                disabled={accountSettingsBusy}
                onPress={() => setAccountSettingsOpen(false)}
                style={{ padding: 13, marginRight: 8 }}
              >
                <Text style={{ color: '#64748B', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={accountSettingsBusy}
                onPress={saveAccountSettingsChanges}
                style={{ backgroundColor: '#2563EB', paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, opacity: accountSettingsBusy ? 0.6 : 1 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{accountSettingsBusy ? 'Saving...' : 'Save changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SOCIALAPP_CHANGE_PASSWORD_SCREEN_V1 */}
      <Modal
        visible={passwordOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!passwordBusy) setPasswordOpen(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20 }}>
            <Text style={{ color: '#333333', fontSize: 20, fontWeight: '700', marginBottom: 18 }}>
              Change Password
            </Text>

            {[
              { label: 'Old Password', value: oldPassword, setter: setOldPassword },
              { label: 'New Password', value: newPassword, setter: setNewPassword },
              { label: 'Confirm New Password', value: confirmNewPassword, setter: setConfirmNewPassword },
            ].map(field => (
              <TextInput
                key={field.label}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.label}
                secureTextEntry
                autoCapitalize="none"
                editable={!passwordBusy}
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E5E5',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                  color: '#333333',
                }}
              />
            ))}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setPasswordOpen(false)}
                disabled={passwordBusy}
                style={{ padding: 12, marginRight: 8 }}
              >
                <Text style={{ color: '#555555' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!oldPassword || !newPassword || !confirmNewPassword) {
                    Alert.alert('Missing information', 'Fill in all three password fields.');
                    return;
                  }
                  if (newPassword !== confirmNewPassword) {
                    Alert.alert('Passwords do not match', 'Enter the same new password twice.');
                    return;
                  }
                  if (newPassword.length < 4 || newPassword.length > 24) {
                    Alert.alert('Invalid password', 'The new password must be 4 to 24 characters.');
                    return;
                  }
                  setPasswordBusy(true);
                  try {
                    const result = await changeAccountPassword(
                      oldPassword,
                      newPassword,
                      confirmNewPassword
                    );
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setPasswordOpen(false);
                    Alert.alert('Success', result.message || 'Password changed successfully.');
                  } catch (e) {
                    Alert.alert('Password change failed', e.message || 'Please try again.');
                  } finally {
                    setPasswordBusy(false);
                  }
                }}
                disabled={passwordBusy}
                style={{ padding: 12, backgroundColor: '#E5E5E5', borderRadius: 8 }}
              >
                <Text style={{ color: '#333333', fontWeight: '700' }}>
                  {passwordBusy ? 'Saving...' : 'Change Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1 },
  header: {
    height: 56,
    transform: [{ translateY: 24 }],
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7E7E7',
  },
  brand: { fontSize: 27, fontWeight: '800', color: '#171717', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 19 },
  headerIcon: { fontSize: 27, color: '#171717' },
  stories: { paddingHorizontal: 10, paddingVertical: 13, gap: 14 },
  story: { width: 68, alignItems: 'center' },
  storyRing: {
    width: 62, height: 62, borderRadius: 31, padding: 3,
    borderWidth: 2, borderColor: '#D62976',
    alignItems: 'center', justifyContent: 'center',
  },
  ownRing: { borderColor: '#D9D9D9' },
  storyAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  plus: { fontSize: 30, color: '#1685D9' },
  avatarLetter: { fontSize: 22, fontWeight: '700', color: '#343434' },
  storyName: { marginTop: 5, fontSize: 11, color: '#252525' },
  feedDivider: { height: 1, backgroundColor: '#EEEEEE' },
  post: { marginBottom: 18 },
  postHeader: {
    height: 58, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  smallAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E4EAF4', alignItems: 'center', justifyContent: 'center',
  },
  smallAvatarText: { fontSize: 16, fontWeight: '700', color: '#34415A' },
  postUserInfo: { flex: 1, marginLeft: 10 },
  username: { fontSize: 13, fontWeight: '700', color: '#171717' },
  location: { marginTop: 2, fontSize: 11, color: '#555555' },
  more: { fontSize: 19, fontWeight: '700', color: '#222222', paddingHorizontal: 5 },
  postImage: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  postEmoji: { fontSize: 112 },
  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingTop: 8, gap: 16,
  },
  actionIcon: { fontSize: 28, color: '#202020' },
  liked: { color: '#E1306C' },
  actionSpacer: { flex: 1 },
  likes: { marginHorizontal: 13, marginTop: 4, fontSize: 13, fontWeight: '700', color: '#171717' },
  caption: { marginHorizontal: 13, marginTop: 5, fontSize: 13, color: '#242424', lineHeight: 19 },
  comments: { marginHorizontal: 13, marginTop: 5, color: '#888888', fontSize: 12 },
  time: { marginHorizontal: 13, marginTop: 6, fontSize: 9, color: '#888888', letterSpacing: 0.6 },
  bottomNav: {
    height: 58,
    transform: [{ translateY: -28 }],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 24, color: '#333333' },
  activeNavIcon: { color: '#1685D9', fontWeight: '800' },
  navLabel: { fontSize: 9, color: '#666666', marginTop: 1 },
  activeNavLabel: { color: '#1685D9', fontWeight: '700' },
});
