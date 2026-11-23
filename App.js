import { Ionicons } from "@expo/vector-icons";

import { StatusBar } from "expo-status-bar";
import appConfig from "./app.json";
import SettingsDashboard from "./SettingsDashboard";
import ChatPersonalization from "./ChatPersonalization";
import VoiceVideoCallControls from "./VoiceVideoCallControls";
import { ensureCallKeepSetup } from "./incomingCallBackgroundTask";
import { registerCallPushToken } from "./api";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import React from "react";
import { useEvent, useEventListener } from "expo";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import {Alert as NativeAlert,
  Share,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  BackHandler,
  Platform,
  AppState } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  applyZoomEffect,
  createVideoFromPhotos,
  addMusicToVideo,
  applyVideoEffects,
  VIDEO_FILTERS,
  VOICE_EFFECTS,
} from "./videoEditor";
import { editPhotoAsset, POST_PHOTO_FILTERS, getPostPhotoFilter, applyPostPhotoFilter } from "./photoEditor";
import { buildGoogleMusicSearchUrl, loadMusicLibrary, importAudioToMusicLibrary, updateMusicTrack, removeMusicTrack, searchLocalMusic } from "./musicLibrary";
import {
  loadContent,
  getCachedContent,
  getCachedProfile,
  uploadContent,
  deleteContent,
  checkServer,
  loadProfile,
  loadProfilePosts,
  updateProfile,
  uploadProfileAvatar,
  deleteProfileAvatar,
  loadProfileConnections,
  followProfile,
  unfollowProfile,
  loadPrivacySettings,
  savePrivacySettings,
  loadBusinessProfile,
  saveBusinessProfile,
  loadBusinessInsights,
  discoverBusinesses,
  loadBusinessCatalog,
  createBusinessCatalogItem,
  deleteBusinessCatalogItem,
  loadBusinessQuickReplies,
  createBusinessQuickReply,
  deleteBusinessQuickReply,
  loadBlockedAccounts,
  blockAccount,
  unblockAccount,
  loadRestrictedAccounts,
  restrictAccount,
  unrestrictAccount,
  changeAccountPassword,
  logoutOtherSessions,
  loadAccountSettings,
  saveAccountSettings,
  loadNotificationPreference,
  saveNotificationPreference,
  loadNotificationDetails,
  saveNotificationDetails,
  loadSettingsPreferences,
  saveSettingsPreferences,
  togglePostLike,
  loadPostById,
  loadPostComments,
  createPostComment,
  approvePostComment,
  toggleReelLike,
  loadReelComments,
  createReelComment,
  approveReelComment,
  loadSavedContent,
  toggleSavedContent,
  registerAccount,
  loginAccount,
  logoutAccount,
  getAuthSession,
  clearAuthSession,
  requestPasswordReset,
  verifyPasswordReset,
  resetPasswordWithToken,
  verifyAuthSession,
  warmUpServer,
  searchUsers,
  loadFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  loadMessageConversations,
  updateMessageConversationFolder,
  sendPresenceHeartbeat,
  getChatPresence,
  loadUserNotes,
  saveUserNote,
  deleteUserNote,
  loadDirectMessages,
  sendDirectMessage,
  unsendDirectMessage,
  uploadChatAttachment,
  updateChatTyping,
  loadChatTyping,
  loadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./api";
import {
  SafeAreaView,
  ScrollView,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  TouchableOpacity,
  Switch,
  Modal,
  Linking,
} from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: notification?.request?.content?.data?.soundEnabled !== false,
    shouldSetBadge: false,
  }),
});

function formatHindiLastSeen(value) {
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return "आख़िरी बार उपलब्ध नहीं";
  const diff = Math.max(0, Date.now() - stamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "अभी देखा";
  if (mins < 60) return mins + " मिनट पहले देखा";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " घंटे पहले देखा";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + " दिन पहले देखा";
  return new Date(stamp).toLocaleDateString("hi-IN", { day: "numeric", month: "short", year: "numeric" }) + " को देखा";
}

function isVersionNewer(latest, current) {
  const a = String(latest || "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const b = String(current || "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function Story({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.story}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[styles.storyRing, item.own && styles.ownRing]}>
        <View style={[styles.storyInnerRing, item.own && styles.ownStoryInnerRing]}>
        <View
          style={[
            styles.storyAvatar,
            { backgroundColor: item.color || "#DDE7F5" },
          ]}
        >
          {item.uri ? (
            <Image
              source={{ uri: item.uri }}
              style={{ width: 52, height: 52, borderRadius: 26 }}
            />
          ) : item.own ? (
            <Text style={styles.plus}>＋</Text>
          ) : (
            <Text style={styles.avatarLetter}>
              {(item.name || "U").charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      </View>
        </View>
      <Text style={styles.storyName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

// SOCIALAPP_MEDIA_MASTER2
function ZoomableImage({ uri, style, onZoomChange, showControls = true }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [fitMode, setFitMode] = React.useState("fit");
  const [zoomLevel, setZoomLevel] = React.useState(1);

  React.useEffect(() => {
    onZoomChange?.(zoomLevel);
  }, [zoomLevel, onZoomChange]);

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
    .onUpdate((event) => {
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
      setZoomLevel(scale.value);
    })
    .runOnJS(true);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const gesture = pinch;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const setZoom = (value) => {
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
    <View style={[{ width: "100%", alignItems: "center" }, style]}>
      <GestureDetector gesture={gesture}>
        <Animated.Image
          source={{ uri }}
          style={[{ width: "100%", height: showControls ? "82%" : "100%" }, animatedStyle]}
          resizeMode={showControls ? (fitMode === "fit" ? "contain" : "cover") : "cover"}
        />
      </GestureDetector>
      {showControls ? (
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          paddingVertical: 6,
        }}
      >
        <TouchableOpacity
          onPress={resetZoom}
          style={{ paddingHorizontal: 10, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Reset Zoom</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFitMode("fit")}
          style={{ paddingHorizontal: 10, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Fit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFitMode("fill")}
          style={{ paddingHorizontal: 10, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Fill</Text>
        </TouchableOpacity>
        <Text style={{ color: "#FFFFFF", fontSize: 12, marginHorizontal: 6 }}>
          {zoomLevel.toFixed(1)}×
        </Text>
        <TouchableOpacity
          onPress={() => setZoom(zoomLevel - 0.5)}
          style={{ paddingHorizontal: 8, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16 }}>−</Text>
        </TouchableOpacity>
        <View style={{ width: 90, justifyContent: "center" }}>
          <View
            style={{ height: 4, backgroundColor: "#777777", borderRadius: 2 }}
          >
            <View
              style={{
                width: `${((zoomLevel - 1) / 4) * 100}%`,
                height: 4,
                backgroundColor: "#0095F6",
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -9,
              bottom: -9,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setZoom(value)}
                style={{
                  width: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: zoomLevel >= value ? "#1685D9" : "#BBBBBB",
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setZoom(zoomLevel + 0.5)}
          style={{ paddingHorizontal: 8, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16 }}>＋</Text>
        </TouchableOpacity>
      </View>
      ) : null}
    </View>
  );
}

function PinchZoomImage({
  uri,
  style,
  resizeMode = "contain",
  nativeScrollGesture,
  onZoomChange,
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [imageAspectRatio, setImageAspectRatio] = React.useState(1);

  React.useEffect(() => {
    let active = true;
    if (uri) {
      Image.getSize(
        uri,
        (width, height) => {
          if (active && width > 0 && height > 0)
            setImageAspectRatio(width / height);
        },
        () => {
          if (active) setImageAspectRatio(1);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [uri]);

  const imageHeight =
    viewportWidth > 0
      ? Math.min(
          viewportWidth / imageAspectRatio,
          Dimensions.get("window").height * 0.68,
        )
      : 320;

  const resetZoom = () => {
    onZoomChange?.(1);
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    setZoomLevel(1);
  };

  const setZoom = (value) => {
    const next = Math.max(1, Math.min(Number(value) || 1, 5));
    scale.value = next;
    savedScale.value = next;
    setZoomLevel(next);
    onZoomChange?.(next);
    if (next === 1) {
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      setZoomLevel(scale.value);
      onZoomChange?.(scale.value);
      if (scale.value <= 1.01) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={[
        style,
        {
          width: "100%",
          aspectRatio: undefined,
          overflow: "visible",
          backgroundColor: "#000000",
        },
      ]}
    >
      <View
        style={{
          width: "100%",
          height: imageHeight,
          overflow: "hidden",
          backgroundColor: "#000000",
        }}
      >
        <GestureDetector
          gesture={
            nativeScrollGesture
              ? Gesture.Simultaneous(
                  pinch,
                  pan.enabled(zoomLevel > 1),
                )
                  .runOnJS(true)
                  .simultaneousWithExternalGesture(nativeScrollGesture)
              : Gesture.Simultaneous(
                  pinch,
                  pan.enabled(zoomLevel > 1),
                ).runOnJS(true)
          }
        >
          <Animated.Image
            source={{ uri }}
            style={[{ width: "100%", height: "100%" }, animatedStyle]}
            resizeMode="contain"
          />
        </GestureDetector>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 5,
          backgroundColor: "#000000",
        }}
      >
        <TouchableOpacity
          onPress={resetZoom}
          style={{ paddingHorizontal: 10, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setZoom(zoomLevel - 0.5)}
          style={{ paddingHorizontal: 9, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16 }}>−</Text>
        </TouchableOpacity>
        <Text style={{ color: "#FFFFFF", fontSize: 12, marginHorizontal: 6 }}>
          {zoomLevel.toFixed(1)}×
        </Text>
        <TouchableOpacity
          onPress={() => setZoom(zoomLevel + 0.5)}
          style={{ paddingHorizontal: 9, paddingVertical: 5 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16 }}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
function ReelVideo(props) {
  if (props.zoomEnabled === false) {
    return <ReelVideoPlain {...props} />;
  }
  return <ReelVideoZoomable {...props} />;
}

const ReelVideoPlain = React.memo(function ReelVideoPlain({
  uri,
  height = 420,
  active = true,
  muted = false,
  contentFit = "contain",
  loop = true,
  onPlayToEnd,
  onTimeUpdate,
}) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = loop;
    p.muted = muted;
  });
  useEventListener(player, "playToEnd", onPlayToEnd || (() => {}));
  useEventListener(player, "timeUpdate", (event) => {
    onTimeUpdate?.(event.currentTime, player.duration);
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });

  React.useEffect(() => {
    try {
      if (active) player.play();
      else player.pause();
    } catch (error) {
      console.log("PLAIN_REEL_PLAYBACK_ERROR:", error?.message);
    }
    return () => {
      try {
        player.pause();
      } catch (error) {}
    };
  }, [active, player]);

  React.useEffect(() => {
    try {
      player.muted = muted;
    } catch (error) {}
  }, [muted, player]);

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View
        style={{
          width: "100%",
          height,
          backgroundColor: "#000",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          contentFit={contentFit}
          nativeControls={false}
        />
        {status === "loading" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
          </View>
        )}
        {status === "error" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 14, textAlign: "center" }}
            >
              Video unavailable:{" "}
              {error?.message || "Could not load this video."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

function ReelVideoZoomable({
  uri,
  zoomControls = false,
  height = 420,
  active = true,
  muted = false,
  contentFit = "contain",
  nativeScrollGesture,
  onZoomChange,
  zoomEnabled = true,
  loop = true,
  onPlayToEnd,
  onTimeUpdate,
}) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = loop;
    p.muted = muted;
  });
  useEventListener(player, "playToEnd", onPlayToEnd || (() => {}));
  useEventListener(player, "timeUpdate", (event) => {
    onTimeUpdate?.(event.currentTime, player.duration);
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });

  React.useEffect(() => {
    try {
      if (active) player.play();
      else player.pause();
    } catch (error) {
      console.log("REEL_PLAYBACK_STATE_ERROR:", error?.message);
    }
    return () => {
      try {
        player.pause();
      } catch (error) {
        console.log("REEL_PAUSE_CLEANUP_ERROR:", error?.message);
      }
    };
  }, [active, player]);

  React.useEffect(() => {
    try {
      player.muted = muted;
    } catch (error) {
      console.log("REEL_MUTE_STATE_ERROR:", error?.message);
    }
  }, [muted, player]);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      setZoomLevel(scale.value);
      onZoomChange?.(scale.value);
      if (scale.value <= 1.01) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const videoGestures = zoomEnabled
    ? Gesture.Simultaneous(
        pinch,
        pan.enabled(zoomLevel > 1),
      ).runOnJS(true)
    : null;
  const gesture =
    videoGestures && nativeScrollGesture
      ? videoGestures.simultaneousWithExternalGesture(nativeScrollGesture)
      : videoGestures;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const setZoom = (value) => {
    const next = Math.max(1, Math.min(Number(value) || 1, 5));
    scale.value = next;
    savedScale.value = next;
    setZoomLevel(next);
    onZoomChange?.(next);
    if (next === 1) {
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View
        style={{
          width: "100%",
          height,
          backgroundColor: "#000",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {zoomEnabled ? (
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                {
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#000",
                  alignItems: "center",
                  justifyContent: "center",
                },
                animatedStyle,
              ]}
            >
              <VideoView
                player={player}
                style={{ width: "100%", height: "100%" }}
                contentFit={contentFit}
                nativeControls={false}
              />
            </Animated.View>
          </GestureDetector>
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#000",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <VideoView
              player={player}
              style={{ width: "100%", height: "100%" }}
              contentFit={contentFit}
              nativeControls={false}
            />
          </View>
        )}

        {status === "loading" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            
          </View>
        )}
        {status === "error" && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 14, textAlign: "center" }}
            >
              Video unavailable:{" "}
              {error?.message || "Could not load this video."}
            </Text>
          </View>
        )}
      </View>
      {zoomControls && (
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 6,
          }}
        >
          <TouchableOpacity
            onPress={() => setZoom(1)}
            style={{ paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Reset Zoom</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setZoom(zoomLevel - 0.5)}
            style={{ paddingHorizontal: 8, paddingVertical: 5 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16 }}>−</Text>
          </TouchableOpacity>
          <Text style={{ color: "#FFFFFF", fontSize: 12, marginHorizontal: 6 }}>
            {zoomLevel.toFixed(1)}×
          </Text>
          <TouchableOpacity
            onPress={() => setZoom(zoomLevel + 0.5)}
            style={{ paddingHorizontal: 8, paddingVertical: 5 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16 }}>＋</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function formatPostTime(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return "Yesterday";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function groupPostItems(items) {
  const result = [];
  const groups = new Map();

  for (const item of items) {
    if (item.type !== "posts" || !item.groupId) {
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

function PostMediaTapSurface({ children, style, onSingleTap, onDoubleTap }) {
  // Native press handling lets FlatList cancel a press as soon as dragging starts.
  // A stationary tap opens the post; a second quick tap likes it.
  const tapTimer = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const handlePress = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap?.();
      return;
    }

    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onSingleTap?.();
    }, 260);
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress} style={style}>
      {children}
    </TouchableOpacity>
  );
}

function PostCard({
  post,
  authSession,
  onOpen = () => {},
  onCreateAction = () => {},
  onOpenProfile = () => {},
  onDelete = () => {},
  pageHeight = 0,
  active = true,
  autoPlay = true,
}) {
  const [mediaWidth, setMediaWidth] = React.useState(0);
  const [mediaIndex, setMediaIndex] = React.useState(0);

  const [liked, setLiked] = React.useState(Boolean(post?.isLiked));
  const [likeCount, setLikeCount] = React.useState(
    Number(String(post?.likesCount ?? post?.likes ?? "0").replace(/,/g, "")) || 0,
  );

  React.useEffect(() => {
    setLiked(Boolean(post?.isLiked));
    setLikeCount(
      Number(String(post?.likesCount ?? post?.likes ?? "0").replace(/,/g, "")) || 0,
    );
  }, [post?.id, post?.isLiked, post?.likesCount, post?.likes]);
  const [saved, setSaved] = React.useState(false);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [comments, setComments] = React.useState([]);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [interactionBusy, setInteractionBusy] = React.useState(false);
  const [postFooterHeight, setPostFooterHeight] = React.useState(150);
  const mediaHeight =
    pageHeight > 0 ? Math.max(0, pageHeight - 58 - postFooterHeight) : 420;

  const sharePost = async () => {
    try {
      const postLink = post?.id ? `bhumisocial://post/${post.id}` : "";
      const message = `${post?.user || "Bhumi Social"}: ${post?.caption || "Check out this post on Bhumi Social AI"}${postLink ? `\\n\\nOpen post: ${postLink}` : ""}`;
      await Share.share({ message });
    } catch (error) {
      Alert.alert("Share", error.message || "Could not share this post.");
    }
  };

  const handleLike = async () => {
    if (interactionBusy) return;

    if (
      !post.id ||
      post?.isStarterPost ||
      post?.isStarterReel ||
      String(post?.id || "").startsWith("bhumi-starter-")
    ) {
      setLiked((previous) => {
        setLikeCount((count) => Math.max(0, count + (previous ? -1 : 1)));
        return !previous;
      });
      return;
    }

    setInteractionBusy(true);
    try {
      const result = await togglePostLike(post.id, authSession);
      setLiked(Boolean(result.liked));
      setLikeCount(Number(result.likes) || 0);
    } catch (error) {
      Alert.alert("Like failed", error.message || "Could not update like.");
    } finally {
      setInteractionBusy(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    if (
      !post.id ||
      post?.isStarterPost ||
      post?.isStarterReel ||
      String(post?.id || "").startsWith("bhumi-starter-")
    ) {
      setComments([]);
      return;
    }

    try {
      const result = await loadPostComments(post.id);
      setComments(result);
    } catch (error) {
      Alert.alert("Comments", error.message || "Could not load comments.");
    }
  };

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || interactionBusy) return;

    if (
      post?.isStarterPost ||
      post?.isStarterReel ||
      String(post?.id || "").startsWith("bhumi-starter-")
    ) {
      setComments((previous) => [
        ...previous,
        {
          id: `local-${Date.now()}`,
          username: authSession?.username || "you",
          text,
        },
      ]);
      setCommentDraft("");
      return;
    }
    if (!post.id) {
      Alert.alert(
        "Comments",
        "Save this post to the server before commenting.",
      );
      return;
    }

    setInteractionBusy(true);
    try {
      const comment = await createPostComment(post.id, text);
      setComments((previous) => [...previous, comment]);
      setCommentDraft("");
    } catch (error) {
      Alert.alert("Comment failed", error.message || "Could not post comment.");
    } finally {
      setInteractionBusy(false);
    }
  };

  const handleApproveComment = async (commentId) => {
    if (!post?.id || interactionBusy) return;
    setInteractionBusy(true);
    try {
      await approvePostComment(post.id, commentId);
      setComments((items) =>
        items.map((item) =>
          String(item.id) === String(commentId)
            ? { ...item, isPending: false }
            : item,
        ),
      );
    } catch (error) {
      Alert.alert(
        "Comment approval",
        error.message || "Could not approve comment.",
      );
    } finally {
      setInteractionBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.post,
        pageHeight > 0 ? { height: pageHeight, marginBottom: 0 } : null,
      ]}
    >
      <View
        style={[
          styles.postHeader,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            backgroundColor: "#000000",
          },
        ]}
      >
        <TouchableOpacity onPress={() => onOpenProfile(post.user)} activeOpacity={0.75} style={styles.smallAvatar}>
          {post.avatarUrl ? (
            <Image
              source={{ uri: post.avatarUrl }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
          ) : (
            <Text style={styles.smallAvatarText}>
              {(post.user || "U").charAt(0).toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.postUserInfo}>
          <TouchableOpacity onPress={() => onOpenProfile(post.user)} activeOpacity={0.75}>
            <Text style={[styles.username, { color: "#FFFFFF" }]}>
              {post.user || "you"}
            </Text>
          </TouchableOpacity>
          {!!post.location && (
            <Text style={[styles.location, { color: "#FFFFFF" }]}>
              {post.location}
            </Text>
          )}
        </View>
        {String(post.user || "").replace(/^@/, "").toLowerCase() === String(authSession?.username || "").toLowerCase() && !post.isStarterPost && !post.isStarterReel ? (
          <TouchableOpacity onPress={() => onDelete(post, "posts")} accessibilityLabel="Delete your post" style={{ padding: 9 }}>
            <Ionicons name="trash-outline" size={20} color="#0095F6" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity>
            <Text style={styles.more}>•••</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        onLayout={(event) => setMediaWidth(event.nativeEvent.layout.width)}
        style={{
          position: "absolute",
          top: 58,
          left: 0,
          right: 0,
          height: mediaHeight,
          overflow: "hidden",
          backgroundColor: "#000000",
        }}
      >
        {post.mediaItems?.length > 1 ? (
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={{ height: mediaHeight }}
            onMomentumScrollEnd={(event) => {
              const width =
                mediaWidth || event.nativeEvent.layoutMeasurement.width;
              if (width > 0) {
                setMediaIndex(
                  Math.round(event.nativeEvent.contentOffset.x / width),
                );
              }
            }}
          >
            {(post.mediaItems || []).map((media, index) => (
              <PostMediaTapSurface
                key={String(media.id || index)}
                onSingleTap={onOpen}
                onDoubleTap={handleLike}
                style={{ width: mediaWidth || 320, height: mediaHeight }}
              >
                {media.uri && media.mediaType === "video" ? (
                  <ReelVideo
                    uri={media.uri}
                    height={mediaHeight}
                    active={active && mediaIndex === index && autoPlay}
                    contentFit="cover"
                    zoomEnabled={false}
                  />
                ) : media.uri ? (
                  <Image
                    source={{ uri: media.uri }}
                    style={[
                      styles.postImage,
                      {
                        width: mediaWidth || "100%",
                        height: mediaHeight,
                        aspectRatio: undefined,
                      },
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.postImage,
                      {
                        height: mediaHeight,
                        aspectRatio: undefined,
                        backgroundColor: post.color || "#D8E7DF",
                      },
                    ]}
                  >
                    <Text style={styles.postEmoji}>{post.emoji || "🌿"}</Text>
                  </View>
                )}
              </PostMediaTapSurface>
            ))}
          </ScrollView>
        ) : (
          <PostMediaTapSurface
            onSingleTap={onOpen}
            onDoubleTap={handleLike}
            style={{ width: "100%", height: mediaHeight }}
          >
            {post.uri && post.mediaType === "video" ? (
              <ReelVideo
                uri={post.uri}
                height={mediaHeight}
                active={active}
                contentFit="cover"
                zoomEnabled={false}
              />
            ) : post.uri ? (
              <Image
                source={{ uri: post.uri }}
                style={[
                  styles.postImage,
                  { height: mediaHeight, aspectRatio: undefined },
                ]}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.postImage,
                  { backgroundColor: post.color || "#D8E7DF" },
                ]}
              >
                <Text style={styles.postEmoji}>{post.emoji || "🌿"}</Text>
              </View>
            )}
          </PostMediaTapSurface>
        )}
        {post.mediaItems?.length > 1 && (
          <Text
            style={{
              textAlign: "center",
              paddingVertical: 5,
              color: "#A8A8A8",
              fontSize: 12,
            }}
          >
            {mediaIndex + 1} / {post.mediaItems.length}
          </Text>
        )}
      </View>

      <View
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0 && height !== postFooterHeight)
            setPostFooterHeight(height);
        }}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          backgroundColor: "#000000",
          paddingBottom: 10,
          paddingTop: 6,
        }}
      >
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLike} disabled={interactionBusy}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={27}
              color={liked ? "#ED4956" : "#FFFFFF"}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={openComments}>
            <Ionicons name="chatbubble-outline" size={24} color="#0095F6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={sharePost}>
            <Ionicons name="paper-plane-outline" size={25} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.actionSpacer} />
          <TouchableOpacity onPress={() => setSaved(!saved)}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={25}
              color="#0095F6"
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.likes, { color: "#FFFFFF" }]}>
          {likeCount.toLocaleString()} likes
        </Text>
        {!!post.caption && (
          <Text style={[styles.caption, { color: "#FFFFFF" }]}>
            <Text style={[styles.username, { color: "#FFFFFF" }]}>
              {post.user || "you"}{" "}
            </Text>
            {post.caption}
          </Text>
        )}
        <TouchableOpacity onPress={openComments}>
          <Text style={[styles.comments, { color: "#FFFFFF" }]}>
            View all comments
          </Text>
        </TouchableOpacity>
        {!!post.createdAt && (
          <Text style={[styles.time, { color: "#FFFFFF" }]}>
            {formatPostTime(post.createdAt)}
          </Text>
        )}
      </View>
      <Modal
        visible={commentsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              paddingBottom: Platform.OS === "android" ? 38 : 0,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            <View
              style={{
                backgroundColor: "#121212",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderColor: "#262626",
                paddingHorizontal: 18,
                paddingTop: 10,
                paddingBottom: 18,
                maxHeight: "78%",
              }}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 38,
                  height: 4,
                  borderRadius: 3,
                  backgroundColor: "#363636",
                  marginBottom: 16,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <View>
                  <Text
                    style={{ fontSize: 18, fontWeight: "800", color: "#FFFFFF" }}
                  >
                    Comments
                  </Text>
                  <Text style={{ color: "#8E8E93", fontSize: 11, marginTop: 3 }}>
                    Join the conversation
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCommentsOpen(false)}
                  accessibilityLabel="Close comments"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#1C1C1E",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 21, color: "#FFFFFF", lineHeight: 24 }}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flexGrow: 0, maxHeight: 360 }}>
                {comments.length === 0 ? (
                  <Text style={{ color: "#A8A8A8", paddingVertical: 12 }}>
                    No comments yet.
                  </Text>
                ) : (
                  comments.map((comment) => (
                    <View
                      key={String(comment.id)}
                      style={{ paddingVertical: 8 }}
                    >
                      <Text style={{ color: "#FFFFFF" }}>
                        <Text
                          onPress={() => onOpenProfile(comment.username)}
                          style={{ fontWeight: "600" }}
                        >
                          {comment.username || "you"}{" "}
                        </Text>
                        {comment.text}
                      </Text>

                      {comment.isPending ? (
                        <Text
                          style={{
                            color: "#B7791F",
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          Pending approval
                        </Text>
                      ) : null}
                      {comment.isPending && comment.canApprove ? (
                        <TouchableOpacity
                          onPress={() => handleApproveComment(comment.id)}
                          disabled={interactionBusy}
                          style={{
                            alignSelf: "flex-start",
                            marginTop: 6,
                            paddingVertical: 5,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: "#E8F2FC",
                          }}
                        >
                          <Text
                            style={{
                              color: "#0095F6",
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            Approve
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))
                )}
              </ScrollView>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="Write a comment..."
                  maxLength={2000}
                  editable={!interactionBusy}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#262626",
                    borderRadius: 22,
                    backgroundColor: "#121212",
                    paddingHorizontal: 15,
                    paddingVertical: 10,
                    color: "#FFFFFF",
                    fontSize: 13,
                  }}
                />
                <TouchableOpacity
                  onPress={submitComment}
                  disabled={interactionBusy || !commentDraft.trim()}
                  style={{
                    minWidth: 54,
                    height: 40,
                    marginLeft: 8,
                    paddingHorizontal: 13,
                    borderRadius: 20,
                    backgroundColor: commentDraft.trim() && !interactionBusy ? "#0095F6" : "#1C1C1E",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: interactionBusy ? 0.55 : 1,
                  }}
                >
                  <Text style={{ color: commentDraft.trim() && !interactionBusy ? "#FFFFFF" : "#8E8E93", fontWeight: "800", fontSize: 12 }}>
                    Post
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PostDetailActions({ post, authSession }) {
  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(
    Number(String(post?.likes || "0").replace(/,/g, "")) || 0,
  );
  const [comments, setComments] = React.useState([]);
  const [commentCount, setCommentCount] = React.useState(
    Number(post?.commentsCount || post?.commentCount || 0),
  );
  const [draft, setDraft] = React.useState("");
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  React.useEffect(() => {
    setLiked(false);
    setLikeCount(Number(String(post?.likes || "0").replace(/,/g, "")) || 0);
    setComments([]);
    setCommentCount(Number(post?.commentsCount || post?.commentCount || 0));
    setDraft("");
    setCommentsOpen(false);
  }, [post?.id]);

  const handleLike = async () => {
    if (busy) return;
    likeScale.value = withSequence(
      withSpring(1.4, { damping: 5, stiffness: 220 }),
      withSpring(1, { damping: 7, stiffness: 180 }),
    );
    if (
      !post?.id ||
      post?.isStarterPost ||
      post?.isStarterReel ||
      String(post?.id || "").startsWith("bhumi-starter-")
    ) {
      setLiked((old) => {
        setLikeCount((count) => Math.max(0, count + (old ? -1 : 1)));
        return !old;
      });
      return;
    }
    setBusy(true);
    try {
      const result = await togglePostLike(post.id, authSession);
      setLiked(Boolean(result.liked));
      setLikeCount(Number(result.likes) || 0);
    } catch (error) {
      Alert.alert("Like failed", error.message || "Could not update like.");
    } finally {
      setBusy(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    if (
      !post?.id ||
      post?.isStarterPost ||
      post?.isStarterReel ||
      String(post?.id || "").startsWith("bhumi-starter-")
    )
      return;
    try {
      const loadedComments = await loadPostComments(post.id);
      setComments(loadedComments);
      setCommentCount(loadedComments.length);
    } catch (error) {
      Alert.alert("Comments", error.message || "Could not load comments.");
    }
  };

  const submitComment = async () => {
    const value = draft.trim();
    if (!value || busy) return;
    if (
      post?.isStarterPost ||
      post?.isStarterReel ||
      String(post?.id || "").startsWith("bhumi-starter-")
    ) {
      setComments((old) => [
        ...old,
        {
          id: `local-${Date.now()}`,
          username: authSession?.username || "you",
          text: value,
        },
      ]);
      setCommentCount((count) => count + 1);
      setDraft("");
      return;
    }
    if (!post?.id) {
      Alert.alert("Comments", "This post is not saved on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const comment = await createPostComment(post.id, value);
      setComments((old) => [...old, comment]);
      setCommentCount((count) => count + 1);
      setDraft("");
    } catch (error) {
      Alert.alert("Comment failed", error.message || "Could not post comment.");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveComment = async (commentId) => {
    if (!post?.id || busy) return;
    setBusy(true);
    try {
      await approvePostComment(post.id, commentId);
      setComments((items) =>
        items.map((item) =>
          String(item.id) === String(commentId)
            ? { ...item, isPending: false }
            : item,
        ),
      );
    } catch (error) {
      Alert.alert(
        "Comment approval",
        error.message || "Could not approve comment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const sharePost = async () => {
    try {
      const postLink = post?.id ? `bhumisocial://post/${post.id}` : "";
      const message = `${post?.user || "Bhumi Social"}: ${post?.caption || "Check out this post on Bhumi Social AI"}${postLink ? `\n\nOpen post: ${postLink}` : ""}`;
      await Share.share({ message });
    } catch (error) {
      Alert.alert("Share", error.message || "Could not share this post.");
    }
  };

  return (
    <View style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 28 }}>
        <TouchableOpacity
          onPress={handleLike}
          disabled={busy}
          style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
        >
          <Animated.View style={likeAnimatedStyle}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={29}
              color={liked ? "#FF4968" : "#FFFFFF"}
            />
          </Animated.View>
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
            {likeCount.toLocaleString()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openComments}
          style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
        >
          <Ionicons name="chatbubble-outline" size={26} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
            {commentCount.toLocaleString()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={sharePost}>
          <Ionicons name="paper-plane-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <Modal
        visible={commentsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentsOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              paddingBottom: Platform.OS === "android" ? 38 : 0,
              backgroundColor: "rgba(0,0,0,0.55)",
            }}
          >
            <View
              style={{
                backgroundColor: "#121212",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 1,
                borderColor: "#262626",
                paddingHorizontal: 18,
                paddingTop: 10,
                paddingBottom: 18,
                maxHeight: "78%",
              }}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 38,
                  height: 4,
                  borderRadius: 3,
                  backgroundColor: "#363636",
                  marginBottom: 16,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <View>
                  <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                    Comments
                  </Text>
                  <Text style={{ color: "#8E8E93", fontSize: 11, marginTop: 3 }}>
                    Join the conversation
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCommentsOpen(false)}
                  accessibilityLabel="Close comments"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#1C1C1E",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={19} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 360 }}>
                {comments.length === 0 ? (
                  <Text style={{ color: "#A8A8A8", paddingVertical: 14 }}>
                    No comments yet. Be the first to comment.
                  </Text>
                ) : (
                  comments.map((item, index) => (
                    <View
                      key={String(item.id || index)}
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: "#262626",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", lineHeight: 21 }}>
                        <Text style={{ fontWeight: "800" }}>
                          {item.username || "you"}{" "}
                        </Text>
                        {item.text}
                      </Text>

                      {item.isPending ? (
                        <Text
                          style={{
                            color: "#0095F6",
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          Pending approval
                        </Text>
                      ) : null}
                      {item.isPending && item.canApprove ? (
                        <TouchableOpacity
                          onPress={() => handleApproveComment(item.id)}
                          disabled={busy}
                          style={{
                            alignSelf: "flex-start",
                            marginTop: 6,
                            paddingVertical: 5,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: "#263B59",
                          }}
                        >
                          <Text
                            style={{
                              color: "#60A5FA",
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            Approve
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))
                )}
              </ScrollView>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 14,
                  gap: 8,
                }}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Write a comment..."
                  placeholderTextColor="#8E8E93"
                  maxLength={2000}
                  editable={!busy}
                  style={{
                    flex: 1,
                    color: "#FFFFFF",
                    backgroundColor: "#121212",
                    borderWidth: 1,
                    borderColor: "#262626",
                    borderRadius: 22,
                    paddingHorizontal: 15,
                    paddingVertical: 11,
                    fontSize: 13,
                  }}
                />
                <TouchableOpacity
                  onPress={submitComment}
                  disabled={busy || !draft.trim()}
                  style={{
                    minWidth: 54,
                    height: 40,
                    marginLeft: 2,
                    paddingHorizontal: 13,
                    borderRadius: 20,
                    backgroundColor: draft.trim() && !busy ? "#0095F6" : "#1C1C1E",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.55 : 1,
                  }}
                >
                  <Text style={{ color: draft.trim() && !busy ? "#FFFFFF" : "#8E8E93", fontWeight: "800", fontSize: 12 }}>
                    Post
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

let customAlertHandler = null;
const Alert = {
  alert: (...args) => {
    if (customAlertHandler) customAlertHandler(...args);
    else NativeAlert.alert(...args);
  },
};

function CustomAlertHost() {
  const [alertData, setAlertData] = React.useState(null);

  React.useEffect(() => {
    const handler = (title, message, buttons, options) => {
      setAlertData({
        title: String(title || "Bhumi Social AI"),
        message: message == null ? "" : String(message),
        buttons:
          Array.isArray(buttons) && buttons.length ? buttons : [{ text: "Close" }],
        options: options || {},
      });
    };
    customAlertHandler = handler;
    return () => {
      if (customAlertHandler === handler) customAlertHandler = null;
    };
  }, []);

  if (!alertData) return null;
  const words = (alertData.title + " " + alertData.message).toLowerCase();
  const error = /error|failed|विफल|गलत|समस्या|त्रुटि/.test(words);
  const success = /success|successful|सफल|saved|हो गया|भेज दिया|अपलोड/.test(
    words,
  );
  const danger = /delete|remove|logout|log out|डिलीट|हटाएं|हटाएँ|मिटाएं/.test(
    words,
  );
  const accent = error
    ? "#F06B83"
    : success
      ? "#0095F6"
      : danger
        ? "#F06B83"
        : "#0095F6";
  const icon = error
    ? "alert-circle"
    : success
      ? "checkmark-circle"
      : danger
        ? "warning"
        : "information-circle";
  const close = () => setAlertData(null);

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (alertData.options.cancelable !== false) close();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.82)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: "#121212",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#262626",
            padding: 18,
            alignItems: "center",
            elevation: 18,
            shadowColor: "#000000",
            shadowOpacity: 0.28,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: accent + "18",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name={icon} size={29} color={accent} />
          </View>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {alertData.title}
          </Text>
          {!!alertData.message && (
            <Text
              style={{
                color: "#A8A8A8",
                fontSize: 14,
                lineHeight: 20,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              {alertData.message}
            </Text>
          )}
          <View
            style={{
              width: "100%",
              flexDirection: alertData.buttons.length > 1 ? "row" : "column",
              gap: 10,
              marginTop: alertData.message ? 0 : 10,
            }}
          >
            {alertData.buttons.map((button, index) => {
              const cancel = button.style === "cancel";
              const destructive = button.style === "destructive";
              const primary =
                !cancel &&
                (destructive || index === alertData.buttons.length - 1);
              return (
                <TouchableOpacity
                  key={`${button.text || "button"}-${index}`}
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    if (typeof button.onPress === "function")
                      Promise.resolve().then(() => button.onPress());
                  }}
                  style={{
                    flex: alertData.buttons.length > 1 ? 1 : undefined,
                    minHeight: 44,
                    borderWidth: cancel ? 1 : 0,
                    borderColor: "#363636",
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: primary
                      ? destructive
                        ? "#F06B83"
                        : accent
                      : "#1C1C1E",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: primary ? "#FFFFFF" : "#E5E5E5",
                      textAlign: "center",
                    }}
                  >
                    {button.text || "Close"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={{
              marginTop: 12,
              color: "#8E8E93",
              fontSize: 11,
              fontWeight: "600",
              letterSpacing: 0.5,
            }}
          >
            BHUMI SOCIAL AI
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function ChatVideoAttachment({ uri, token, mine }) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const player = useVideoPlayer({ uri, headers, useCaching: true }, (p) => {
    p.loop = false;
  });

  return (
    <View style={{
      width: 230,
      height: 190,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: "#000000",
      marginBottom: 6,
    }}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

function ChatAudioAttachment({ uri, token, mine, name }) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const player = useAudioPlayer({ uri, headers });
  const audioStatus = useAudioPlayerStatus(player);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        try {
          if (audioStatus.playing) player.pause();
          else player.play();
        } catch (error) {
          console.log("CHAT_AUDIO_PLAY_ERROR:", error?.message);
        }
      }}
      style={{
        width: 230,
        minHeight: 62,
        padding: 13,
        borderRadius: 14,
        marginBottom: 6,
        backgroundColor: mine ? "rgba(255,255,255,0.16)" : "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Ionicons
        name={audioStatus.playing ? "pause-circle" : "play-circle"}
        size={34}
        color={mine ? "#FFFFFF" : "#0095F6"}
      />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{
          color: mine ? "#FFFFFF" : "#262626",
          fontSize: 13,
          fontWeight: "700",
        }}>
          {name || "Voice message"}
        </Text>
        <Text style={{
          color: mine ? "#EAF5FF" : "#7A8490",
          fontSize: 11,
          marginTop: 3,
        }}>
          {audioStatus.playing ? "Playing · Tap to pause" : "Audio · Tap to play"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const VIDEO_FILTER_PREVIEW_STYLES = [
  null,
  { backgroundColor: "#E7A85B", opacity: 0.10 },
  { backgroundColor: "#344C78", opacity: 0.12 },
  { backgroundColor: "#D97838", opacity: 0.14 },
  { backgroundColor: "#3D80B2", opacity: 0.12 },
  { backgroundColor: "#B58A5A", opacity: 0.13 },
  { backgroundColor: "#777777", opacity: 0.24 },
  { backgroundColor: "#E7D7F0", opacity: 0.11 },
  { backgroundColor: "#E8B94F", opacity: 0.15 },
  { backgroundColor: "#E8DCCB", opacity: 0.16 },
];

export default function App() {
  // BHUMI_CRASH_DISPLAY
  React.useEffect(() => {
    let active = true;
    SecureStore.getItemAsync("bhumi_last_crash_report")
      .then(async (report) => {
        if (!report || !active) return;
        await SecureStore.deleteItemAsync("bhumi_last_crash_report");
        if (active) {
          Alert.alert("पिछली बार ऐप क्यों बंद हुआ", report);
        }
      })
      .catch((error) => console.error("Crash report read failed:", error));

    return () => {
      active = false;
    };
  }, []);

  const [activeTab, setActiveTab] = React.useState("Home");
  const [appPinLocked, setAppPinLocked] = React.useState(false);
  const [appBiometricEnabled, setAppBiometricEnabled] = React.useState(false);
  const [appPinInput, setAppPinInput] = React.useState("");
  const [appPinError, setAppPinError] = React.useState("");
  const appLockPinRef = React.useRef(null);

  React.useEffect(() => {
    let alive = true;
    const refreshLock = async (onLaunch = false) => {
      try {
        const [pin, autoLock, fingerprint, faceUnlock] = await Promise.all([
          SecureStore.getItemAsync("bhumi_app_lock_pin"),
          SecureStore.getItemAsync("bhumi_app_auto_lock"),
          SecureStore.getItemAsync("bhumi_app_biometric_fingerprint"),
          SecureStore.getItemAsync("bhumi_app_biometric_face"),
        ]);
        if (!alive) return;
        appLockPinRef.current = pin || null;
        setAppBiometricEnabled(fingerprint === "true" || faceUnlock === "true");
        if (pin && (onLaunch || autoLock !== "false")) setAppPinLocked(true);
      } catch (error) {
        console.warn("App Lock could not read secure PIN:", error?.message || error);
      }
    };
    void refreshLock(true);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "inactive" || nextState === "background") void refreshLock(false);
    });
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);

  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraFacing, setCameraFacing] = React.useState("back");
  const [cameraMode, setCameraMode] = React.useState("video");
  const [cameraTargetKind, setCameraTargetKind] = React.useState("reels");
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordedVideo, setRecordedVideo] = React.useState(null);
  const [recordedPhoto, setRecordedPhoto] = React.useState(null);
  const [recordedPhotoAsset, setRecordedPhotoAsset] = React.useState(null);
  const [postCameraFilterIndex, setPostCameraFilterIndex] = React.useState(0);
  const cameraRef = React.useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [liveCameraOpen, setLiveCameraOpen] = React.useState(false);
  const [liveTitle, setLiveTitle] = React.useState("");
  const [liveLink, setLiveLink] = React.useState("");
  const [liveAudience, setLiveAudience] = React.useState("Public");
  const liveCameraRef = React.useRef(null);

  const [updateInfo, setUpdateInfo] = React.useState(null);
  const [updatePromptVisible, setUpdatePromptVisible] = React.useState(false);
  const [updateDownloading, setUpdateDownloading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let checking = false;

    const checkForAppUpdate = async () => {
      if (checking || !Updates.isEnabled) return;
      checking = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (active && result.isAvailable) {
          setUpdateInfo({ message: "A new Bhumi Social AI update is ready. Update safely inside the app." });
          setUpdatePromptVisible(true);
        }
      } catch (error) {
        console.warn("In-app update check failed:", error?.message || error);
      } finally {
        checking = false;
      }
    };

    // Let the first screen and API requests settle before checking for an OTA update.
    // This keeps update traffic from competing with the initial app launch.
    const firstCheck = setTimeout(checkForAppUpdate, 10000);
    const interval = setInterval(checkForAppUpdate, 6 * 60 * 60 * 1000);
    return () => {
      active = false;
      clearTimeout(firstCheck);
      clearInterval(interval);
    };
  }, []);

  const downloadAndInstallUpdate = async () => {
    if (updateDownloading) return;
    setUpdateDownloading(true);
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        setUpdatePromptVisible(false);
        await Updates.reloadAsync();
      } else {
        setUpdatePromptVisible(false);
        Alert.alert("Bhumi Social AI", "आपका ऐप पहले से अपडेट है।");
      }
    } catch (error) {
      Alert.alert(
        "Update",
        "अभी अपडेट डाउनलोड नहीं हो पाया। इंटरनेट कनेक्शन जाँचकर दोबारा कोशिश करें।",
      );
    } finally {
      setUpdateDownloading(false);
    }
  };

  const [feedPosts, setFeedPosts] = React.useState([]);
  const [appSettingsPreferences, setAppSettingsPreferences] = React.useState({});
  React.useEffect(() => {
    let active = true;
    if (!authSession?.token) {
      setAppSettingsPreferences({});
      return () => { active = false; };
    }
    loadSettingsPreferences()
      .then((preferences) => {
        if (active) setAppSettingsPreferences(preferences || {});
      })
      .catch((error) => console.warn("App settings load failed:", error?.message || error));
    return () => { active = false; };
  }, [authSession?.username, authSession?.token]);
  const [feedViewportHeight, setFeedViewportHeight] = React.useState(0);
  const [feedHeaderHeight, setFeedHeaderHeight] = React.useState(0);
  const [activeFeedIndex, setActiveFeedIndex] = React.useState(0);
  const [serverStories, setServerStories] = React.useState([]);
  const [selectedStory, setSelectedStory] = React.useState(null);
  const [storyQueue, setStoryQueue] = React.useState([]);
  const [storyIndex, setStoryIndex] = React.useState(0);
  const [storyImageZoomed, setStoryImageZoomed] = React.useState(false);
  const [storyPaused, setStoryPaused] = React.useState(false);
  const storyLongPressRef = React.useRef(false);
  const [storyProgress, setStoryProgress] = React.useState(0);
  const [selectedPost, setSelectedPost] = React.useState(null);
  const [selectedPostMediaIndex, setSelectedPostMediaIndex] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    const openSharedUrl = async (url) => {
      const value = String(url || "");
      const postMatch = value.match(/^bhumisocial:\/\/post\/(\d+)/i);
      const profileMatch = value.match(/^bhumisocial:\/\/profile\/([^/?#]+)/i);

      if (profileMatch) {
        try {
          const username = decodeURIComponent(profileMatch[1]);
          if (active && username) await openUserProfile(username);
        } catch (error) {
          if (active) Alert.alert("Profile unavailable", error?.message || "Could not open this profile.");
        }
        return;
      }

      if (!postMatch) return;
      try {
        const post = await loadPostById(postMatch[1]);
        if (!active || !post) return;
        setSelectedPost(post);
        setSelectedPostMediaIndex(0);
      } catch (error) {
        if (active) {
          Alert.alert(
            "Post unavailable",
            error?.message || "Could not open this shared post.",
          );
        }
      }
    };

    Linking.getInitialURL()
      .then(openSharedUrl)
      .catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => {
      openSharedUrl(url);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  const [profileImageErrors, setProfileImageErrors] = React.useState({});
  const [reels, setReels] = React.useState([]);
  const reelListRef = React.useRef(null);
  const [activeReelIndex, setActiveReelIndex] = React.useState(0);
  const [headerCreateMenuOpen, setHeaderCreateMenuOpen] = React.useState(false);
  const [reelZoomed, setReelZoomed] = React.useState(false);
  const [manualReelPlay, setManualReelPlay] = React.useState(false);

  React.useEffect(() => {
    setReelZoomed(false);
    setManualReelPlay(false);
  }, [activeTab]);

  React.useEffect(() => {
    setManualReelPlay(false);
  }, [activeReelIndex]);

  React.useEffect(() => {
    if (appSettingsPreferences["feed.reelsAutoPlay"] === false) {
      setManualReelPlay(false);
    }
  }, [appSettingsPreferences["feed.reelsAutoPlay"]]);
  const [reelViewportHeight, setReelViewportHeight] = React.useState(0);
  const [pendingSavedReelIndex, setPendingSavedReelIndex] = React.useState(null);

  React.useEffect(() => {
    if (
      activeTab !== "Reels" ||
      pendingSavedReelIndex === null ||
      reelViewportHeight <= 0 ||
      !reelListRef.current
    ) return;

    try {
      reelListRef.current.scrollToOffset({
        offset: reelViewportHeight * pendingSavedReelIndex,
        animated: false,
      });
      setActiveReelIndex(pendingSavedReelIndex);
      setPendingSavedReelIndex(null);
    } catch (error) {
      console.warn("Saved Reel navigation failed:", error);
    }
  }, [activeTab, pendingSavedReelIndex, reelViewportHeight, reels.length]);
  const [mutedReels, setMutedReels] = React.useState(true);
  const [reelLikeState, setReelLikeState] = React.useState({});
  const [reelSavedState, setReelSavedState] = React.useState({});
  const [reelBusyState, setReelBusyState] = React.useState({});
  const [reelCommentsOpen, setReelCommentsOpen] = React.useState(false);
  const [selectedReel, setSelectedReel] = React.useState(null);
  const [reelComments, setReelComments] = React.useState([]);
  const [reelCommentDraft, setReelCommentDraft] = React.useState("");
  const [reelCommentsBusy, setReelCommentsBusy] = React.useState(false);
  const [savedContent, setSavedContent] = React.useState([]);
  const [savedContentBusy, setSavedContentBusy] = React.useState(false);
  const [savedScreenOpen, setSavedScreenOpen] = React.useState(false);
  const [reelFollowState, setReelFollowState] = React.useState({});

  const [serverOnline, setServerOnline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [mediaDraft, setMediaDraft] = React.useState(null);
  const [mediaDraftIndex, setMediaDraftIndex] = React.useState(0);
  const [mediaDraftCaption, setMediaDraftCaption] = React.useState("");
  const [mentionSuggestions, setMentionSuggestions] = React.useState([]);
  const [mentionToken, setMentionToken] = React.useState("");
  const [zoomEffectEnabled, setZoomEffectEnabled] = React.useState(false);
  const [zoomEffectLevel, setZoomEffectLevel] = React.useState(1.5);
  const [zoomEffectDuration, setZoomEffectDuration] = React.useState(3);
  const [musicAsset, setMusicAsset] = React.useState(null);
  const [musicSearchOpen, setMusicSearchOpen] = React.useState(false);
  const [musicSearchQuery, setMusicSearchQuery] = React.useState("");
  const [musicSearchLoading, setMusicSearchLoading] = React.useState(false);
  const [musicVolume, setMusicVolume] = React.useState(0.8);
  const [musicStart, setMusicStart] = React.useState(0);
  const [keepOriginalAudio, setKeepOriginalAudio] = React.useState(true);
  const [videoFilterIndex, setVideoFilterIndex] = React.useState(0);
  const [voiceEffect, setVoiceEffect] = React.useState("Original");
  const chatVoiceRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const musicPlayer = useAudioPlayer(null);
  const musicPlayerStatus = useAudioPlayerStatus(musicPlayer);
  const [musicLibrary, setMusicLibrary] = React.useState([]);
  const [musicLibraryLoaded, setMusicLibraryLoaded] = React.useState(false);
  const [musicLibraryFilter, setMusicLibraryFilter] = React.useState("all");
  const [musicPlayingId, setMusicPlayingId] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    loadMusicLibrary().then((tracks) => { if (active) setMusicLibrary(tracks); })
      .catch((error) => console.warn("Music library load failed:", error?.message || error))
      .finally(() => { if (active) setMusicLibraryLoaded(true); });
    return () => { active = false; };
  }, []);

  // SOCIALAPP_AUTH_SCREEN_V1
  // SOCIALAPP_FIRST_WELCOME_V1
  const [welcomeChecked, setWelcomeChecked] = React.useState(false);
  const [welcomeSeen, setWelcomeSeen] = React.useState(false);

  React.useEffect(() => {
    SecureStore.getItemAsync("socialapp_welcome_seen")
      .then((value) => setWelcomeSeen(value === "true"))
      .catch(() => setWelcomeSeen(true))
      .finally(() => setWelcomeChecked(true));
  }, []);

  const finishWelcome = async (mode) => {
    setWelcomeSeen(true);
    setAuthMode(mode);
    try {
      await SecureStore.setItemAsync("socialapp_welcome_seen", "true");
    } catch (error) {
      console.warn("Could not save welcome screen preference.");
    }
  };

  const [authReady, setAuthReady] = React.useState(false);
  const [authSession, setAuthSession] = React.useState(null);
  React.useEffect(() => {
    if (authReady && authSession && appLockPinRef.current) {
      setAppPinLocked(true);
      setAppPinInput("");
      setAppPinError("");
    } else if (authReady && !authSession) {
      setAppPinLocked(false);
      setAppPinInput("");
      setAppPinError("");
    }
  }, [authSession, authReady]);

  // Register this signed-in device for high-priority incoming-call push alerts.
  // The existing in-app call listener still handles the full LiveKit call UI.
  React.useEffect(() => {
    let active = true;
    const username = authSession?.username;
    if (!authSession?.token || !username) return undefined;

    (async () => {
      try {
        if (Platform.OS === "android") {
          await ensureCallKeepSetup().catch((setupError) => {
            console.warn("Incoming call UI setup failed:", setupError?.message || setupError);
          });
          await Notifications.setNotificationChannelAsync("incoming-calls", {
            name: "Incoming calls",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 450, 250, 450, 250, 700],
            sound: "default",
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: false,
          });
          await Notifications.setNotificationChannelAsync("messages", {
            name: "Direct messages",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 150, 250],
            sound: "default",
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          });
          await Notifications.setNotificationChannelAsync("messages-silent", {
            name: "Direct messages (silent)",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [],
            sound: null,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          });
          await Notifications.setNotificationChannelAsync("social-activity", {
            name: "Social activity",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 180],
            sound: "default",
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          });
          await Notifications.setNotificationChannelAsync("social-activity-silent", {
            name: "Social activity (silent)",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [],
            sound: null,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          });
        }
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
        if (!active || !permission.granted) return;

        const projectId = appConfig?.expo?.extra?.eas?.projectId;
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        if (!active || !tokenResult?.data) return;
        await registerCallPushToken(tokenResult.data);
      } catch (error) {
        console.warn("Incoming call push setup failed:", error?.message || error);
      }
    })();

    return () => { active = false; };
  }, [authSession?.token, authSession?.username]);
  const [authMode, setAuthMode] = React.useState("login");
  const [authAccountType, setAuthAccountType] = React.useState("personal");
  const [authUsername, setAuthUsername] = React.useState("");
  const [authFullName, setAuthFullName] = React.useState("");
  const [authEmail, setAuthEmail] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authPhoneNumber, setAuthPhoneNumber] = React.useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = React.useState("");
  const [authBusy, setAuthBusy] = React.useState(false);
  const [forgotStep, setForgotStep] = React.useState("email");
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotOtp, setForgotOtp] = React.useState("");
  const [forgotResetToken, setForgotResetToken] = React.useState("");
  const [forgotNewPassword, setForgotNewPassword] = React.useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    // Wake the Render API while secure session restore continues in parallel.
    void warmUpServer();

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
            console.warn(
              "Session retained because verification did not return 401.",
            );
          }
        } catch (error) {
          console.warn(
            "Session retained after a temporary verification failure:",
            error?.message || error,
          );
        }
      } catch (error) {
        console.error(
          "Could not restore saved auth session:",
          error?.message || error,
        );
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
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState("");
  const [searchFollowBusy, setSearchFollowBusy] = React.useState({});

  const [profile, setProfile] = React.useState(null);
  const [followRequests, setFollowRequests] = React.useState([]);
  const [followRequestsBusy, setFollowRequestsBusy] = React.useState(false);
  const [followRequestAction, setFollowRequestAction] = React.useState({});

  const [profileEditing, setProfileEditing] = React.useState(false);
  const [profileDraft, setProfileDraft] = React.useState({
    displayName: "",
    bio: "",
  });
  const [profileBusy, setProfileBusy] = React.useState(false);
  const [viewedProfileOpen, setViewedProfileOpen] = React.useState(false);
  const [viewedProfile, setViewedProfile] = React.useState(null);
  const [viewedProfileBusy, setViewedProfileBusy] = React.useState(false);
  const [viewedProfilePosts, setViewedProfilePosts] = React.useState([]);
  const [viewedProfilePostsBusy, setViewedProfilePostsBusy] = React.useState(false);
  const [viewedProfileTab, setViewedProfileTab] = React.useState("posts");
  const [viewedProfileMenuOpen, setViewedProfileMenuOpen] = React.useState(false);
  const [viewedProfileFollowBusy, setViewedProfileFollowBusy] = React.useState(false);
  const [viewedProfileBlockBusy, setViewedProfileBlockBusy] = React.useState(false);
  const [profileConnectionsOpen, setProfileConnectionsOpen] = React.useState(false);
  const [profileConnectionsType, setProfileConnectionsType] = React.useState("followers");
  const [profileConnectionsUsername, setProfileConnectionsUsername] = React.useState("");
  const [profileConnectionsItems, setProfileConnectionsItems] = React.useState([]);
  const [profileConnectionsBusy, setProfileConnectionsBusy] = React.useState(false);
  const [profileConnectionsError, setProfileConnectionsError] = React.useState("");

  // SOCIALAPP_DIRECT_MESSAGES_V1
  const [messagesOpen, setMessagesOpen] = React.useState(false);
  const [messageConversations, setMessageConversations] = React.useState([]);
  const [selectedChatUser, setSelectedChatUser] = React.useState("");
  const [chatImagePreviewUri, setChatImagePreviewUri] = React.useState(null);
  const [chatPersonalizationOpen, setChatPersonalizationOpen] = React.useState(false);
  const [chatPreferences, setChatPreferences] = React.useState({ name: "", theme: "royal", favorite: false, closeFriend: false });
  const [chatFriendPrefs, setChatFriendPrefs] = React.useState({});
  const sortChatConversations = (items, prefs = chatFriendPrefs) => [...(items || [])].sort((a, b) => {
    const userA = String(a.username || a.peer || a.otherUsername || "").toLowerCase();
    const userB = String(b.username || b.peer || b.otherUsername || "").toLowerCase();
    const scoreA = (prefs["messages.favorite." + userA] ? 2 : 0) + (prefs["messages.closeFriend." + userA] ? 1 : 0);
    const scoreB = (prefs["messages.favorite." + userB] ? 2 : 0) + (prefs["messages.closeFriend." + userB] ? 1 : 0);
    return scoreB - scoreA;
  });
  const chatThemeColors = ({
    royal: { bg: "#000000", mine: "#3797F0", other: "#262626", accent: "#FFFFFF" },
    midnight: { bg: "#080B12", mine: "#253044", other: "#151B27", accent: "#8FA8D8" },
    ocean: { bg: "#071521", mine: "#12415A", other: "#102A3A", accent: "#61C5E8" },
    rose: { bg: "#1B0B16", mine: "#63304A", other: "#321A29", accent: "#F0A0C0" },
    emerald: { bg: "#071710", mine: "#1D513A", other: "#153324", accent: "#7AD6A4" },
    sunset: { bg: "#1C100A", mine: "#75402B", other: "#382319", accent: "#FFB078" },
    sapphire: { bg: "#07122B", mine: "#173B78", other: "#10264D", accent: "#75A7FF" },
    ruby: { bg: "#250914", mine: "#7D1F42", other: "#4A142B", accent: "#FF719D" },
    amethyst: { bg: "#170D2C", mine: "#54358B", other: "#30204D", accent: "#C6A1FF" },
    silver: { bg: "#171A22", mine: "#414958", other: "#292F3B", accent: "#D7E0EE" },
    pearl: { bg: "#29252A", mine: "#665B61", other: "#413A40", accent: "#FFE4C7" },
    lavender: { bg: "#1B1230", mine: "#59427D", other: "#34254D", accent: "#D7B8FF" },
    cotton: { bg: "#24102C", mine: "#7D3D76", other: "#4B2850", accent: "#FFA9E7" },
    coral: { bg: "#21100D", mine: "#874536", other: "#4D2A23", accent: "#FFAA91" },
    mint: { bg: "#071E1A", mine: "#1E6655", other: "#164437", accent: "#8CE6C5" },
    forest: { bg: "#07170E", mine: "#205234", other: "#153A25", accent: "#8BD69A" },
    sakura: { bg: "#260F20", mine: "#77365F", other: "#4A2540", accent: "#FFB8DB" },
    cherry: { bg: "#250A12", mine: "#8E1D3D", other: "#53152A", accent: "#FF7898" },
    lavaglow: { bg: "#210B07", mine: "#8E321A", other: "#542113", accent: "#FF9B5D" },
    arctic: { bg: "#081B29", mine: "#24536D", other: "#17394D", accent: "#8EE5FF" },
    galaxy: { bg: "#100A28", mine: "#45317F", other: "#291D50", accent: "#B9A3FF" },
    cosmic: { bg: "#180A2B", mine: "#6A2685", other: "#401C56", accent: "#E2A4FF" },
    aurora: { bg: "#071C22", mine: "#17636A", other: "#12434C", accent: "#80F0DE" },
    desert: { bg: "#21170D", mine: "#75502B", other: "#49351F", accent: "#EBC58B" },
    saffron: { bg: "#251505", mine: "#8B5416", other: "#54350F", accent: "#FFD078" },
    lotus: { bg: "#200F20", mine: "#75406D", other: "#482B46", accent: "#F5B8E8" },
    diya: { bg: "#241004", mine: "#9B4D12", other: "#5A2D0B", accent: "#FFC46B" },
    vrindavan: { bg: "#17102A", mine: "#563C85", other: "#342650", accent: "#D6B7FF" },
    shiva: { bg: "#081B2D", mine: "#245C83", other: "#173B56", accent: "#91D8FF" },
    ganesha: { bg: "#24140A", mine: "#8B4E1D", other: "#553315", accent: "#FFD18A" },
    hanuman: { bg: "#260D06", mine: "#9A3218", other: "#5B2111", accent: "#FF9A62" },
    krishna: { bg: "#071E24", mine: "#14616A", other: "#10444C", accent: "#83E9D8" },
    ram: { bg: "#201405", mine: "#85601A", other: "#4F3A12", accent: "#FFDA85" },
    islamic: { bg: "#08182A", mine: "#1B416B", other: "#122D4C", accent: "#A9D4FF" },
    christian: { bg: "#17152A", mine: "#49477A", other: "#2F3057", accent: "#E5D7FF" },
    buddha: { bg: "#10201C", mine: "#416B55", other: "#2A493A", accent: "#B8E6C5" },
    jain: { bg: "#1E1A0D", mine: "#75652D", other: "#4A411F", accent: "#E7D99B" },
    rainbow: { bg: "#1D1026", mine: "#754C8C", other: "#4A315B", accent: "#F4B8FF" },
    neon: { bg: "#080F1E", mine: "#124C65", other: "#0D3046", accent: "#5CF0FF" },
    cyber: { bg: "#16091D", mine: "#67245F", other: "#3E1940", accent: "#FF83D8" },
    comic: { bg: "#21100B", mine: "#8A3C20", other: "#512819", accent: "#FFB47E" },
    cartoon: { bg: "#1A1030", mine: "#6447A0", other: "#3B2B62", accent: "#FFE27A" },
    anime: { bg: "#0B1830", mine: "#285B94", other: "#1B3C64", accent: "#A8D7FF" },
    unicorn: { bg: "#21112D", mine: "#754B91", other: "#4C315F", accent: "#F8C6FF" },
    teddy: { bg: "#25170F", mine: "#77523A", other: "#4B3829", accent: "#E7BE91" },
    oceanwave: { bg: "#061C2A", mine: "#17617B", other: "#104255", accent: "#7EDCFF" },
    monsoon: { bg: "#101A2B", mine: "#354C70", other: "#253650", accent: "#A9C8F5" },
    autumn: { bg: "#211006", mine: "#81451C", other: "#4D2C16", accent: "#F5B16B" },
    winter: { bg: "#101D2A", mine: "#45647C", other: "#2B4559", accent: "#C7E8FF" },
    coffee: { bg: "#1B120D", mine: "#65432E", other: "#3E2C20", accent: "#D9B18A" },
    marble: { bg: "#17171C", mine: "#55515A", other: "#34323A", accent: "#E5D9C9" },
    velvet: { bg: "#100C14", mine: "#45304D", other: "#2B2032", accent: "#D6A7E8" },
    floral: { bg: "#102016", mine: "#3E704B", other: "#284B33", accent: "#B3E6A8" },
    candy: { bg: "#241029", mine: "#7A3D83", other: "#4B2B55", accent: "#FFA8EA" },
    sports: { bg: "#101820", mine: "#34566D", other: "#223D50", accent: "#A5E1FF" },
    minimal: { bg: "#12151A", mine: "#3A424D", other: "#252C35", accent: "#D1D8E0" },
  })[chatPreferences.theme] || { bg: "#000000", mine: "#262626", other: "#1C1C1E", accent: "#0095F6" };
  const [directMessages, setDirectMessages] = React.useState([]);
  const [newChatUsername, setNewChatUsername] = React.useState("");
  const [chatDraft, setChatDraft] = React.useState("");
  const [chatMediaDraft, setChatMediaDraft] = React.useState(null);
  const [isChatRecording, setIsChatRecording] = React.useState(false);
  const [chatEmojiOpen, setChatEmojiOpen] = React.useState(false);
  const [chatReplyTo, setChatReplyTo] = React.useState(null);
  const [chatUnsendTarget, setChatUnsendTarget] = React.useState(null);
  const [chatPeerTyping, setChatPeerTyping] = React.useState(false);
  const [chatPresence, setChatPresence] = React.useState(null);

  React.useEffect(() => {
    if (!authSession?.username) return undefined;
    const heartbeat = () => sendPresenceHeartbeat().catch(() => {});
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    return () => clearInterval(timer);
  }, [authSession?.username]);

  React.useEffect(() => {
    if (!selectedChatUser || !authSession?.username) {
      setChatPresence(null);
      return undefined;
    }
    let active = true;
    const refresh = () => getChatPresence(selectedChatUser)
      .then((presence) => { if (active) setChatPresence(presence); })
      .catch(() => { if (active) setChatPresence(null); });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedChatUser, authSession?.username]);
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatError, setChatError] = React.useState("");
  const [chatSearchQuery, setChatSearchQuery] = React.useState("");
  const [chatUnreadOnly, setChatUnreadOnly] = React.useState(false);
  const [chatInboxTab, setChatInboxTab] = React.useState("All");
  const [chatFolderSaving, setChatFolderSaving] = React.useState("");

  const [chatFriendFilter, setChatFriendFilter] = React.useState("All");
  const [newChatComposerOpen, setNewChatComposerOpen] = React.useState(false);
  const [ownNote, setOwnNote] = React.useState(null);
  const [friendsNotes, setFriendsNotes] = React.useState([]);
  const [noteComposerOpen, setNoteComposerOpen] = React.useState(false);
  const [noteViewer, setNoteViewer] = React.useState(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [noteBusy, setNoteBusy] = React.useState(false);
  const [noteError, setNoteError] = React.useState("");

  const directMessagesScrollRef = React.useRef(null);

  const [chatPeopleResults, setChatPeopleResults] = React.useState([]);
  const [chatPeopleBusy, setChatPeopleBusy] = React.useState(false);
  const [chatPeopleError, setChatPeopleError] = React.useState("");

  React.useEffect(() => {
    if (!messagesOpen || !selectedChatUser) {
      setChatPeerTyping(false);
      return undefined;
    }
    let active = true;
    const checkTyping = async () => {
      try {
        const typing = await loadChatTyping(selectedChatUser);
        if (active) setChatPeerTyping(typing);
      } catch (_) {
        if (active) setChatPeerTyping(false);
      }
    };
    checkTyping();
    const timer = setInterval(checkTyping, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [messagesOpen, selectedChatUser]);

  React.useEffect(() => {
    const term = newChatUsername.trim();
    if (
      !messagesOpen ||
      selectedChatUser ||
      !newChatComposerOpen ||
      term.length < 2
    ) {
      setChatPeopleResults([]);
      setChatPeopleBusy(false);
      setChatPeopleError("");
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setChatPeopleBusy(true);
      setChatPeopleError("");
      try {
        const results = await searchUsers(term);
        if (active) setChatPeopleResults(results);
      } catch (error) {
        if (active) {
          setChatPeopleResults([]);
          setChatPeopleError(error?.message || "People search failed.");
        }
      } finally {
        if (active) setChatPeopleBusy(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [newChatUsername, messagesOpen, selectedChatUser, newChatComposerOpen]);

  const closeMessages = () => {
    if (selectedChatUser)
      updateChatTyping(selectedChatUser, false).catch(() => {});
    setChatPeerTyping(false);
    setChatReplyTo(null);
    setMessagesOpen(false);
    setNewChatComposerOpen(false);
    setNewChatUsername("");
    setChatPeopleResults([]);
    setChatPeopleBusy(false);
    setChatPeopleError("");
    setChatEmojiOpen(false);
  };

  const refreshUserNotes = async () => {
    try {
      const data = await loadUserNotes();
      setOwnNote(data.ownNote || null);
      setFriendsNotes(
        Array.isArray(data.friendsNotes) ? data.friendsNotes : [],
      );
    } catch (error) {
      setNoteError(error?.message || "Could not load notes.");
    }
  };

  const submitUserNote = async () => {
    const text = noteDraft.trim();
    if (!text || noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      await saveUserNote(text);
      setNoteDraft("");
      setNoteComposerOpen(false);
      await refreshUserNotes();
    } catch (error) {
      setNoteError(error?.message || "Could not save note.");
    } finally {
      setNoteBusy(false);
    }
  };

  const removeUserNote = async () => {
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError("");
    try {
      await deleteUserNote();
      setOwnNote(null);
      setNoteDraft("");
      setNoteComposerOpen(false);
    } catch (error) {
      setNoteError(error?.message || "Could not delete note.");
    } finally {
      setNoteBusy(false);
    }
  };

  const openMessages = async () => {
    setMessagesOpen(true);
    setSelectedChatUser("");
    setChatSearchQuery("");
    setNewChatUsername("");
    setNewChatComposerOpen(false);
    setChatPeopleResults([]);
    setChatPeopleError("");
    setChatDraft("");
    setChatMediaDraft(null);
    setChatEmojiOpen(false);
    setChatError("");
    setChatBusy(true);
    try {
      const [conversations, preferences] = await Promise.all([
        loadMessageConversations(),
        loadSettingsPreferences(),
        refreshUserNotes(),
      ]).then((values) => [values[0], values[1]]);
      setChatFriendPrefs(preferences || {});
      setMessageConversations(sortChatConversations(conversations, preferences || {}));
    } catch (error) {
      setChatError(error?.message || "Could not load conversations.");
    } finally {
      setChatBusy(false);
    }
  };

  const openDirectChat = async (username) => {
    const target = String(username || "").trim();
    if (!target) {
      setChatError("Enter a username to start a chat.");
      return;
    }
    setSelectedChatUser(target);
    setNewChatUsername(target);
    setDirectMessages([]);
    setChatDraft("");
    setChatMediaDraft(null);
    setChatEmojiOpen(false);
    setChatReplyTo(null);
    setChatPeerTyping(false);
    setChatError("");
    setChatBusy(true);
    try {
      const [messages, conversations, preferences] = await Promise.all([
        loadDirectMessages(target),
        loadMessageConversations(),
        loadSettingsPreferences(),
      ]);
      setDirectMessages(messages);
      setChatFriendPrefs(preferences || {});
      setChatPreferences({
        name: String((preferences || {})["messages.chatName." + target.toLowerCase()] || ""),
        theme: String((preferences || {})["messages.chatTheme." + target.toLowerCase()] || "royal"),
        favorite: !!(preferences || {})["messages.favorite." + target.toLowerCase()],
        closeFriend: !!(preferences || {})["messages.closeFriend." + target.toLowerCase()],
      });
      setMessageConversations(sortChatConversations(conversations, preferences || {}));
    } catch (error) {
      setChatError(error?.message || "Could not load messages.");
    } finally {
      setChatBusy(false);
    }
  };

  // SOCIALAPP_CHAT_MEDIA_CONTROLS_V1
  const chooseChatMedia = async (useCamera = false) => {
  setChatError("");
  try {
    const options = {
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      quality: 0.85,
      videoMaxDuration: 180,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ ...options, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]) {
      setChatMediaDraft(result.assets[0]);
    }
  } catch (error) {
    setChatError(error?.message || "Media selection failed. Please try again.");
  }
};

  const handleChatDraftChange = (value) => {
    setChatDraft(value);
    if (selectedChatUser) {
      updateChatTyping(selectedChatUser, !!String(value || "").trim()).catch(
        () => {},
      );
    }
  };

  const chooseChatDocument = async () => {
    setChatError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setChatMediaDraft(result.assets[0]);
      }
    } catch (error) {
      setChatError(error?.message || "Could not select document.");
    }
  };

  const startChatVoiceRecording = async () => {
    if (isChatRecording || chatBusy) return;
    setChatError("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Voice message रिकॉर्ड करने के लिए Microphone permission दें।");
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await chatVoiceRecorder.prepareToRecordAsync();
      chatVoiceRecorder.record();
      setIsChatRecording(true);
    } catch (error) {
      setChatError(error?.message || "Voice recording शुरू नहीं हो सकी।");
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  const stopChatVoiceRecording = async () => {
    if (!isChatRecording) return;
    setChatError("");
    try {
      await chatVoiceRecorder.stop();
      const uri = chatVoiceRecorder.uri;
      if (!uri) throw new Error("रिकॉर्ड की गई आवाज़ की फाइल नहीं मिली।");
      setChatMediaDraft({
        uri,
        name: "Voice message.m4a",
        mimeType: "audio/mp4",
        type: "audio/mp4",
      });
    } catch (error) {
      setChatError(error?.message || "Voice recording सेव नहीं हो सकी।");
    } finally {
      setIsChatRecording(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  const sendChatDraft = async () => {
  const text = chatDraft.trim();
  if ((!text && !chatMediaDraft) || !selectedChatUser || chatBusy) return;
  setChatBusy(true);
  setChatError("");
  try {
    const attachment = chatMediaDraft
      ? await uploadChatAttachment(chatMediaDraft)
      : null;
    const message = await sendDirectMessage(
      selectedChatUser, text, attachment, chatReplyTo?.id || null
    );
    setDirectMessages(previous => [...previous, message]);
    setChatDraft("");
    setChatMediaDraft(null);
    setChatEmojiOpen(false);
    setChatReplyTo(null);
    updateChatTyping(selectedChatUser, false).catch(() => {});
    loadMessageConversations().then(setMessageConversations).catch(() => {});
  } catch (error) {
    setChatError(error?.message || "Could not send message.");
  } finally {
    setChatBusy(false);
  }
};

  const handleUnsendChatMessage = async () => {
    const target = chatUnsendTarget;
    if (!target?.id || !selectedChatUser || chatBusy) return;

    setChatBusy(true);
    setChatError("");
    try {
      await unsendDirectMessage(selectedChatUser, target.id);
      setDirectMessages((previous) =>
        previous.filter((message) => String(message.id) !== String(target.id)),
      );
      setChatUnsendTarget(null);
      setChatReplyTo((previous) =>
        String(previous?.id) === String(target.id) ? null : previous,
      );
      setMessageConversations(await loadMessageConversations());
    } catch (error) {
      setChatError(error?.message || "Could not unsend message.");
    } finally {
      setChatBusy(false);
    }
  };

  // SEARCH_USERS_EFFECT_V1
  React.useEffect(() => {
    const term = searchQuery.trim();
    if (activeTab !== "Search" || term.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const results = await searchUsers(term);
        if (active) setSearchResults(results);
      } catch (error) {
        if (active) {
          setSearchResults([]);
          setSearchError(error?.message || "Search failed.");
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  const groupedStories = React.useMemo(() => {
    const groups = new Map();
    const currentUsername = String(
      profile?.username || profile?.user?.username || "",
    )
      .trim()
      .toLowerCase();

    serverStories.forEach((item, index) => {
      const username = String(
        item.user || item.name || `story${index + 1}`,
      ).trim();
      const normalizedUsername = username.toLowerCase();
      const own =
        !!item.own ||
        normalizedUsername === "you" ||
        (!!currentUsername && normalizedUsername === currentUsername);
      const key = own ? "__own__" : normalizedUsername;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: own ? "Your story" : username,
          own,
          items: [],
        });
      }

      const group = groups.get(key);
      group.items.push({ ...item, name: group.name, own });
    });

    return Array.from(groups.values());
  }, [serverStories, profile]);

  const openStoryGroup = (items) => {
    if (!items || items.length === 0) return;
    setStoryImageZoomed(false);
    setStoryPaused(false);
    setStoryProgress(0);
    setStoryQueue(items);
    setStoryIndex(0);
    setSelectedStory(items[0]);
  };

  const moveStory = React.useCallback(
    (direction) => {
      setStoryImageZoomed(false);
      setStoryPaused(false);
      const nextIndex = storyIndex + direction;

      if (nextIndex < 0) return;

      if (nextIndex >= storyQueue.length) {
        setSelectedStory(null);
        setStoryQueue([]);
        setStoryIndex(0);
        setStoryProgress(0);
        return;
      }

      setStoryIndex(nextIndex);
      setSelectedStory(storyQueue[nextIndex]);
      setStoryProgress(0);
    },
    [storyIndex, storyQueue],
  );

  const storySwipeGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .onEnd((event) => {
          if (storyImageZoomed) return;
          if (event.translationY < -60) moveStory(1);
          else if (event.translationY > 60) moveStory(-1);
        })
        .runOnJS(true),
    [moveStory, storyImageZoomed],
  );

  React.useEffect(() => {
    if (!selectedStory) {
      setStoryProgress(0);
      return;
    }
    if (selectedStory.mediaType === "video") return;

    if (storyImageZoomed || storyPaused) return;

    const initialProgress = storyProgress;
    const startedAt = Date.now();
    const duration = 5000;
    const timer = setInterval(() => {
      const progress = Math.min(
        100,
        initialProgress + ((Date.now() - startedAt) / duration) * 100,
      );
      setStoryProgress(progress);

      if (progress >= 100) {
        clearInterval(timer);
        moveStory(1);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [selectedStory, storyIndex, storyImageZoomed, storyPaused, moveStory]);

  // SOCIALAPP_PRIVACY_SCREEN_V1
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [settingsHubOpen, setSettingsHubOpen] = React.useState(false);
  const [aboutAppOpen, setAboutAppOpen] = React.useState(false);
  const [blockedAccountsOpen, setBlockedAccountsOpen] = React.useState(false);
  const [blockedAccounts, setBlockedAccounts] = React.useState([]);
  const [blockedAccountsLoading, setBlockedAccountsLoading] =
    React.useState(false);
  const [blockedAccountsBusy, setBlockedAccountsBusy] = React.useState(false);
  const [restrictedAccountsOpen, setRestrictedAccountsOpen] =
    React.useState(false);
  const [restrictedAccounts, setRestrictedAccounts] = React.useState([]);
  const [restrictedAccountsLoading, setRestrictedAccountsLoading] =
    React.useState(false);
  const [restrictedAccountsBusy, setRestrictedAccountsBusy] =
    React.useState(false);
  const [viewedProfileRestricted, setViewedProfileRestricted] =
    React.useState(false);
  const [viewedProfileRestrictBusy, setViewedProfileRestrictBusy] =
    React.useState(false);
  const [privacyBusy, setPrivacyBusy] = React.useState(false);
  const [snapPrivacyOpen, setSnapPrivacyOpen] = React.useState(false);
  const [snapPrivacyBusy, setSnapPrivacyBusy] = React.useState(false);
  const [snapPrivacy, setSnapPrivacy] = React.useState({
    contactAudience: "friends",
    storyAudience: "followers",
    readReceipts: true,
    typingIndicator: true,
    storyReplies: true,
    disappearingMessages: "off",
    hideFromSuggestions: false,
  });
  const [businessProfileOpen, setBusinessProfileOpen] = React.useState(false);
  const [businessProfileBusy, setBusinessProfileBusy] = React.useState(false);
  const [businessInsights, setBusinessInsights] = React.useState({ contentCount: 0, followers: 0, likes: 0, comments: 0 });
  const [businessCatalog, setBusinessCatalog] = React.useState([]);
  const [businessQuickReplies, setBusinessQuickReplies] = React.useState([]);
  const [catalogDraft, setCatalogDraft] = React.useState({ itemType: "product", title: "", description: "", price: "", category: "" });
  const [quickReplyDraft, setQuickReplyDraft] = React.useState({ shortcut: "", message: "" });
  const [businessDirectoryOpen, setBusinessDirectoryOpen] = React.useState(false);
  const [businessDirectoryBusy, setBusinessDirectoryBusy] = React.useState(false);
  const [businessDirectoryFilters, setBusinessDirectoryFilters] = React.useState({ city: "", area: "", category: "", q: "" });
  const [businessDirectoryResults, setBusinessDirectoryResults] = React.useState([]);
  const [businessProfile, setBusinessProfile] = React.useState({
    businessName: "", category: "", description: "", phone: "", whatsapp: "",
    email: "", website: "", address: "", area: "", city: "", state: "",
    pincode: "", serviceAreas: "", serviceRadiusKm: 0, openingHours: "",
  });
  const [privacySettings, setPrivacySettings] = React.useState({
    isPrivate: false,
    accountType: "personal",
    showActivity: true,
    allowMessages: true,
  });
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [accountSettingsOpen, setAccountSettingsOpen] = React.useState(false);
  const [accountSettingsBusy, setAccountSettingsBusy] = React.useState(false);
  const [accountEmail, setAccountEmail] = React.useState("");
  const [accountPhone, setAccountPhone] = React.useState("");
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [notificationsBusy, setNotificationsBusy] = React.useState(false);
  const [notificationsListOpen, setNotificationsListOpen] =
    React.useState(false);
  const [notificationFilter, setNotificationFilter] = React.useState("All");
  const [notificationsList, setNotificationsList] = React.useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] =
    React.useState(0);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [notificationDetailsOpen, setNotificationDetailsOpen] =
    React.useState(false);
  const [notificationDetails, setNotificationDetails] = React.useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    requests: true,
    reels: true,
    system_alerts: true,
  });

  const openAccountSettings = async () => {
    setAccountSettingsBusy(true);
    try {
      const data = await loadAccountSettings();
      setAccountEmail(data.email || "");
      setAccountPhone(data.phone_number || "");
      setAccountSettingsOpen(true);
    } catch (e) {
      Alert.alert(
        "Account Settings",
        e.message || "Could not load account settings.",
      );
    } finally {
      setAccountSettingsBusy(false);
    }
  };

  const saveAccountSettingsChanges = async () => {
    setAccountSettingsBusy(true);
    try {
      await saveAccountSettings(accountEmail, accountPhone);
      setAccountSettingsOpen(false);
      Alert.alert("Success", "Account details saved.");
    } catch (e) {
      Alert.alert(
        "Save failed",
        e.message || "Could not save account details.",
      );
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
      Alert.alert(
        "Notifications",
        e.message || "Could not save notification preference.",
      );
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
      setNotificationDetails((current) => ({ ...current, ...details }));
      setNotificationDetailsOpen((value) => !value);
    } catch (e) {
      Alert.alert(
        "Notifications",
        e.message || "Could not load notification settings.",
      );
    } finally {
      setNotificationsBusy(false);
    }
  };

  React.useEffect(() => {
    let active = true;
    if (!authSession) {
      setUnreadNotificationCount(0);
      return () => {
        active = false;
      };
    }
    Promise.all([
      loadNotifications(),
      loadNotificationPreference(),
      loadNotificationDetails(),
    ])
      .then(([notifications, enabled, details]) => {
        if (!active) return;
        setUnreadNotificationCount(Number(notifications.unreadCount || 0));
        setNotificationsEnabled(Boolean(enabled));
        setNotificationDetails((current) => ({ ...current, ...details }));
      })
      .catch((error) =>
        console.warn(
          "Could not load notification settings:",
          error?.message || error,
        ),
      );
    return () => {
      active = false;
    };
  }, [authSession]);

  const handleReelLike = async (reel) => {
    const id = Number(reel?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || reelBusyState[id]) return;
    setReelBusyState((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await toggleReelLike(id);
      setReelLikeState((prev) => ({ ...prev, [id]: !!result.liked }));
      setReels((prev) =>
        prev.map((item) =>
          Number(item.id) === id
            ? {
                ...item,
                isLiked: !!result.liked,
                likesCount: Number(result.likes) || 0,
              }
            : item,
        ),
      );
    } catch (e) {
      Alert.alert("Reel Like", e.message || "Could not update like.");
    } finally {
      setReelBusyState((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleReelSave = async (reel) => {
    const id = Number(reel?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || reelBusyState[`save-${id}`])
      return;
    setReelBusyState((prev) => ({ ...prev, [`save-${id}`]: true }));
    try {
      const result = await toggleSavedContent("reels", id);
      setReelSavedState((prev) => ({ ...prev, [id]: !!result.saved }));
      setReels((prev) =>
        prev.map((item) =>
          Number(item.id) === id ? { ...item, isSaved: !!result.saved } : item,
        ),
      );
    } catch (e) {
      Alert.alert("Saved", e.message || "Could not update Saved.");
    } finally {
      setReelBusyState((prev) => ({ ...prev, [`save-${id}`]: false }));
    }
  };

  const handleReelFollow = async (reel) => {
    const username = String(reel?.user || reel?.username || "")
      .replace(/^@/, "")
      .trim();
    if (
      !username ||
      username === authSession?.username ||
      reelBusyState[`follow-${username}`]
    )
      return;
    setReelBusyState((prev) => ({ ...prev, [`follow-${username}`]: true }));
    try {
      const following = reelFollowState[username] ?? !!reel.isFollowing;
      const result = following
        ? await unfollowProfile(username)
        : await followProfile(username);
      const status =
        result?.status || (following ? "not_following" : "following");
      setReelFollowState((prev) => ({
        ...prev,
        [username]: status === "following",
      }));
      setReels((prev) =>
        prev.map((item) =>
          (item.user || item.username) === username
            ? {
                ...item,
                isFollowing: status === "following",
                followRequestStatus: status === "requested" ? "pending" : "",
              }
            : item,
        ),
      );
    } catch (e) {
      Alert.alert("Follow", e.message || "Could not update follow.");
    } finally {
      setReelBusyState((prev) => ({ ...prev, [`follow-${username}`]: false }));
    }
  };

  const handleReelShare = async (reel) => {
    try {
      await Share.share({
        message: `${reel.caption || "Watch this reel"}\n${reel.uri || ""}`,
      });
    } catch (e) {
      Alert.alert("Share", e.message || "Could not share this reel.");
    }
  };

  const handleReelDownload = async (reel) => {
    if (!reel?.uri) return;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "video",
      ]);
      if (!permission.granted) {
        Alert.alert(
          "Gallery permission",
          "Allow video access to save this reel to your Gallery.",
        );
        return;
      }
      const safeId = String(reel.id || Date.now()).replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );
      const localPath = `${FileSystem.cacheDirectory}Bhumi-Reel-${safeId}.mp4`;
      const downloaded = await FileSystem.downloadAsync(reel.uri, localPath);
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      Alert.alert(
        "Saved to Gallery",
        "The original video file was saved to your phone Gallery.",
      );
    } catch (e) {
      Alert.alert(
        "Download",
        e.message || "Could not save this reel to Gallery.",
      );
    }
  };

  const handleOpenReelComments = async (reel) => {
    setSelectedReel(reel);
    setReelComments([]);
    setReelCommentDraft("");
    setReelCommentsOpen(true);
    const id = Number(reel?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    setReelCommentsBusy(true);
    try {
      const rows = await loadReelComments(id);
      setReelComments(Array.isArray(rows) ? rows : []);
    } catch (e) {
      Alert.alert("Reel comments", e.message || "Could not load comments.");
    } finally {
      setReelCommentsBusy(false);
    }
  };

  const handleSubmitReelComment = async () => {
    const id = Number(selectedReel?.id);
    const message = reelCommentDraft.trim();
    if (!Number.isSafeInteger(id) || id <= 0 || !message || reelCommentsBusy)
      return;
    setReelCommentsBusy(true);
    try {
      const result = await createReelComment(id, message);
      const created = result?.comment;
      setReelComments((current) => [...current, created]);
      if (Number.isFinite(Number(result?.commentsCount))) {
        const count = Number(result.commentsCount);
        setReels((items) =>
          items.map((item) =>
            Number(item.id) === id ? { ...item, commentsCount: count } : item,
          ),
        );
        setSelectedReel((item) =>
          item && Number(item.id) === id
            ? { ...item, commentsCount: count }
            : item,
        );
      }
      setReelCommentDraft("");
    } catch (e) {
      Alert.alert("Reel comment", e.message || "Could not post comment.");
    } finally {
      setReelCommentsBusy(false);
    }
  };

  const handleApproveReelComment = async (commentId) => {
    const id = Number(selectedReel?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || reelCommentsBusy) return;
    setReelCommentsBusy(true);
    try {
      const result = await approveReelComment(id, commentId);
      setReelComments((items) =>
        items.map((item) =>
          String(item.id) === String(commentId)
            ? { ...item, isPending: false }
            : item,
        ),
      );
      if (Number.isFinite(Number(result?.commentsCount))) {
        const count = Number(result.commentsCount);
        setReels((items) =>
          items.map((item) =>
            Number(item.id) === id ? { ...item, commentsCount: count } : item,
          ),
        );
        setSelectedReel((item) =>
          item && Number(item.id) === id
            ? { ...item, commentsCount: count }
            : item,
        );
      }
    } catch (e) {
      Alert.alert(
        "Comment approval",
        e.message || "Could not approve reel comment.",
      );
    } finally {
      setReelCommentsBusy(false);
    }
  };

  const handleOpenSavedScreen = async () => {
    setSavedScreenOpen(true);
    setSavedContentBusy(true);
    try {
      const items = await loadSavedContent();
      setSavedContent(Array.isArray(items) ? items : []);
    } catch (e) {
      Alert.alert("Saved", e.message || "Could not load Saved items.");
    } finally {
      setSavedContentBusy(false);
    }
  };

  const handleOpenSavedItem = async (item) => {
    const id = Number(item?.id);
    const kind = item?.kind;
    if (!Number.isSafeInteger(id) || id <= 0) return;

    setSavedScreenOpen(false);

    if (kind === "reels") {
      let rows = reels;
      let index = rows.findIndex((row) => Number(row.id) === id);

      if (index < 0) {
        try {
          rows = await loadContent("reels");
          if (!Array.isArray(rows)) rows = [];
          index = rows.findIndex((row) => Number(row.id) === id);
        } catch (e) {
          rows = [];
        }
        if (index < 0) {
          rows = [item, ...rows];
          index = 0;
        }
        setReels(rows);
      }

      setPendingSavedReelIndex(index);
      setActiveReelIndex(index);
      setActiveTab("Reels");
      return;
    }

    if (kind === "posts") {
      let post = feedPosts.find(
        (row) =>
          Number(row.id) === id ||
          (row.mediaItems || []).some((media) => Number(media.id) === id),
      );

      if (!post) {
        try {
          const rows = await loadContent("posts");
          post = (Array.isArray(rows) ? rows : []).find(
            (row) =>
              Number(row.id) === id ||
              (row.mediaItems || []).some((media) => Number(media.id) === id),
          );
        } catch (e) {}
      }

      setSelectedPostMediaIndex(0);
      setSelectedPost(post || item);
      return;
    }

    Alert.alert("Saved", "This saved item type is not supported.");
  };

  const handleRemoveSavedItem = async (item) => {
    const kind = item?.kind;
    const id = Number(item?.id);
    if (
      !["posts", "reels"].includes(kind) ||
      !Number.isSafeInteger(id) ||
      id <= 0
    )
      return;
    try {
      await toggleSavedContent(kind, id);
      setSavedContent((current) =>
        current.filter((row) => !(row.kind === kind && Number(row.id) === id)),
      );
      if (kind === "reels") {
        setReels((current) =>
          current.map((row) =>
            Number(row.id) === id ? { ...row, isSaved: false } : row,
          ),
        );
        setReelSavedState((current) => ({ ...current, [id]: false }));
      }
    } catch (e) {
      Alert.alert("Saved", e.message || "Could not remove this item.");
    }
  };

  const openNotifications = async () => {
    setNotificationFilter("All");
    setNotificationsListOpen(true);
    setNotificationsLoading(true);
    try {
      const data = await loadNotifications();
      setNotificationsList(
        Array.isArray(data.notifications) ? data.notifications : [],
      );
      setUnreadNotificationCount(Number(data.unreadCount || 0));
    } catch (e) {
      Alert.alert(
        "Notifications",
        e.message || "Could not load notifications.",
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleReadNotification = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      setNotificationsList((current) =>
        current.map((item) =>
          String(item.id) === String(notificationId)
            ? { ...item, isRead: true }
            : item,
        ),
      );
      setUnreadNotificationCount((current) => Math.max(0, current - 1));
    } catch (e) {
      Alert.alert(
        "Notifications",
        e.message || "Could not mark notification as read.",
      );
    }
  };

  const openUserProfile = async (username) => {
    const target = String(username || "")
      .replace(/^@/, "")
      .trim();
    if (!target) return;
    const viewer = authSession?.username || "";
    setNotificationsListOpen(false);
    setViewedProfile(null);
    setViewedProfileOpen(true);
    setViewedProfileBusy(true);
    let cachedLoaded = false;

    try {
      const cached = await getCachedProfile(target, viewer);
      if (cached?.profile) {
        setViewedProfile(cached.profile);
        cachedLoaded = true;
      }
    } catch (e) {
      console.log("VIEWED_PROFILE_CACHE_READ_ERROR:", e?.message);
    }

    try {
      const result = await loadProfile(target, viewer);
      setViewedProfile(result.profile || result);

      setViewedProfilePostsBusy(true);
      try {
        const profilePosts = await loadProfilePosts(target, viewer);
        setViewedProfilePosts(Array.isArray(profilePosts) ? profilePosts : []);
      } catch (postsError) {
        console.log("VIEWED_PROFILE_POSTS_ERROR:", postsError?.message);
        setViewedProfilePosts([]);
      } finally {
        setViewedProfilePostsBusy(false);
      }

      try {
        const restricted = await loadRestrictedAccounts();
        setViewedProfileRestricted(
          restricted.some(
            (item) =>
              String(item.username).toLowerCase() === target.toLowerCase(),
          ),
        );
      } catch (restrictionError) {
        console.log("RESTRICTED_STATUS_LOAD_ERROR:", restrictionError?.message);
      }
    } catch (e) {
      if (!cachedLoaded) {
        setViewedProfileOpen(false);
        Alert.alert("Profile", e.message || "Could not load profile.");
      }
    } finally {
      setViewedProfileBusy(false);
    }
  };

  const handleNotificationPress = async (item) => {
    if (!item) return;
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setNotificationsList((current) =>
          current.map((n) =>
            String(n.id) === String(item.id) ? { ...n, isRead: true } : n,
          ),
        );
        setUnreadNotificationCount((current) => Math.max(0, current - 1));
      } catch (e) {
        Alert.alert(
          "Notifications",
          e.message || "Could not mark notification as read.",
        );
      }
    }

    setNotificationsListOpen(false);
    const kind = String(item.kind || "");
    const actor = String(item.actor || "").trim();

    if (kind === "like" || kind === "comment" || kind === "reel_like" || kind === "reel_comment") {
      if (!item.referenceId) {
        Alert.alert(
          "Post unavailable",
          "This notification does not contain a post reference.",
        );
        return;
      }
      const isReelActivity = kind === "reel_like" || kind === "reel_comment";
      let post = null;
      if (!isReelActivity) {
        try {
          post = await loadPostById(item.referenceId);
        } catch (_) {
          // Reel activity uses the Reels feed.
        }
      }
      if (post) {
        setSelectedPostMediaIndex(0);
        setSelectedPost(post);
        return;
      }
      if (kind === "comment" || kind === "like" || isReelActivity) {
        try {
          let reelItems = reels || [];
          if (!reelItems.some((entry) => Number(entry.id) === Number(item.referenceId))) {
            reelItems = await loadContent("reels", { force: true });
            setReels(reelItems);
          }
          const reelIndex = reelItems.findIndex(
            (entry) => Number(entry.id) === Number(item.referenceId),
          );
          if (reelIndex >= 0) {
            setActiveTab("Reels");
            setActiveReelIndex(reelIndex);
            if (kind === "comment" || kind === "reel_comment") await handleOpenReelComments(reelItems[reelIndex]);
            return;
          }
        } catch (error) {
          console.warn("Could not open reel notification:", error?.message || error);
        }
      }
      Alert.alert("Content unavailable", "This post or reel may have been deleted or is no longer visible.");
      return;
    }

    if (kind === "message") {
      if (!actor) return;
      setMessagesOpen(true);
      await openDirectChat(actor);
      return;
    }

    if (actor) await openUserProfile(actor);
  };

  const notificationResponseIds = React.useRef(new Set());

  React.useEffect(() => {
    let active = true;

    const openNotificationResponse = async (response) => {
      const request = response?.notification?.request;
      const identifier = request?.identifier;
      if (!request || (identifier && notificationResponseIds.current.has(identifier))) return;
      if (identifier) notificationResponseIds.current.add(identifier);

      const data = request.content?.data || {};
      const type = String(data.type || data.kind || "").toLowerCase();
      const actor = String(data.actor || data.username || data.caller || "").replace(/^@/, "").trim();
      if (!active) return;

      try {
        if (type === "direct_message" || type === "message") {
          if (!actor) return;
          setMessagesOpen(true);
          await openDirectChat(actor);
          return;
        }

        if (type === "incoming_call" || type === "incoming_call_headless" || type === "call") {
          // Opening the caller's conversation lets the existing pending-call
          // poller and CallKeep integration resolve the live call state.
          if (actor) {
            setMessagesOpen(true);
            await openDirectChat(actor);
          }
          return;
        }

        if (type === "like" || type === "comment" || type === "follow" ||
            type === "follow_request" || type === "reel_like" || type === "reel_comment" || data.referenceId || data.postId) {
          const item = {
            id: data.notificationId || data.id,
            kind: type,
            actor,
            referenceId: data.referenceId || data.postId || data.post_id,
            isRead: false,
          };
          if (item.kind === "direct_message") item.kind = "message";
          if (item.kind === "follow_request") item.kind = "follow";
          await handleNotificationPress(item);
        }
      } catch (error) {
        console.warn("Notification navigation failed:", error?.message || error);
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then(openNotificationResponse)
      .catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openNotificationResponse,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [authSession?.username]);

  const handleReadAllNotifications = async () => {
    try {
      await markAllNotificationsRead();
      setNotificationsList((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
      setUnreadNotificationCount(0);
    } catch (e) {
      Alert.alert(
        "Notifications",
        e.message || "Could not mark notifications as read.",
      );
    }
  };

  const changeNotificationDetail = async (key, value) => {
    const previous = notificationDetails;
    const updated = { ...previous, [key]: value };
    setNotificationDetails(updated);
    setNotificationsBusy(true);
    try {
      const saved = await saveNotificationDetails({ [key]: value });
      setNotificationDetails((current) => ({ ...current, ...saved }));
    } catch (e) {
      setNotificationDetails(previous);
      Alert.alert(
        "Notifications",
        e.message || "Could not save notification settings.",
      );
    } finally {
      setNotificationsBusy(false);
    }
  };

  const openBlockedAccounts = async () => {
    setSettingsHubOpen(false);
    setBlockedAccountsOpen(true);
    setBlockedAccountsLoading(true);
    try {
      setBlockedAccounts(await loadBlockedAccounts());
    } catch (error) {
      Alert.alert(
        "Blocked Accounts",
        error.message || "Could not load blocked accounts.",
      );
    } finally {
      setBlockedAccountsLoading(false);
    }
  };

  const handleUnblockAccount = async (username) => {
    setBlockedAccountsBusy(true);
    try {
      await unblockAccount(username);
      setBlockedAccounts((current) =>
        current.filter((item) => item.username !== username),
      );
    } catch (error) {
      Alert.alert(
        "Unblock failed",
        error.message || "Could not unblock this account.",
      );
    } finally {
      setBlockedAccountsBusy(false);
    }
  };

  const openRestrictedAccounts = async () => {
    setSettingsHubOpen(false);
    setRestrictedAccountsOpen(true);
    setRestrictedAccountsLoading(true);
    try {
      setRestrictedAccounts(await loadRestrictedAccounts());
    } catch (error) {
      Alert.alert(
        "Restricted Accounts",
        error.message || "Could not load restricted accounts.",
      );
    } finally {
      setRestrictedAccountsLoading(false);
    }
  };

  const handleUnrestrictAccount = async (username) => {
    setRestrictedAccountsBusy(true);
    try {
      await unrestrictAccount(username);
      setRestrictedAccounts((current) =>
        current.filter(
          (item) =>
            String(item.username).toLowerCase() !==
            String(username).toLowerCase(),
        ),
      );
      if (
        String(viewedProfile?.username || "").toLowerCase() ===
        String(username).toLowerCase()
      ) {
        setViewedProfileRestricted(false);
      }
    } catch (error) {
      Alert.alert(
        "Unrestrict failed",
        error.message || "Could not unrestrict this account.",
      );
    } finally {
      setRestrictedAccountsBusy(false);
    }
  };

  const handleToggleViewedProfileFollow = async () => {
    const username = String(viewedProfile?.username || "").replace(/^@/, "").trim();
    if (
      !username ||
      username.toLowerCase() === String(authSession?.username || "").toLowerCase() ||
      viewedProfileFollowBusy
    ) return;

    setViewedProfileFollowBusy(true);
    try {
      const wasFollowing = !!viewedProfile?.isFollowing;
      const wasPending = viewedProfile?.followRequestStatus === "pending";

      const result = wasFollowing || wasPending
        ? await unfollowProfile(username)
        : await followProfile(username);

      const status = result?.status ||
        (wasFollowing || wasPending ? "not_following" : "following");

      const isFollowing = status === "following";
      const isPending = status === "requested";

      setViewedProfile((prev) => {
        if (!prev) return prev;
        const countChange = isFollowing && !wasFollowing
          ? 1
          : !isFollowing && wasFollowing ? -1 : 0;

        return {
          ...prev,
          isFollowing,
          followRequestStatus: isPending ? "pending" : "",
          followersCount: Math.max(
            0,
            Number(prev.followersCount || 0) + countChange
          ),
        };
      });
    } catch (e) {
      Alert.alert("Follow", e.message || "Could not update follow.");
    } finally {
      setViewedProfileFollowBusy(false);
    }
  };

  const handleBlockViewedProfile = async () => {
    const username = String(viewedProfile?.username || "").replace(/^@/, "").trim();
    if (!username || viewedProfileBlockBusy ||
        username.toLowerCase() === String(authSession?.username || "").toLowerCase()) return;

    setViewedProfileBlockBusy(true);
    try {
      await blockAccount(username);
      setViewedProfileMenuOpen(false);
      setViewedProfileOpen(false);
      setViewedProfile(null);
      setSearchResults((current) => current.filter(
        (item) => String(item.username || "").toLowerCase() !== username.toLowerCase()
      ));
      setFollowRequests((current) => current.filter(
        (item) => String(item.username || item.requester || "").toLowerCase() !== username.toLowerCase()
      ));
    } catch (error) {
      Alert.alert("Block failed", error.message || "Could not block this account.");
    } finally {
      setViewedProfileBlockBusy(false);
    }
  };

  const handleToggleViewedProfileRestriction = async () => {
    if (Object.values(followRequestAction || {}).some(Boolean)) return;
    const username = String(viewedProfile?.username || "").trim();
    if (!username || viewedProfileRestrictBusy) return;
    setViewedProfileRestrictBusy(true);
    try {
      if (viewedProfileRestricted) {
        await unrestrictAccount(username);
        setViewedProfileRestricted(false);
        setRestrictedAccounts((current) =>
          current.filter(
            (item) =>
              String(item.username).toLowerCase() !== username.toLowerCase(),
          ),
        );
      } else {
        await restrictAccount(username);
        setViewedProfileRestricted(true);
      }
    } catch (error) {
      Alert.alert(
        "Restriction update failed",
        error.message || "Could not update restriction.",
      );
    } finally {
      setViewedProfileRestrictBusy(false);
    }
  };

  const openPrivacySettings = async () => {
    setPrivacyBusy(true);
    try {
      const settings = await loadPrivacySettings(authSession.username);
      setPrivacySettings({
        isPrivate: settings.isPrivate,
        accountType: settings.accountType || "personal",
        showActivity: settings.showActivity,
        allowMessages: settings.allowMessages,
      });
      setPrivacyOpen(true);
    } catch (e) {
      Alert.alert(
        "Privacy settings unavailable",
        e.message || "Check the server connection.",
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const openSnapPrivacySettings = async () => {
    setSnapPrivacyBusy(true);
    try {
      const saved = await loadSettingsPreferences();
      setSnapPrivacy({
        contactAudience: saved["privacy.contactAudience"] || "friends",
        storyAudience: saved["story.audience"] || "followers",
        readReceipts: saved["messages.readReceipts"] !== false,
        typingIndicator: saved["messages.typingIndicator"] !== false,
        storyReplies: saved["story.allowReplies"] !== false,
        disappearingMessages: saved["messages.disappearing"] || "off",
        hideFromSuggestions: saved["privacy.hideFromSuggestions"] === true,
      });
      setSnapPrivacyOpen(true);
    } catch (error) {
      Alert.alert("Privacy settings unavailable", error.message || "Please try again.");
    } finally {
      setSnapPrivacyBusy(false);
    }
  };

  const updateSnapPrivacy = async (key, value) => {
    const map = {
      contactAudience: "privacy.contactAudience",
      storyAudience: "story.audience",
      readReceipts: "messages.readReceipts",
      typingIndicator: "messages.typingIndicator",
      storyReplies: "story.allowReplies",
      disappearingMessages: "messages.disappearing",
      hideFromSuggestions: "privacy.hideFromSuggestions",
    };
    const serverKey = map[key];
    if (!serverKey || snapPrivacyBusy) return;
    const previous = snapPrivacy[key];
    setSnapPrivacy((current) => ({ ...current, [key]: value }));
    setSnapPrivacyBusy(true);
    try {
      await saveSettingsPreferences({ [serverKey]: value });
    } catch (error) {
      setSnapPrivacy((current) => ({ ...current, [key]: previous }));
      Alert.alert("Could not save", error.message || "Please try again.");
    } finally {
      setSnapPrivacyBusy(false);
    }
  };

  const openAboutApp = () => {
    setAboutAppOpen(true);
  };

  const handleSettingsLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutAccount();
          } catch (error) {
            console.warn("Server logout failed:", error?.message || error);
          } finally {
            setSettingsHubOpen(false);
            setAuthMode("login");
            setAuthSession(null);
          }
        },
      },
    ]);
  };

  const persistPrivacySettings = async () => {
    setPrivacyBusy(true);
    try {
      const settings = await savePrivacySettings(
        privacySettings,
        authSession.username,
      );
      setPrivacySettings(settings);
      setPrivacyOpen(false);
      Alert.alert("Saved", "Privacy settings have been saved.");
    } catch (e) {
      Alert.alert("Save failed", e.message || "Check the server connection.");
    } finally {
      setPrivacyBusy(false);
    }
  };

  const switchAccountMode = async (mode) => {
    if (privacyBusy) return;
    if (!["business", "creator", "private", "public"].includes(mode)) return;
    const changes = {
      accountType: mode === "business" || mode === "creator" ? mode : "personal",
      isPrivate: mode === "private",
    };
    setPrivacyBusy(true);
    try {
      const settings = await savePrivacySettings(changes, authSession.username);
      setPrivacySettings((current) => ({ ...current, ...settings }));
      if (mode === "business") {
        const details = await loadBusinessProfile();
        setBusinessProfile((current) => ({ ...current, ...details }));
        try {
          const [insights, catalog, replies] = await Promise.all([
            loadBusinessInsights(), loadBusinessCatalog(), loadBusinessQuickReplies(),
          ]);
          setBusinessInsights(insights);
          setBusinessCatalog(catalog);
          setBusinessQuickReplies(replies);
        } catch (_) {}
        setBusinessProfileOpen(true);
      } else {
        setBusinessProfileOpen(false);
        setBusinessDirectoryOpen(false);
        Alert.alert(
          "Account updated",
          mode === "private"
            ? "Your account is now private. Business tools are disabled."
            : mode === "creator"
              ? "Creator Account is active. Your public creator profile is ready."
              : "Your account is now public. Business tools are disabled.",
        );
      }
    } catch (error) {
      Alert.alert("Could not change account", error.message || "Please try again.");
    } finally {
      setPrivacyBusy(false);
    }
  };


  const persistBusinessProfile = async () => {
    if (privacySettings.accountType !== "business") {
      setBusinessProfileOpen(false);
      Alert.alert("Business Account only", "Business tools are available only in Business Account.");
      return;
    }
    if (businessProfileBusy) return;
    if (!businessProfile.businessName.trim() || !businessProfile.city.trim()) {
      Alert.alert("Details required", "Business name and city are required for area-wise discovery.");
      return;
    }
    setBusinessProfileBusy(true);
    try {
      const saved = await saveBusinessProfile({
        ...businessProfile,
        serviceRadiusKm: Number(businessProfile.serviceRadiusKm) || 0,
      });
      setBusinessProfile((current) => ({ ...current, ...saved }));
      setBusinessProfileOpen(false);
      await refreshProfile();
      Alert.alert("Business profile saved", "Your business details and service area are now published.");
    } catch (error) {
      Alert.alert("Save failed", error.message || "Please try again.");
    } finally {
      setBusinessProfileBusy(false);
    }
  };



  const addBusinessCatalogItem = async () => {
    if (privacySettings.accountType !== "business") return Alert.alert("Business Account only", "Switch to Business Account to manage your catalogue.");
    if (!catalogDraft.title.trim()) return Alert.alert("Catalog", "Enter a product or service name.");
    try {
      const item = await createBusinessCatalogItem(catalogDraft);
      setBusinessCatalog((items) => [item, ...items]);
      setCatalogDraft({ itemType: "product", title: "", description: "", price: "", category: "" });
    } catch (error) { Alert.alert("Catalog", error.message || "Could not save item."); }
  };

  const removeBusinessCatalogItem = async (id) => {
    try {
      await deleteBusinessCatalogItem(id);
      setBusinessCatalog((items) => items.filter((item) => item.id !== id));
    } catch (error) { Alert.alert("Catalog", error.message || "Could not delete item."); }
  };

  const addBusinessQuickReply = async () => {
    if (privacySettings.accountType !== "business") return Alert.alert("Business Account only", "Switch to Business Account to manage quick replies.");
    if (!quickReplyDraft.shortcut.trim() || !quickReplyDraft.message.trim()) return Alert.alert("Quick Replies", "Enter a shortcut and message.");
    try {
      const item = await createBusinessQuickReply(quickReplyDraft);
      setBusinessQuickReplies((items) => [item, ...items]);
      setQuickReplyDraft({ shortcut: "", message: "" });
    } catch (error) { Alert.alert("Quick Replies", error.message || "Could not save reply."); }
  };

  const removeBusinessQuickReply = async (id) => {
    try {
      await deleteBusinessQuickReply(id);
      setBusinessQuickReplies((items) => items.filter((item) => item.id !== id));
    } catch (error) { Alert.alert("Quick Replies", error.message || "Could not delete reply."); }
  };

  const searchBusinessDirectory = async () => {
    if (privacySettings.accountType !== "business") {
      Alert.alert("Business Account only", "Switch to Business Account to use area-wise business discovery.");
      setBusinessDirectoryOpen(false);
      return;
    }
    setBusinessDirectoryBusy(true);
    try {
      const results = await discoverBusinesses(businessDirectoryFilters);
      setBusinessDirectoryResults(results);
    } catch (error) {
      Alert.alert("Business search failed", error.message || "Please try again.");
    } finally {
      setBusinessDirectoryBusy(false);
    }
  };

  const refreshProfile = React.useCallback(async () => {
    if (!authSession?.username) return;
    const username = authSession.username;
    let cachedLoaded = false;

    try {
      const cached = await getCachedProfile(username, username);
      if (cached?.profile) {
        const item = cached.profile;
        setProfile(item);
        setProfileDraft({
          displayName: item.displayName || "you",
          bio: item.bio || "",
        });
        cachedLoaded = true;
      }
    } catch (e) {
      console.log("PROFILE_CACHE_READ_ERROR:", e?.message);
    }

    try {
      const result = await loadProfile(username, username);
      const item = result.profile || result;
      setProfile(item);
      setProfileDraft({
        displayName: item.displayName || "you",
        bio: item.bio || "",
      });
    } catch (e) {
      if (!cachedLoaded) {
        Alert.alert("प्रोफ़ाइल लोड नहीं हुई", e.message || "सर्वर कनेक्शन जाँचें।");
      }
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
        displayName: item.displayName || "you",
        bio: item.bio || "",
      });
      setProfileEditing(false);
      Alert.alert("सफल", "प्रोफ़ाइल सेव हो गई।");
    } catch (e) {
      Alert.alert("सेव नहीं हुआ", e.message || "सर्वर कनेक्शन जाँचें।");
    } finally {
      setProfileBusy(false);
    }
  };

  const chooseProfilePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("अनुमति चाहिए", "Gallery की अनुमति दें।");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      setProfileBusy(true);
      await uploadProfileAvatar(result.assets[0], authSession.username);
      await refreshProfile();
      Alert.alert("सफल", "प्रोफ़ाइल फ़ोटो अपडेट हो गई।");
    } catch (e) {
      Alert.alert("फ़ोटो अपलोड नहीं हुई", e.message || "सर्वर कनेक्शन जाँचें।");
    } finally {
      setProfileBusy(false);
    }
  };

  const removeProfilePhoto = () => {
    Alert.alert("Remove Photo?", "क्या प्रोफ़ाइल फ़ोटो हटानी है?", [
      { text: "रद्द करें", style: "cancel" },
      {
        text: "हटाएँ",
        style: "destructive",
        onPress: async () => {
          setProfileBusy(true);
          try {
            await deleteProfileAvatar(authSession.username);
            await refreshProfile();
          } catch (e) {
            Alert.alert("फ़ोटो नहीं हटी", e.message || "फिर से कोशिश करें।");
          } finally {
            setProfileBusy(false);
          }
        },
      },
    ]);
  };

  const openProfileConnections = async (username, type) => {
    const target = String(username || "").replace(/^@/, "").trim();
    if (!target || !["followers", "following"].includes(type)) return;
    setProfileConnectionsUsername(target);
    setProfileConnectionsType(type);
    setProfileConnectionsItems([]);
    setProfileConnectionsError("");
    setProfileConnectionsOpen(true);
    setProfileConnectionsBusy(true);
    try {
      const result = await loadProfileConnections(target, type);
      const items = result.items || result.users || result[type] || [];
      setProfileConnectionsItems(Array.isArray(items) ? items : []);
    } catch (e) {
      setProfileConnectionsError(e.message || "सूची लोड नहीं हुई।");
    } finally {
      setProfileConnectionsBusy(false);
    }
  };

  const showProfileConnections = async (type) => {
    await openProfileConnections(authSession?.username, type);
  };

  const refreshFollowRequests = React.useCallback(async () => {
    if (!authSession?.username) return;
    setFollowRequestsBusy(true);
    try {
      setFollowRequests(await loadFollowRequests());
    } catch (e) {
      Alert.alert("Follow Requests", e.message || "Requests load नहीं हुईं।");
    } finally {
      setFollowRequestsBusy(false);
    }
  }, [authSession?.username]);

  React.useEffect(() => {
    if (activeTab === "Profile" && authSession?.username)
      refreshFollowRequests();
  }, [activeTab, authSession?.username, refreshFollowRequests]);

  const resolveFollowRequest = async (requestId, decision) => {
    if (followRequestAction[requestId]) return;
    setFollowRequestAction((prev) => ({ ...prev, [requestId]: true }));
    try {
      if (decision === "accept") await acceptFollowRequest(requestId);
      else await rejectFollowRequest(requestId);
      setFollowRequests((prev) =>
        prev.filter((item) => String(item.id) !== String(requestId)),
      );
      await refreshProfile();
      Alert.alert(
        decision === "accept" ? "Request accepted" : "Request rejected",
        decision === "accept"
          ? "अब यह user आपका follower है।"
          : "Follow request reject कर दी गई।",
      );
    } catch (e) {
      Alert.alert("Follow Request", e.message || "Action पूरा नहीं हुआ।");
    } finally {
      setFollowRequestAction((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const refreshContent = React.useCallback(async (forceRefresh = false) => {
    const freshLoaded = { posts: false, stories: false, reels: false };

    // Paint each cached section independently; a slow Stories/Reels request
    // must not hold the Home feed back on a cold server start.
    const cachePromise = Promise.all([
      getCachedContent("posts"),
      getCachedContent("stories"),
      getCachedContent("reels"),
    ]).then(([cachedPosts, cachedStories, cachedReels]) => {
      if (!freshLoaded.posts && Array.isArray(cachedPosts) && cachedPosts.length) {
        setFeedPosts(cachedPosts);
      }
      if (!freshLoaded.stories && Array.isArray(cachedStories)) {
        setServerStories(
          cachedStories.map((item, i) => ({
            ...item,
            name: item.user || `story${i + 1}`,
            color: "#DDE7F5",
          })),
        );
      }
      if (!freshLoaded.reels && Array.isArray(cachedReels)) setReels(cachedReels);
    });

    const requests = await Promise.allSettled([
      loadContent("posts", { force: forceRefresh }).then((items) => {
        freshLoaded.posts = true;
        setFeedPosts(Array.isArray(items) ? items : []);
      }),
      loadContent("stories", { force: forceRefresh }).then((items) => {
        freshLoaded.stories = true;
        setServerStories(
          items.map((item, i) => ({
            ...item,
            name: item.user || `story${i + 1}`,
            color: "#DDE7F5",
          })),
        );
      }),
      loadContent("reels", { force: forceRefresh }).then((items) => {
        freshLoaded.reels = true;
        setReels(items);
      }),
    ]);

    await cachePromise;
    const successfulRequests = requests.filter((item) => item.status === "fulfilled").length;
    setServerOnline(successfulRequests > 0);
    if (successfulRequests === 0) {
      console.error(
        "Server content load failed:",
        requests.map((item) => item.status === "rejected" ? item.reason?.message : null).filter(Boolean),
      );
    }
  }, []);

  const requestDeleteContent = (kind, item) => {
    const itemId = Number(item?.id);
    const owner = String(item?.user || item?.username || "").replace(/^@/, "");
    if (!authSession?.token || !owner || owner.toLowerCase() !== String(authSession.username || "").toLowerCase()) {
      Alert.alert("Delete unavailable", "You can delete only your own uploaded content.");
      return;
    }
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || item?.isStarterPost || item?.isStarterReel) {
      Alert.alert("Delete unavailable", "This sample item cannot be deleted.");
      return;
    }

    Alert.alert(
      "Delete this " + (kind === "stories" ? "story" : kind === "reels" ? "reel" : "post") + "?",
      "This will permanently remove it from Bhumi Social AI.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteContent(kind, itemId);
              if (kind === "posts") {
                setFeedPosts((items) => items.filter((entry) => String(entry.id) !== String(itemId)));
                setSelectedPost((current) => current && String(current.id) === String(itemId) ? null : current);
              } else if (kind === "stories") {
                setServerStories((items) => items.filter((entry) => String(entry.id) !== String(itemId)));
                setStoryQueue((items) => items.filter((entry) => String(entry.id) !== String(itemId)));
                setSelectedStory((current) => current && String(current.id) === String(itemId) ? null : current);
              } else if (kind === "reels") {
                setReels((items) => items.filter((entry) => String(entry.id) !== String(itemId)));
                setSelectedReel((current) => current && String(current.id) === String(itemId) ? null : current);
                setActiveReelIndex((current) => Math.max(0, Math.min(current, reels.length - 2)));
              }
              await refreshContent(true);
            } catch (error) {
              Alert.alert("Delete failed", error?.message || "Could not delete this content.");
            }
          },
        },
      ],
    );
  };

  React.useEffect(() => {
    refreshContent();
  }, [refreshContent]);

  const openLiveCamera = async () => {
    try {
      let permission = cameraPermission;
      if (!permission?.granted) permission = await requestCameraPermission();
      if (!permission?.granted) {
        Alert.alert("Camera permission required", "Allow camera access to start Live.");
        return;
      }
      setLiveCameraOpen(true);
    } catch (e) {
      Alert.alert("Camera unavailable", e.message || "Please try again.");
    }
  };

  const openReelCamera = async () => {
    try {
      let permission = cameraPermission;
      if (!permission?.granted) {
        permission = await requestCameraPermission();
      }
      if (!permission?.granted) {
        Alert.alert(
          "Camera permission required",
          "Allow camera access to record a Reel.",
        );
        return;
      }
      setRecordedVideo(null);
      setRecordedPhoto(null);
      setCameraMode("video");
      setCameraTargetKind("reels");
      setCameraOpen(true);
    } catch (e) {
      Alert.alert("Camera unavailable", e.message || "Please try again.");
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
      Alert.alert("Recording failed", e.message || "Please try again.");
    } finally {
      setIsRecording(false);
    }
  };

  const stopCameraRecording = () => {
    if (isRecording) cameraRef.current?.stopRecording();
  };

  const takeCameraPhoto = async () => {
    if (!cameraRef.current || isRecording || recordedPhoto) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (!photo?.uri) return;

      if (cameraMode === "picture") {
        const filteredAsset = await applyPostPhotoFilter(
          {
            ...photo,
            uri: photo.uri,
            photoBaseUri: photo.uri,
            photoFilterIndex: 0,
            photoBrightness: 0,
            type: "image",
            mimeType: "image/jpeg",
          },
          postCameraFilterIndex,
        );
        setRecordedPhotoAsset(filteredAsset);
        setRecordedPhoto(filteredAsset.uri);
      } else {
        setRecordedPhoto(photo.uri);
      }
    } catch (e) {
      Alert.alert("Photo capture failed", e.message || "Please try again.");
    }
  };

  const useRecordedPhoto = () => {
    if (!recordedPhoto) return;
    const kind = cameraTargetKind === "stories" ? "stories" : "posts";
    setMediaDraft({
      kind,
      assets: [
        {
          ...(recordedPhotoAsset || {}),
          uri: recordedPhoto,
          type: "image",
          fileName: `camera-photo-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          photoFilterIndex: recordedPhotoAsset?.photoFilterIndex ?? postCameraFilterIndex,
          photoBrightness: recordedPhotoAsset?.photoBrightness ?? 0,
          photoBaseUri: recordedPhotoAsset?.photoBaseUri || recordedPhoto,
        },
      ],
    });
    setMediaDraftIndex(0);
    setMediaDraftCaption("");
    setCameraOpen(false);
    setRecordedPhoto(null);
    setRecordedPhotoAsset(null);
  };

  const openCaptureCamera = async (kind, mode) => {
    try {
      let permission = cameraPermission;
      if (!permission?.granted) permission = await requestCameraPermission();
      if (!permission?.granted) {
        Alert.alert(
          "Camera permission required",
          "Allow camera access to capture media.",
        );
        return;
      }
      setCameraTargetKind(kind);
      setCameraMode(mode);
      setRecordedPhoto(null);
      setRecordedPhotoAsset(null);
      setPostCameraFilterIndex(0);
      setRecordedVideo(null);
      setCameraOpen(true);
    } catch (e) {
      Alert.alert("Camera unavailable", e.message || "Please try again.");
    }
  };

  const useRecordedVideo = () => {
    if (!recordedVideo) return;
    setMediaDraft({
      kind: cameraTargetKind,
      assets: [
        {
          uri: recordedVideo,
          type: "video",
          fileName: "recorded-reel.mp4",
          mimeType: "video/mp4",
        },
      ],
    });
    setMediaDraftIndex(0);
    setMediaDraftCaption("");
    setMusicAsset(null);
    setMusicStart(0);
    setCameraOpen(false);
    setRecordedVideo(null);
  };

  const chooseMedia = async (kind, mediaMode = "default") => {
    if (busy || mediaDraft) return;
    if (kind === "reels" && mediaMode === "default") {
      Alert.alert("Create Reel", "Choose your media", [
        { text: "Record with Camera", onPress: openReelCamera },
        { text: "Select Video", onPress: () => chooseMedia("reels", "video") },
        { text: "Create Video from Photos", onPress: createReelFromPhotos },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    try {
      const video = kind === "reels" && mediaMode !== "camera-gallery";
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: video ? ["videos"] : ["images", "videos"],
        allowsMultipleSelection: kind === "posts",
        selectionLimit: kind === "posts" ? 10 : 1,
        allowsEditing: false,
        quality: 1,
        ...(kind === "reels"
          ? { videoMaxDuration: 1200 }
          : kind === "stories"
            ? { videoMaxDuration: 1200 }
            : kind === "posts"
              ? { videoMaxDuration: 7200 }
              : {}),
      });
      if (result.canceled || !result.assets?.length) return;
      const normalizedAssets = result.assets.map((asset) => {
        const uri = asset.uri || "";
        const videoByType = asset.type === "video";
        const videoByName = /\.(mp4|mov|webm|m4v|3gp|mkv)(?:[?#].*)?$/i.test(
          asset.fileName || uri,
        );
        return {
          ...asset,
          type: videoByType || videoByName ? "video" : asset.type || "image",
        };
      });
      const maxBytes =
        kind === "posts" ? 1024 * 1024 * 1024 : 500 * 1024 * 1024;
      const oversizedAsset = normalizedAssets.find(
        (asset) => Number(asset.fileSize || 0) > maxBytes,
      );
      if (oversizedAsset) {
        const limitMB = Math.floor(maxBytes / (1024 * 1024));
        Alert.alert(
          "फ़ाइल बहुत बड़ी है",
          `इस अपलोड की अधिकतम सीमा ${limitMB} MB है। छोटी फ़ाइल चुनें।`,
        );
        return;
      }
      setMediaDraft({ kind, assets: normalizedAssets });
      setMediaDraftIndex(0);
      setMediaDraftCaption("");
    } catch (e) {
      console.error("Media selection failed:", e);
      Alert.alert("मीडिया नहीं खुला", e.message || "कृपया फिर कोशिश करें।");
    }
  };

  const openMusicOptions = () => setMusicSearchOpen(true);

  const searchMusicOnGoogle = async () => {
    const query = musicSearchQuery.trim();
    if (!query || musicSearchLoading) {
      if (!query) Alert.alert("गाना खोजें", "पहले गाने या कलाकार का नाम लिखें।");
      return;
    }
    setMusicSearchLoading(true);
    try {
      await Linking.openURL(buildGoogleMusicSearchUrl(query));
    } catch (error) {
      Alert.alert("Google Search नहीं खुला", error?.message || "कृपया फिर कोशिश करें।");
    } finally {
      setMusicSearchLoading(false);
    }
  };

  const chooseMusicFile = async () => {
    if (musicSearchLoading) return;
    setMusicSearchLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const selectedAudio = await importAudioToMusicLibrary(result.assets[0]);
      setMusicLibrary((current) => [selectedAudio, ...current.filter((item) => item.id !== selectedAudio.id)]);
      setMusicAsset(selectedAudio);
      musicPlayer.replace({ uri: selectedAudio.uri });
      musicPlayer.play();
      setMusicPlayingId(selectedAudio.id);
      setMusicSearchOpen(false);
    } catch (e) {
      Alert.alert("Music selection failed", e.message || "Please try again.");
    } finally {
      setMusicSearchLoading(false);
    }
  };

  const useMusicTrack = (track) => {
    if (!track?.uri) return;
    setMusicAsset(track);
    musicPlayer.replace({ uri: track.uri });
    musicPlayer.play();
    setMusicPlayingId(track.id);
    setMusicSearchOpen(false);
  };

  const toggleMusicPreview = (track) => {
    if (!track?.uri) return;
    if (musicPlayingId === track.id && musicPlayerStatus?.playing) {
      musicPlayer.pause();
      setMusicPlayingId(null);
      return;
    }
    musicPlayer.replace({ uri: track.uri });
    musicPlayer.play();
    setMusicPlayingId(track.id);
  };

  const toggleMusicFavorite = async (track) => {
    const updated = await updateMusicTrack(track.id, { favorite: !track.favorite });
    setMusicLibrary(updated);
  };

  const deleteMusicLibraryTrack = async (track) => {
    if (musicAsset?.id === track.id) {
      musicPlayer.pause();
      setMusicAsset(null);
      setMusicPlayingId(null);
    }
    const updated = await removeMusicTrack(track.id);
    setMusicLibrary(updated);
  };

  const createReelFromPhotos = async () => {
    if (busy || mediaDraft) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 20,
        orderedSelection: true,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      if (result.assets.length < 2) {
        Alert.alert(
          "Select photos",
          "Please select at least 2 photos to create a video.",
        );
        return;
      }
      setBusy(true);
      const videoAsset = await createVideoFromPhotos(result.assets, {
        secondsPerPhoto: 3,
      });
      setMediaDraft({ kind: "reels", assets: [videoAsset] });
      setMediaDraftIndex(0);
      setMediaDraftCaption("");
      setMusicAsset(null);
      setMusicStart(0);
    } catch (e) {
      console.error("Photo video creation failed:", e);
      Alert.alert("Video creation failed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoEdit = async (action) => {
    if (!mediaDraft || busy) return;

    const index = mediaDraftIndex;
    const asset = mediaDraft.assets?.[index];
    const isVideo =
      asset?.type === "video" ||
      /\.(mp4|mov|webm)(\?|$)/i.test(asset?.uri || "");

    if (!asset || isVideo) return;

    setBusy(true);
    try {
      const editedAsset = await editPhotoAsset(asset, action);
      setMediaDraft((current) =>
        current
          ? {
              ...current,
              assets: current.assets.map((item, i) =>
                i === index ? editedAsset : item,
              ),
            }
          : current,
      );
    } catch (e) {
      Alert.alert("Photo editing failed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    const match = String(mediaDraftCaption || "").match(/(?:^|\s)@([A-Za-z0-9_.]{2,50})$/);
    const query = match?.[1] || "";
    setMentionToken(query);
    if (query.length < 2) {
      setMentionSuggestions([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(query);
        if (active) setMentionSuggestions(results.slice(0, 6));
      } catch (_) {
        if (active) setMentionSuggestions([]);
      }
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mediaDraftCaption]);

  const insertMention = (user) => {
    const username = String(user?.username || "").replace(/^@/, "");
    if (!username) return;
    setMediaDraftCaption((current) =>
      String(current || "").replace(/(?:^|\s)@[A-Za-z0-9_.]{2,50}$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return prefix + "@" + username + " ";
      }),
    );
    setMentionSuggestions([]);
    setMentionToken("");
  };

  const mentionSuggestionList = mentionSuggestions.length > 0 ? (
    <View style={{ marginTop: 6, padding: 7, borderRadius: 12, backgroundColor: "#121212", borderWidth: 1, borderColor: "#0095F6" }}>
      {mentionSuggestions.map((user) => (
        <TouchableOpacity key={user.username} onPress={() => insertMention(user)} style={{ paddingVertical: 9, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="person-circle-outline" size={22} color="#0095F6" />
          <View style={{ marginLeft: 9 }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>@{user.username}</Text>
            {!!user.displayName && user.displayName !== user.username ? <Text style={{ color: "#A8A8A8", fontSize: 11 }}>{user.displayName}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  const uploadDraftMedia = async () => {
    if (!mediaDraft || busy) return;
    const { kind, assets } = mediaDraft;
    setBusy(true);
    try {
      const uploadedItems = [];
      const groupId =
        kind === "posts" && assets.length > 1
          ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          : "";
      for (const asset of assets) {
        let uploadAsset = asset;
        let assetIsVideo =
          asset.type === "video" ||
          /\.(mp4|mov|webm)(\?|$)/i.test(asset.uri || "");

        // Render a photo Status as a short video when music is selected.
        if (kind === "stories" && !assetIsVideo && musicAsset?.uri) {
          uploadAsset = await createVideoFromPhotos([asset], { secondsPerPhoto: 10 });
          assetIsVideo = true;
        }

        if (assetIsVideo && zoomEffectEnabled) {
          uploadAsset = await applyZoomEffect(uploadAsset.uri, {
            zoom: zoomEffectLevel,
            duration: zoomEffectDuration,
          });
        }

        if (assetIsVideo && (videoFilterIndex > 0 || voiceEffect !== "Original")) {
          uploadAsset = await applyVideoEffects(uploadAsset.uri, {
            videoFilterIndex,
            voiceEffect,
          });
        }

        if (assetIsVideo && musicAsset?.uri) {
          uploadAsset = await addMusicToVideo(uploadAsset.uri, musicAsset.uri, {
            musicVolume,
            musicStart,
            keepOriginalAudio,
          });
        }
        uploadedItems.push(
          await uploadContent(
            kind,
            uploadAsset,
            mediaDraftCaption.trim(),
            groupId,
          ),
        );
      }
      const item = uploadedItems[0];
      setMediaDraft(null);
      musicPlayer.pause();
      setMediaDraftIndex(0);
      setMediaDraftCaption("");
      setZoomEffectEnabled(false);
      setZoomEffectLevel(1.5);
      setZoomEffectDuration(3);
      setMusicAsset(null);
      setMusicStart(0);
      setMusicVolume(0.8);
      setKeepOriginalAudio(true);
      setVideoFilterIndex(0);
      setVoiceEffect("Original");
      if (kind === "posts") {
        await refreshContent(true);
        setActiveTab("Home");
      } else if (kind === "stories") {
        setServerStories((current) => [
          { ...item, name: item.user || "you", own: true, color: "#DDE7F5" },
          ...current,
        ]);
        setActiveTab("Home");
      } else {
        setReels((current) => [item, ...current]);
        setActiveTab("Reels");
      }
      Alert.alert(
        kind === "posts"
          ? "Post published!"
          : kind === "stories"
            ? "Story shared!"
            : "Reel published!",
        kind === "posts"
          ? "Your post is now live on Bhumi Social AI."
          : kind === "stories"
            ? "Your story is now live."
            : "Your reel is now live.",
      );
    } catch (e) {
      console.error("Upload failed:", e);
      Alert.alert("अपलोड विफल", e.message || "सर्वर कनेक्शन जाँचें।");
    } finally {
      setBusy(false);
    }
  };

  const cancelDraftMedia = () => {
    setMediaDraft(null);
    musicPlayer.pause();
    setMediaDraftIndex(0);
    setMediaDraftCaption("");
    setZoomEffectEnabled(false);
    setZoomEffectLevel(1.5);
    setZoomEffectDuration(3);
    setMusicAsset(null);
    setMusicStart(0);
    setMusicVolume(0.8);
    setKeepOriginalAudio(true);
    setVideoFilterIndex(0);
    setVoiceEffect("Original");
  };

  const pickImage = () => chooseMedia("posts");
  const createStory = () => chooseMedia("stories");
  const createReel = () => chooseMedia("reels");

  const runHeaderCreateAction = (action) => {
    setHeaderCreateMenuOpen(false);
    if (action === "live-camera") openLiveCamera();
  else if (action === "reel-camera") openReelCamera();
    else if (action === "reel-photos") createReelFromPhotos();
    else if (action === "photo-post") openCaptureCamera("posts", "picture");
    else if (action === "video-post") openCaptureCamera("posts", "video");
    else if (action === "story-camera") openCaptureCamera("stories", "picture");
    else if (action === "story-gallery") createStory();
    else if (action === "post-gallery") pickImage();
  };

  const renderAppHeader = () => (
    <View style={[styles.header, { justifyContent: "space-between", gap: 8, position: "relative" }]}>
      {activeTab === "Profile" ? (
        <>
          <Text style={[styles.brand, { flex: 1, fontSize: 20 }]} numberOfLines={1}>
            {profile?.username ? `@${profile.username}` : "Profile"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <TouchableOpacity onPress={() => setHeaderCreateMenuOpen((value) => !value)} accessibilityLabel="Create post" style={{ padding: 3 }}>
              <Ionicons name="add-square-outline" size={26} color="#F5F5F5" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsHubOpen(true)} accessibilityLabel="Settings and activity" hitSlop={8} style={{ width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",marginRight:-5 }}>
              <Ionicons name="menu" size={29} color="#F5F5F5" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
            <Image source={require("./assets/bhumi-social-ai-logo.jpg")} style={{ width: 32, height: 32 }} resizeMode="contain" accessibilityLabel="Bhumi Social AI logo" />
            <Text style={styles.brand} numberOfLines={1}>Bhumi Social AI</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 19 }}>
            <TouchableOpacity onPress={() => setHeaderCreateMenuOpen((value) => !value)} accessibilityLabel="Create menu" style={{ padding: 3 }}>
              <Ionicons name="add-circle-outline" size={27} color="#F5F5F5" />
            </TouchableOpacity>
            <TouchableOpacity onPress={openNotifications} accessibilityLabel="Notifications" style={{ position: "relative", padding: 3 }}>
              <Ionicons name="heart-outline" size={26} color="#F5F5F5" />
              {unreadNotificationCount > 0 ? (
                <View style={{ position: "absolute", right: -5, top: -5, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#E1306C", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={openMessages} accessibilityLabel="Messages" style={{ padding: 3 }}>
              <Ionicons name="paper-plane-outline" size={25} color="#F5F5F5" />
            </TouchableOpacity>
          </View>
        </>
      )}
      {headerCreateMenuOpen ? (
        <Modal visible={headerCreateMenuOpen} transparent animationType="fade" statusBarTranslucent={false} onRequestClose={() => setHeaderCreateMenuOpen(false)}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity activeOpacity={1} onPress={() => setHeaderCreateMenuOpen(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", top: 72, right: 12, zIndex: 1000, elevation: 20, minWidth: 215, backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#262626", borderRadius: 14, paddingVertical: 6, paddingHorizontal: 8 }}>
              {[
                ["live-camera", "Go Live", "radio-outline"],
                ["reel-camera", "Record Reel", "videocam-outline"],
                ["reel-photos", "Reel from Photos", "images-outline"],
                ["photo-post", "Photo Post", "camera-outline"],
                ["video-post", "Video Post", "film-outline"],
                ["story-camera", "Story from Camera", "camera"],
                ["story-gallery", "Story from Gallery", "images"],
                ["post-gallery", "Post from Gallery", "image-outline"],
              ].map(([action, label, iconName]) => (
                <TouchableOpacity key={action} onPress={() => runHeaderCreateAction(action)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 9 }}>
                  <Ionicons name={iconName} size={19} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 14, marginLeft: 12, fontWeight: "600" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );

  const handleTab = (name) => {
    if (name === "Chat") {
      openMessages();
      return;
    }
    if (name === "Create") {
      setHeaderCreateMenuOpen(true);
      return;
    }
    setActiveTab(name);
    if (name === "Home") refreshContent();
  };

  React.useEffect(() => {
    if (authSession?.token) {
      setWelcomeSeen(true);
      SecureStore.setItemAsync("socialapp_welcome_seen", "true").catch(
        () => {},
      );
    }
  }, [authSession]);

  const submitAuth = async () => {
    if (authBusy) return;
    const username = authUsername.trim();
    const fullName = authFullName.trim();
    const email = authEmail.trim().toLowerCase();
    if (!username || !authPassword) {
      Alert.alert("Required", "Enter your username and password.");
      return;
    }
    if (authMode === "register") {
      if (!fullName) {
        Alert.alert("Required", "Enter your full name.");
        return;
      }
      if (!/^[a-zA-Z0-9_.]{3,50}$/.test(username)) {
        Alert.alert(
          "Invalid username",
          "Use 3 to 50 letters, numbers, dots, or underscores.",
        );
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Alert.alert(
          "Invalid email",
          "Enter a valid email address or leave it blank.",
        );
        return;
      }
      const phoneDigits = authPhoneNumber.replace(/\D/g, "");
      if (
        authPhoneNumber.trim() &&
        (phoneDigits.length < 10 || phoneDigits.length > 15)
      ) {
        Alert.alert(
          "Invalid mobile number",
          "Enter a valid mobile number or leave it blank.",
        );
        return;
      }
      if (authPassword.length < 4 || authPassword.length > 24) {
        Alert.alert("Invalid password", "Password must be 4 to 24 characters.");
        return;
      }
      if (authPassword !== authConfirmPassword) {
        Alert.alert(
          "Password mismatch",
          "Password and confirm password do not match.",
        );
        return;
      }
    }
    setAuthBusy(true);
    try {
      const result =
        authMode === "register"
          ? await registerAccount(
              username,
              authPassword,
              authPhoneNumber,
              email,
              fullName,
            )
          : await loginAccount(username, authPassword);
      if (authMode === "register" && authAccountType !== "personal") {
        await savePrivacySettings(
          { accountType: authAccountType, isPrivate: false },
          result.username || username,
        );
      }
      setAuthSession({ token: result.token, username: result.username });
      setAuthPassword("");
      Alert.alert(
        "Success",
        authMode === "register" ? "Account created." : "Login successful.",
      );
    } catch (error) {
      Alert.alert(
        "Authentication failed",
        error.message || "Please check the server connection.",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  // BHUMI_ANDROID_BACK_STACK_V1
  // Close the most recently opened feature first. Only allow Android to leave
  // the app after the user has returned to the Home tab.
  React.useEffect(() => {
    const onHardwareBack = () => {
      if (headerCreateMenuOpen) { setHeaderCreateMenuOpen(false); return true; }
      if (liveCameraOpen) { setLiveCameraOpen(false); return true; }
      if (cameraOpen) { setCameraOpen(false); setIsRecording(false); return true; }
      if (selectedStory) { setSelectedStory(null); setStoryImageZoomed(false); return true; }
      if (profileConnectionsOpen) { setProfileConnectionsOpen(false); return true; }
      if (viewedProfileMenuOpen) { setViewedProfileMenuOpen(false); return true; }
      if (viewedProfileOpen) { setViewedProfileOpen(false); setViewedProfile(null); return true; }
      if (selectedPost) { setSelectedPost(null); return true; }
      if (reelCommentsOpen) { setReelCommentsOpen(false); return true; }
      if (savedScreenOpen) { setSavedScreenOpen(false); return true; }
      if (noteViewer) { setNoteViewer(null); return true; }
      if (noteComposerOpen) { setNoteComposerOpen(false); return true; }
      if (chatEmojiOpen) { setChatEmojiOpen(false); return true; }
      if (chatPersonalizationOpen) { setChatPersonalizationOpen(false); return true; }
      if (newChatComposerOpen) { setNewChatComposerOpen(false); return true; }
      if (selectedChatUser) { setSelectedChatUser(null); return true; }
      if (messagesOpen) { setMessagesOpen(false); return true; }
      if (profileEditing) { setProfileEditing(false); return true; }
      if (businessDirectoryOpen) { setBusinessDirectoryOpen(false); return true; }
      if (businessProfileOpen) { setBusinessProfileOpen(false); return true; }
      if (blockedAccountsOpen) { setBlockedAccountsOpen(false); return true; }
      if (snapPrivacyOpen) { setSnapPrivacyOpen(false); return true; }
      if (privacyOpen) { setPrivacyOpen(false); return true; }
      if (passwordOpen) { setPasswordOpen(false); return true; }
      if (accountSettingsOpen) { setAccountSettingsOpen(false); return true; }
      if (aboutAppOpen) { setAboutAppOpen(false); return true; }
      if (settingsHubOpen) { setSettingsHubOpen(false); return true; }
      if (mediaDraft) { setMediaDraft(null); return true; }
      if (activeTab !== "Home") { setActiveTab("Home"); return true; }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
    return () => subscription.remove();
  }, [
    headerCreateMenuOpen, liveCameraOpen, cameraOpen, selectedStory, selectedPost,
    reelCommentsOpen, savedScreenOpen, noteViewer, noteComposerOpen, chatEmojiOpen,
    chatPersonalizationOpen, newChatComposerOpen, selectedChatUser, messagesOpen,
    profileConnectionsOpen, viewedProfileMenuOpen, viewedProfileOpen, profileEditing,
    businessDirectoryOpen, businessProfileOpen, blockedAccountsOpen, snapPrivacyOpen,
    privacyOpen, passwordOpen, accountSettingsOpen, aboutAppOpen, settingsHubOpen,
    mediaDraft, activeTab,
  ]);

  if (!authReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
        <StatusBar style="light" hidden={false} translucent={false} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 }}>
          <View style={{ width: 92, height: 92, borderRadius: 28, backgroundColor: "#121212", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center", padding: 6 }}>
            <Image source={require("./assets/bhumi-social-ai-logo.jpg")} style={{ width: 78, height: 78, borderRadius: 22 }} resizeMode="contain" />
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 18 }}>Bhumi Social AI</Text>
        </View>
      </SafeAreaView>
    );
  }

  // SOCIALAPP_FORGOT_PASSWORD_SCREEN_V1
  if (authReady && !authSession && authMode === "forgot") {
    const fieldStyle = {
      borderWidth: 1,
      borderColor: "#262626",
      borderRadius: 8,
      padding: 13,
      marginBottom: 12,
      color: "#FFFFFF",
    };

    const forgotAction = async (action) => {
      if (authBusy) return;

      if (action === "request" && !forgotEmail.trim().includes("@")) {
        Alert.alert("Email required", "Enter your registered email address.");
        return;
      }

      if (action === "reset") {
        if (forgotNewPassword.length < 4 || forgotNewPassword.length > 24) {
          Alert.alert(
            "Invalid password",
            "Password must be 4 to 24 characters.",
          );
          return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
          Alert.alert("Password mismatch", "The passwords do not match.");
          return;
        }
      }

      setAuthBusy(true);
      try {
        if (action === "request") {
          await requestPasswordReset(forgotEmail);
          setForgotStep("otp");
          Alert.alert(
            "Check your email",
            "If the account exists, a reset code has been sent.",
          );
        } else if (action === "verify") {
          const result = await verifyPasswordReset(forgotEmail, forgotOtp);
          const token = result.reset_token || result.resetToken;
          if (!token)
            throw new Error("The server did not return a reset token.");
          setForgotResetToken(token);
          setForgotStep("reset");
        } else if (action === "reset") {
          await resetPasswordWithToken(
            forgotEmail,
            forgotResetToken,
            forgotNewPassword,
            forgotConfirmPassword,
          );
          setForgotStep("email");
          setForgotOtp("");
          setForgotResetToken("");
          setForgotNewPassword("");
          setForgotConfirmPassword("");
          setAuthPassword("");
          setAuthMode("login");
          Alert.alert("Password updated", "Log in with your new password.");
        }
      } catch (error) {
        Alert.alert(
          "Password reset",
          error.message || "Could not complete the password reset.",
        );
      } finally {
        setAuthBusy(false);
      }
    };

    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" hidden={false} translucent={false} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 24 }}
        >
        <View
          style={{ flex: 1, justifyContent: "center" }}
        >
          <Text
            style={{
              fontSize: 30,
              fontWeight: "800",
              color: "#FFFFFF",
              marginBottom: 8,
            }}
          >
            Bhumi Social AI
          </Text>
          <Text style={{ color: "#A8A8A8", marginBottom: 22 }}>
            Forgot password
          </Text>

          <View style={{ flexDirection: "row", marginBottom: 18 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: "#0095F6",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
                marginRight: 8,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Email</Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: "#1C1C1E",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#A8A8A8", fontWeight: "600" }}>
                Mobile (SMS unavailable)
              </Text>
            </View>
          </View>

          {forgotStep === "email" && (
            <>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                Registered email
              </Text>
              <TextInput
                value={forgotEmail}
                onChangeText={setForgotEmail}
                placeholder="अपना ईमेल लिखें (जरूरी नहीं)"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!authBusy}
                style={fieldStyle}
              />
              <TouchableOpacity
                onPress={() => forgotAction("request")}
                disabled={authBusy}
                style={{
                  backgroundColor: "#0095F6",
                  borderRadius: 8,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {authBusy ? "Please wait..." : "Send email code"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {forgotStep === "otp" && (
            <>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                Email verification code
              </Text>
              <TextInput
                value={forgotOtp}
                onChangeText={setForgotOtp}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                editable={!authBusy}
                style={fieldStyle}
              />
              <TouchableOpacity
                onPress={() => forgotAction("verify")}
                disabled={authBusy}
                style={{
                  backgroundColor: "#0095F6",
                  borderRadius: 8,
                  padding: 14,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {authBusy ? "Please wait..." : "Verify code"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => forgotAction("request")}
                disabled={authBusy}
                style={{ padding: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#0095F6" }}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}

          {forgotStep === "reset" && (
            <>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                New password (4 to 24 characters)
              </Text>
              <TextInput
                value={forgotNewPassword}
                onChangeText={setForgotNewPassword}
                placeholder="New password"
                secureTextEntry
                autoCapitalize="none"
                editable={!authBusy}
                style={fieldStyle}
              />
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                Confirm new password
              </Text>
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
                onPress={() => forgotAction("reset")}
                disabled={authBusy}
                style={{
                  backgroundColor: "#0095F6",
                  borderRadius: 8,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {authBusy ? "Please wait..." : "Set new password"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => {
              setAuthMode("login");
              setForgotStep("email");
            }}
            disabled={authBusy}
            style={{ padding: 16, alignItems: "center" }}
          >
            <Text style={{ color: "#0095F6" }}>Back to login</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }



  if (authReady && welcomeChecked && !authSession && !welcomeSeen) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
        <StatusBar style="light" hidden={false} translucent={false} />
        <View
          style={{
            flex: 1,
            paddingHorizontal: 28,
            paddingTop: 30,
            paddingBottom: 24,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ alignItems: "center", marginTop: 24 }}>
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 34,
                backgroundColor: "#1C1C1E",
                borderWidth: 1,
                borderColor: "#0095F6",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                marginBottom: 20,
              }}
            >
              <Image source={require("./assets/bhumi-social-ai-logo.jpg")} style={{ width: 96, height: 96, borderRadius: 28 }} resizeMode="contain" />
            </View>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 29,
                fontWeight: "800",
                textAlign: "center",
                letterSpacing: -0.5,
              }}
            >
              Bhumi Social AI
            </Text>
            <Text
              style={{
                color: "#A8A8A8",
                fontSize: 13,
                fontWeight: "700",
                letterSpacing: 3,
                marginTop: 9,
              }}
            >
              CONNECT · SHARE · DISCOVER
            </Text>
          </View>

          <View
            style={{ width: "100%", alignItems: "center", paddingVertical: 24 }}
          >
            <View
              style={{
                width: 190,
                height: 190,
                borderRadius: 95,
                backgroundColor: "#121212",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 28,
                borderWidth: 1,
                borderColor: "#363636",
              }}
            >
              <View
                style={{
                  width: 142,
                  height: 142,
                  borderRadius: 71,
                  backgroundColor: "#1C1C1E",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="people" size={70} color="#FFFFFF" />
                <View
                  style={{
                    position: "absolute",
                    right: 8,
                    bottom: 12,
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#0095F6",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 3,
                    borderColor: "#1C1C1E",
                  }}
                >
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={23}
                    color="#FFFFFF"
                  />
                </View>
              </View>
            </View>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 27,
                lineHeight: 34,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              Your world,{"\n"}your people.
            </Text>
            <Text
              style={{
                color: "#D1D1D1",
                fontSize: 15,
                lineHeight: 23,
                textAlign: "center",
                marginTop: 14,
              }}
            >
              Share your moments, discover Reels, and stay connected with your
              community.
            </Text>
          </View>

          <View style={{ width: "100%", gap: 12 }}>
            <TouchableOpacity
              onPress={() => finishWelcome("register")}
              activeOpacity={0.85}
              style={{
                backgroundColor: "#0095F6",
                borderRadius: 16,
                paddingVertical: 17,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}
              >
                Get Started
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => finishWelcome("login")}
              activeOpacity={0.85}
              style={{
                borderWidth: 1,
                borderColor: "#526782",
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}
              >
                Already have an account? Log In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!authSession) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" hidden={false} translucent={false} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-start", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }}
        >
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <Image source={require("./assets/bhumi-social-ai-logo.jpg")} style={{ width: 76, height: 76, marginBottom: 14 }} resizeMode="contain" accessibilityLabel="Bhumi Social AI logo" />
            <Text style={{ fontSize: 27, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.6 }}>Bhumi Social AI</Text>
            <Text style={{ color: "#A8A8A8", marginTop: 7, fontSize: 13 }}>
              {authMode === "register" ? "Create your account and connect" : "Welcome back. Sign in to continue."}
            </Text>
          </View>
          {authMode === "register" ? (
            <>
              <Text style={{ color: "#FFFFFF", fontWeight: "700", marginBottom: 9 }}>
                Choose account type
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {[
                  { key: "personal", title: "Personal", icon: "person-outline" },
                  { key: "creator", title: "Creator", icon: "videocam-outline" },
                  { key: "business", title: "Business", icon: "briefcase-outline" },
                ].map((item) => {
                  const active = authAccountType === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setAuthAccountType(item.key)}
                      disabled={authBusy}
                      style={{ flex: 1, minHeight: 76, paddingVertical: 12, paddingHorizontal: 5, borderRadius: 12, borderWidth: 1.5, borderColor: active ? "#0095F6" : "#262626", backgroundColor: active ? "rgba(216,184,106,0.14)" : "#121212", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name={item.icon} size={21} color={active ? "#0095F6" : "#A8A8A8"} />
                      <Text style={{ color: active ? "#0095F6" : "#FFFFFF", fontSize: 12, fontWeight: "800", marginTop: 5 }}>{item.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ color: "#A8A8A8", fontSize: 11, lineHeight: 16, marginBottom: 13 }}>
                Creator accounts are for public creator profiles. Business accounts unlock Business Studio after signup.
              </Text>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                पूरा नाम / Full Name
              </Text>
              <TextInput
                value={authFullName}
                onChangeText={setAuthFullName}
                placeholder="अपना पूरा नाम लिखें"
                autoCapitalize="words"
                editable={!authBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 10,
                  backgroundColor: "#121212",
                  padding: 13,
                  marginBottom: 12,
                  color: "#FFFFFF",
                }}
              />
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                Username (आपकी पसंद का)
              </Text>
              <TextInput
                value={authUsername}
                onChangeText={setAuthUsername}
                placeholder="अपना username खुद चुनें"
                maxLength={50}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authBusy}
                returnKeyType="next"
                style={{
                  borderWidth: 1,
                  borderColor: "#0095F6",
                  borderRadius: 10,
                  backgroundColor: "#121212",
                  padding: 15,
                  marginBottom: 6,
                  color: "#FFFFFF",
                  fontSize: 16,
                }}
              />
              <Text style={{ color: "#A8A8A8", fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
                यही आपका @username होगा। ऐप आपके लिए username नहीं बनाएगी। 3–50 अक्षर: English letters, numbers, dot (.) या underscore (_).
              </Text>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                ईमेल (वैकल्पिक) / Email
              </Text>
              <TextInput
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 8,
                  padding: 13,
                  marginBottom: 12,
                  color: "#FFFFFF",
                }}
              />
            </>
          ) : (
            <>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                Email or username
              </Text>
              <TextInput
                value={authUsername}
                onChangeText={setAuthUsername}
                placeholder="Email or username"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 8,
                  padding: 13,
                  marginBottom: 12,
                  color: "#FFFFFF",
                }}
              />
            </>
          )}
          {authMode === "register" && (
            <>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                मोबाइल नंबर (वैकल्पिक) / Mobile
              </Text>
              <TextInput
                value={authPhoneNumber}
                onChangeText={setAuthPhoneNumber}
                placeholder="अपना मोबाइल नंबर लिखें (जरूरी नहीं)"
                keyboardType="phone-pad"
                editable={!authBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 8,
                  padding: 13,
                  marginBottom: 12,
                  color: "#FFFFFF",
                }}
              />
            </>
          )}
          <Text
            style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
          >
            पासवर्ड (4 से 24 अक्षर) / Password
          </Text>
          <TextInput
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="पासवर्ड बनाएं"
            secureTextEntry
            autoCapitalize="none"
            editable={!authBusy}
            onSubmitEditing={submitAuth}
            style={{
              borderWidth: 1,
              borderColor: "#262626",
              borderRadius: 10,
              backgroundColor: "#121212",
              padding: 13,
              marginBottom: 16,
              color: "#FFFFFF",
            }}
          />
          {authMode === "register" && (
            <>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "600", marginBottom: 6 }}
              >
                पासवर्ड दोबारा लिखें / Confirm password
              </Text>
              <TextInput
                value={authConfirmPassword}
                onChangeText={setAuthConfirmPassword}
                placeholder="पासवर्ड फिर से लिखें"
                secureTextEntry
                autoCapitalize="none"
                editable={!authBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 8,
                  padding: 13,
                  marginBottom: 16,
                  color: "#FFFFFF",
                }}
              />
            </>
          )}
          <TouchableOpacity
            onPress={submitAuth}
            disabled={authBusy}
            style={{
              backgroundColor: "#0095F6",
              borderRadius: 10,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
              {authBusy
                ? "Please wait..."
                : authMode === "register"
                  ? "Create account"
                  : "Log in"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
            disabled={authBusy}
            style={{ padding: 16, alignItems: "center" }}
          >
            {authMode === "login" && (
              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(authEmail);
                  setForgotStep("email");
                  setAuthMode("forgot");
                }}
                disabled={authBusy}
                style={{ padding: 8, alignItems: "center" }}
              >
                <Text style={{ color: "#0095F6" }}>Forgot password?</Text>
              </TouchableOpacity>
            )}
            <Text style={{ color: "#0095F6" }}>
              {authMode === "login"
                ? "Create a new account"
                : "Already have an account? Log in"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const moveConversationFolder = async (conversation) => {
    const username = String(conversation?.username || "").trim();
    if (!username || chatFolderSaving) return;
    const currentFolder = String(conversation.folder || (conversation.isRequest ? "requests" : "primary")).toLowerCase();
    const nextFolder = currentFolder === "requests" ? "primary" : currentFolder === "general" ? "primary" : "general";
    setChatFolderSaving(username.toLowerCase());
    setChatError("");
    try {
      await updateMessageConversationFolder(username, nextFolder);
      setMessageConversations((current) => current.map((item) =>
        String(item.username || "").toLowerCase() === username.toLowerCase()
          ? { ...item, folder: nextFolder, isRequest: nextFolder === "requests" }
          : item
      ));
    } catch (error) {
      setChatError(error?.message || "Could not organize this conversation.");
    } finally {
      setChatFolderSaving("");
    }
  };

  const getVisibleMessageConversations = () => {
    const term = chatSearchQuery.trim().toLowerCase();
    return messageConversations.filter((conversation) => {
      const username = conversation.username || conversation.peer || conversation.otherUsername || conversation.user?.username || "";
      const folder = String(conversation.folder || conversation.inboxTab || conversation.category || "primary").toLowerCase();
      const requestStatus = String(conversation.requestStatus || "").toLowerCase();
      const isRequest = Boolean(conversation.isRequest) || ["pending", "requested"].includes(requestStatus) || folder === "requests";
      const friendKey = String(username).toLowerCase();
      if (chatFriendFilter === "Favourite" && !chatFriendPrefs["messages.favorite." + friendKey]) return false;
      if (chatFriendFilter === "Close" && !chatFriendPrefs["messages.closeFriend." + friendKey]) return false;
      if (chatInboxTab === "Requests" && !isRequest) return false;
      if ((chatInboxTab === "Primary" || chatInboxTab === "General") && folder !== chatInboxTab.toLowerCase()) return false;
      if (chatUnreadOnly && Number(conversation.unreadCount || 0) <= 0) return false;
      return !term ||
        String(username).toLowerCase().includes(term) ||
        String(conversation.displayName || "").toLowerCase().includes(term) ||
        String(conversation.lastMessage || "").toLowerCase().includes(term);
    });
  };

  const lightAppearance = appSettingsPreferences["appearance.theme"] === true;

  return (
    <SafeAreaView style={[styles.screen, lightAppearance && { backgroundColor: "#F7F7F7" }]}>
      <StatusBar style={lightAppearance ? "dark" : "light"} hidden={false} translucent={false} />
      <VoiceVideoCallControls username={selectedChatUser} currentUsername={authSession?.username} enableOutgoing={false} showButtons={false} />


      <Modal
        visible={liveCameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setLiveCameraOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 }}>
            <TouchableOpacity onPress={() => setLiveCameraOpen(false)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>Live</Text>
            <TouchableOpacity onPress={() => setCameraFacing(v => v === "back" ? "front" : "back")}>
              <Ionicons name="camera-reverse-outline" size={27} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, backgroundColor: "#111111" }}>
            <CameraView ref={liveCameraRef} style={{ flex: 1 }} facing={cameraFacing} mode="video" />
            <View style={{ position: "absolute", top: 16, left: 16, right: 16, gap: 10 }}>
              <TextInput value={liveLink} onChangeText={setLiveLink} placeholder="Add a link" placeholderTextColor="#BBBBBB" autoCapitalize="none" style={{ color: "#FFFFFF", backgroundColor: "rgba(25,25,25,0.88)", borderRadius: 12, padding: 14 }} />
              <TextInput value={liveTitle} onChangeText={setLiveTitle} placeholder="Add a title" placeholderTextColor="#BBBBBB" style={{ color: "#FFFFFF", backgroundColor: "rgba(25,25,25,0.88)", borderRadius: 12, padding: 14 }} />
              <View style={{ backgroundColor: "rgba(25,25,25,0.88)", borderRadius: 12, padding: 12 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "700", marginBottom: 10 }}>Audience</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["Public", "Followers", "Close Friends"].map(item => (
                    <TouchableOpacity key={item} onPress={() => setLiveAudience(item)} style={{ flex: 1, padding: 10, borderRadius: 20, alignItems: "center", backgroundColor: liveAudience === item ? "#1877F2" : "#444444" }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ position: "absolute", bottom: 22, left: 0, right: 0, alignItems: "center" }}>
              <TouchableOpacity onPress={() => Alert.alert("Live streaming unavailable", "A streaming server/provider must be connected before broadcasting can start.")} style={{ width: "88%", minHeight: 54, borderRadius: 28, backgroundColor: "#E53945", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Start Live</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={cameraOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (isRecording) cameraRef.current?.stopRecording();
          setCameraOpen(false);
          setRecordedVideo(null);
          setRecordedPhoto(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#090909", paddingBottom: Platform.OS === "android" ? 28 : 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (isRecording) cameraRef.current?.stopRecording();
                setCameraOpen(false);
                setRecordedVideo(null);
                setRecordedPhoto(null);
              }}
              style={{ padding: 8 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>
              {cameraTargetKind === "reels"
                ? "Create Reel"
                : cameraTargetKind === "stories"
                  ? "Create Story"
                  : "Create Post"}
            </Text>
            <TouchableOpacity
              onPress={() =>
                setCameraFacing((current) =>
                  current === "back" ? "front" : "back",
                )
              }
              disabled={isRecording || !!recordedVideo || !!recordedPhoto}
              style={{ padding: 8 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 15 }}>Flip</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              paddingVertical: 10,
              gap: 12,
            }}
          >
            {[
              { label: "Photo", value: "picture" },
              { label: "Video", value: "video" },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                disabled={
                  isRecording ||
                  !!recordedVideo ||
                  !!recordedPhoto ||
                  cameraTargetKind === "reels"
                }
                onPress={() => setCameraMode(option.value)}
                style={{
                  paddingHorizontal: 22,
                  paddingVertical: 9,
                  borderRadius: 22,
                  backgroundColor:
                    cameraMode === option.value ? "#1685D9" : "#292929",
                  opacity: cameraTargetKind === "reels" ? 0.55 : 1,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose photo or video from gallery"
            onPress={() => {
              const target = cameraTargetKind;
              setCameraOpen(false);
              setTimeout(() => chooseMedia(target, "camera-gallery"), 300);
            }}
            style={{
              marginHorizontal: 20,
              marginVertical: 8,
              minHeight: 48,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#202B3C",
              borderWidth: 1,
              borderColor: "#53647A",
              gap: 9,
            }}
          >
            <Ionicons name="images-outline" size={23} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
              Choose from Gallery
            </Text>
          </TouchableOpacity>
          <View
            style={{ flex: 1, backgroundColor: "#000000", overflow: "hidden" }}
          >
            {recordedPhoto ? (
              <Image
                source={{ uri: recordedPhoto }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            ) : recordedVideo ? (
              <ReelVideo key={recordedVideo} uri={recordedVideo} />
            ) : (
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                facing={cameraFacing}
                mode={cameraMode}
              />
            )}

            {cameraMode === "picture" && !recordedPhoto && !recordedVideo && (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: getPostPhotoFilter(postCameraFilterIndex).overlay,
                    opacity: getPostPhotoFilter(postCameraFilterIndex).opacity,
                  }}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 12,
                  }}
                  contentContainerStyle={{
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                  }}
                >
                  {POST_PHOTO_FILTERS.map((filter, index) => (
                    <TouchableOpacity
                      key={filter.name}
                      onPress={() => setPostCameraFilterIndex(index)}
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 7,
                        borderRadius: 16,
                        backgroundColor: postCameraFilterIndex === index
                          ? "#FFFFFF"
                          : "rgba(0,0,0,0.68)",
                        borderWidth: 1,
                        borderColor: postCameraFilterIndex === index ? "#FFFFFF" : "#777777",
                      }}
                    >
                      <Text
                        style={{
                          color: postCameraFilterIndex === index ? "#111111" : "#FFFFFF",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {filter.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          <View
            style={{
              minHeight: 112,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-evenly",
              paddingHorizontal: 16,
              paddingVertical: 18,
            }}
          >
            {recordedPhoto || recordedVideo ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setRecordedPhoto(null);
                    setRecordedPhotoAsset(null);
                    setRecordedVideo(null);
                  }}
                  style={{ padding: 14 }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 16 }}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={recordedPhoto ? useRecordedPhoto : useRecordedVideo}
                  style={{
                    backgroundColor: "#0095F6",
                    borderRadius: 24,
                    paddingHorizontal: 26,
                    paddingVertical: 13,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {recordedPhoto ? "Use Photo" : "Use Video"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : cameraMode === "picture" ? (
              <TouchableOpacity
                onPress={takeCameraPhoto}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 5,
                  borderColor: "#262626",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#000000",
                  }}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={
                  isRecording ? stopCameraRecording : startCameraRecording
                }
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 5,
                  borderColor: "#262626",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: isRecording ? 27 : 48,
                    height: isRecording ? 27 : 48,
                    borderRadius: isRecording ? 6 : 24,
                    backgroundColor: "#E53945",
                  }}
                />
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
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "#000000",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: "#262626",
              display: mediaDraft?.kind === "stories" ? "none" : "flex",
            }}
          >
            <TouchableOpacity
              onPress={cancelDraftMedia}
              style={{ paddingVertical: 8, paddingRight: 12 }}
            >
              <Text style={{ color: "#0095F6", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700" }}>
              {mediaDraft?.kind === "stories"
                ? "Edit Story"
                : mediaDraft?.kind === "reels"
                  ? "New Reel"
                  : "New Post"}
            </Text>
            <View style={{ width: 54 }} />
          </View>

          {mediaDraft &&
            (() => {
              const assets = mediaDraft.assets || [];
              const asset = assets[mediaDraftIndex];
              if (!asset) return null;
              const isVideo =
                asset.type === "video" ||
                /\.(mp4|mov|webm)(\?|$)/i.test(asset.uri || "");

              if (mediaDraft.kind === "stories") {
                return (
                  <View style={{ flex: 1, backgroundColor: "#000000" }}>
                    <View
                      style={{
                        flex: 1,
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: "#000000",
                      }}
                    >
                      {isVideo ? (
                        <ReelVideo
                          uri={asset.uri}
                          height={Dimensions.get("window").height}
                        />
                      ) : (
                        <Image
                          source={{ uri: asset.uri }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      )}

                      {isVideo && VIDEO_FILTER_PREVIEW_STYLES[videoFilterIndex] ? (
                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            ...VIDEO_FILTER_PREVIEW_STYLES[videoFilterIndex],
                          }}
                        />
                      ) : null}
                      {!isVideo ? (
                        <View style={{ position: "absolute", top: 14, right: 14, alignItems: "center", gap: 10 }}>
                          <TouchableOpacity disabled={busy} onPress={openMusicOptions} style={{ width: 48, height: 48, borderRadius: 17, borderWidth: 1, borderColor: "#7CC4FF", backgroundColor: "rgba(18,18,18,0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#0095F6", shadowOpacity: 0.55, shadowRadius: 10, elevation: 8 }}>
                            <Ionicons name="musical-notes" size={22} color="#FFFFFF" />
                          </TouchableOpacity>
                          {musicAsset ? (
                            <TouchableOpacity onPress={() => musicPlayerStatus.playing ? musicPlayer.pause() : musicPlayer.play()} style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: "rgba(18,18,18,0.94)", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center" }}>
                              <Ionicons name={musicPlayerStatus.playing ? "pause" : "play"} size={19} color="#FFFFFF" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : null}
                      {isVideo ? (
                        <View style={{ position: "absolute", top: 72, left: 10, right: 10, gap: 7 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 3 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                             <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>VIDEO FILTERS</Text>
                             <TouchableOpacity disabled={busy} onPress={() => {
                               setVideoFilterIndex(0); setVoiceEffect("Original");
                               setZoomEffectEnabled(false); setZoomEffectLevel(1.5); setZoomEffectDuration(3);
                               setMusicAsset(null); setMusicStart(0); setMusicVolume(0.8); setKeepOriginalAudio(true);
                               musicPlayer.pause();
                             }} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.78)", borderWidth: 1, borderColor: "#7CC4FF", flexDirection: "row", alignItems: "center", gap: 5 }}>
                               <Ionicons name="refresh-outline" size={13} color="#FFFFFF" />
                               <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>Reset all</Text>
                             </TouchableOpacity>
                           </View>
                           {VIDEO_FILTERS.map((filter, index) => {
                              const selected = videoFilterIndex === index;
                              return (
                                <TouchableOpacity key={filter.name} onPress={() => setVideoFilterIndex(index)} style={{ width: 60, height: 62, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: selected ? "rgba(0,149,246,0.22)" : "rgba(18,18,18,0.92)", borderWidth: 1, borderColor: selected ? "#7CC4FF" : "rgba(0,149,246,0.48)", shadowColor: "#0095F6", shadowOpacity: selected ? 0.5 : 0.16, shadowRadius: 8, elevation: selected ? 6 : 2 }}>
                                  <Ionicons name="color-filter-outline" size={20} color={selected ? "#7CC4FF" : "#0095F6"} />
                                  <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700", marginTop: 3 }}>{filter.name}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                            {VOICE_EFFECTS.map((effect) => {
                              const selected = voiceEffect === effect.name;
                              return (
                                <TouchableOpacity key={effect.name} onPress={() => setVoiceEffect(effect.name)} style={{ minWidth: 62, height: 54, paddingHorizontal: 7, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: selected ? "rgba(0,149,246,0.22)" : "rgba(18,18,18,0.92)", borderWidth: 1, borderColor: selected ? "#7CC4FF" : "rgba(0,149,246,0.48)" }}>
                                  <Ionicons name="mic-outline" size={19} color={selected ? "#7CC4FF" : "#0095F6"} />
                                  <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700", marginTop: 2 }}>{effect.name}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                          <TouchableOpacity onPress={() => setZoomEffectEnabled((value) => !value)} style={{ width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: zoomEffectEnabled ? "#7CC4FF" : "#0095F6", backgroundColor: "rgba(18,18,18,0.92)", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="scan-outline" size={21} color="#FFFFFF" />
                          </TouchableOpacity>
                          <TouchableOpacity disabled={busy} onPress={openMusicOptions} style={{ width: 46, height: 46, borderRadius: 16, borderWidth: 1, borderColor: "#7CC4FF", backgroundColor: "rgba(18,18,18,0.94)", alignItems: "center", justifyContent: "center", shadowColor: "#0095F6", shadowOpacity: 0.55, shadowRadius: 10, elevation: 8 }}>
                            <Ionicons name="musical-notes" size={22} color="#FFFFFF" />
                          </TouchableOpacity>
                          {musicAsset ? (
                            <TouchableOpacity onPress={() => musicPlayerStatus.playing ? musicPlayer.pause() : musicPlayer.play()} style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.65)" }}>
                              <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{musicPlayerStatus.playing ? "Pause Music Preview" : "Preview Music"}</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity onPress={() => setKeepOriginalAudio((value) => !value)} style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.65)" }}>
                            <Text style={{ color: "#FFFFFF", fontSize: 11 }}>{keepOriginalAudio ? "Original Sound: ON" : "Original Sound: OFF"}</Text>
                          </TouchableOpacity>
                          {musicAsset ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                              <TouchableOpacity onPress={() => setMusicVolume((value) => Math.max(0, Number((value - 0.1).toFixed(1))))} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.7)" }}>
                                <Text style={{ color: "#FFFFFF", fontSize: 11 }}>Music −</Text>
                              </TouchableOpacity>
                              <Text style={{ color: "#FFFFFF", fontSize: 11, textShadowColor: "#000000", textShadowRadius: 4 }}>{Math.round(musicVolume * 100)}%</Text>
                              <TouchableOpacity onPress={() => setMusicVolume((value) => Math.min(1, Number((value + 0.1).toFixed(1))))} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.7)" }}>
                                <Text style={{ color: "#FFFFFF", fontSize: 11 }}>Music +</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View style={{ position: "absolute", top: 72, left: 10, right: 10, gap: 8 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 3 }}>
                            {POST_PHOTO_FILTERS.map((filter, index) => {
                              const selected = Number(asset.photoFilterIndex || 0) === index;
                              return (
                                <TouchableOpacity key={filter.name} disabled={busy} onPress={() => handlePhotoEdit(`filter:${index}`)} style={{ width: 62, height: 62, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: selected ? "rgba(0,149,246,0.22)" : "rgba(18,18,18,0.88)", borderWidth: 1, borderColor: selected ? "#7CC4FF" : "rgba(0,149,246,0.48)", shadowColor: "#0095F6", shadowOpacity: selected ? 0.5 : 0.18, shadowRadius: 8, elevation: selected ? 6 : 2 }}>
                                  <Ionicons name="color-filter-outline" size={21} color={selected ? "#7CC4FF" : "#0095F6"} />
                                  <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700", marginTop: 3 }}>{filter.name}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={cancelDraftMedia}
                        disabled={busy}
                        style={{
                          position: "absolute",
                          top: 14,
                          left: 14,
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: "rgba(18,18,18,0.92)",
                          borderWidth: 1,
                          borderColor: "#0095F6",
                          shadowColor: "#0095F6",
                          shadowOpacity: 0.5,
                          shadowRadius: 12,
                          elevation: 8,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
                      </TouchableOpacity>

                      {!isVideo && (
                        <View
                          style={{
                            position: "absolute",
                            top: 72,
                            right: 12,
                            alignItems: "center",
                            gap: 13,
                          }}
                        >
                          {[
                            {
                              icon: "crop-outline",
                              action: "crop",
                              label: "Crop",
                            },
                            {
                              icon: "refresh-outline",
                              action: "rotate",
                              label: "Rotate",
                            },
                            {
                              icon: "swap-horizontal-outline",
                              action: "flip",
                              label: "Flip",
                            },
                            {
                              icon: "color-filter-outline",
                              action: "filter",
                              label: "Filter",
                            },
                            {
                              icon: "sunny-outline",
                              action: "brightness-up",
                              label: "Bright +",
                            },
                            {
                              icon: "moon-outline",
                              action: "brightness-down",
                              label: "Bright −",
                            },
                            {
                              icon: "contrast-outline",
                              action: "contrast-up",
                              label: "Contrast",
                            },
                            {
                              icon: "color-palette-outline",
                              action: "saturation-up",
                              label: "Saturation",
                            },
                            {
                              icon: "refresh-circle-outline",
                              action: "reset",
                              label: "Reset",
                            },
                          ].map((tool) => (
                            <TouchableOpacity
                              key={tool.action}
                              disabled={busy}
                              onPress={() => handlePhotoEdit(tool.action)}
                              style={{
                                width: 50,
                                height: 50,
                                borderRadius: 25,
                                backgroundColor: "rgba(18,18,18,0.94)",
                                borderWidth: 1,
                                borderColor: "#0095F6",
                                shadowColor: "#0095F6",
                                shadowOpacity: 0.5,
                                shadowRadius: 10,
                                elevation: 7,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons
                                name={tool.icon}
                                size={23}
                                color="#FFFFFF"
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View
                        style={{
                          position: "absolute",
                          left: 14,
                          right: 72,
                          bottom: 112,
                        }}
                      >
                        <TextInput
                          value={mediaDraftCaption}
                          onChangeText={setMediaDraftCaption}
                          placeholder="Add a caption..."
                          placeholderTextColor="rgba(255,255,255,0.8)"
                          multiline
                          maxLength={2200}
                          style={{
                            color: "#FFFFFF",
                            fontSize: 16,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            borderRadius: 22,
                            backgroundColor: "rgba(0,0,0,0.48)",
                            maxHeight: 100,
                          }}
                        />
                        {mentionSuggestionList}
                      </View>

                      <View
                        style={{
                          position: "absolute",
                          left: 12,
                          right: 12,
                          bottom: 24,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <TouchableOpacity
                          disabled={busy}
                          onPress={uploadDraftMedia}
                          style={{
                            flex: 1,
                            marginRight: 8,
                            height: 48,
                            borderRadius: 25,
                            backgroundColor: "#0095F6",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#121212",
                              fontSize: 14,
                              fontWeight: "700",
                            }}
                          >
                            Your story
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled
                          style={{
                            flex: 1,
                            marginHorizontal: 4,
                            height: 48,
                            borderRadius: 25,
                            backgroundColor: "rgba(255,255,255,0.25)",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.65,
                          }}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            Close Friends
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled={busy}
                          onPress={uploadDraftMedia}
                          style={{
                            width: 50,
                            height: 50,
                            marginLeft: 8,
                            borderRadius: 25,
                            backgroundColor: "#0095F6",
                            borderWidth: 1,
                            borderColor: "#7CC4FF",
                            shadowColor: "#0095F6",
                            shadowOpacity: 0.65,
                            shadowRadius: 12,
                            elevation: 9,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="sparkles" size={25} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 0 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View
                    style={{
                      height: Math.max(
                        360,
                        Dimensions.get("window").height - 190,
                      ),
                      width: "100%",
                      backgroundColor: "#080808",
                      justifyContent: "center",
                      alignItems: "center",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {isVideo ? (
                      <ReelVideo
                        uri={asset.uri}
                        height={Math.max(
                          360,
                          Dimensions.get("window").height - 190,
                        )}
                      />
                    ) : (
                      <Image
                        source={{ uri: asset.uri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    )}
                    {isVideo && VIDEO_FILTER_PREVIEW_STYLES[videoFilterIndex] ? (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          ...VIDEO_FILTER_PREVIEW_STYLES[videoFilterIndex],
                        }}
                      />
                    ) : null}
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 8,
                        right: 8,
                        flexDirection: "row",
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {!isVideo ? (
                        [
                          { label: "Crop", action: "crop" },
                          { label: "Rotate", action: "rotate" },
                          { label: "Flip", action: "flip" },
                          { label: "Filter", action: "filter" },
                          { label: "Brightness +", action: "brightness" },
                        ].map((tool) => (
                          <TouchableOpacity
                            key={tool.action}
                            disabled={busy}
                            onPress={() => handlePhotoEdit(tool.action)}
                            style={{
                              backgroundColor: "rgba(0,0,0,0.78)",
                              paddingVertical: 10,
                              paddingHorizontal: 11,
                              margin: 3,
                              borderRadius: 20,
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontWeight: "600",
                                fontSize: 12,
                              }}
                            >
                              {tool.label}
                            </Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <>
                          <TouchableOpacity
                            disabled={busy}
                            onPress={() => setZoomEffectEnabled((v) => !v)}
                            style={{
                              backgroundColor: "rgba(0,0,0,0.78)",
                              paddingVertical: 10,
                              paddingHorizontal: 13,
                              margin: 3,
                              borderRadius: 20,
                            }}
                          >
                            <Text
                              style={{ color: "#FFFFFF", fontWeight: "600" }}
                            >
                              {zoomEffectEnabled ? "Zoom ON" : "Zoom Effect"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={busy}
                            onPress={openMusicOptions}
                            style={{
                              backgroundColor: "rgba(0,0,0,0.78)",
                              paddingVertical: 10,
                              paddingHorizontal: 13,
                              margin: 3,
                              borderRadius: 20,
                            }}
                          >
                            <Text
                              style={{ color: "#FFFFFF", fontWeight: "600" }}
                            >
                              {musicAsset ? "Change Music" : "Choose Music"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {isVideo ? (
                        <View style={{ width: "100%", marginTop: 6, gap: 7 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
                            {VIDEO_FILTERS.map((filter, index) => (
                              <TouchableOpacity key={filter.name} onPress={() => setVideoFilterIndex(index)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: videoFilterIndex === index ? "#0095F6" : "rgba(0,0,0,0.78)" }}>
                                <Text style={{ color: videoFilterIndex === index ? "#121212" : "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{filter.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
                            {VOICE_EFFECTS.map((effect) => (
                              <TouchableOpacity key={effect.name} onPress={() => setVoiceEffect(effect.name)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: voiceEffect === effect.name ? "#0095F6" : "rgba(0,0,0,0.78)" }}>
                                <Text style={{ color: voiceEffect === effect.name ? "#121212" : "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{effect.name} Voice</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {!isVideo && (
                    <View style={{ paddingTop: 12, paddingBottom: 8 }}>
                      <Text style={{
                        color: "#FFFFFF",
                        fontSize: 13,
                        fontWeight: "700",
                        paddingHorizontal: 12,
                        paddingBottom: 8,
                      }}>
                        Filters
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 10, gap: 8 }}
                      >
                        {POST_PHOTO_FILTERS.map((filter, index) => {
                          const selected = Number(asset.photoFilterIndex ?? 0) === index;
                          return (
                            <TouchableOpacity
                              key={filter.name}
                              disabled={busy}
                              onPress={() => handlePhotoEdit(`filter:${index}`)}
                              style={{
                                minWidth: 76,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 16,
                                alignItems: "center",
                                backgroundColor: selected ? "#0095F6" : "#121212",
                                borderWidth: 1,
                                borderColor: selected ? "#7CC4FF" : "rgba(0,149,246,0.48)",
                                shadowColor: "#0095F6",
                                shadowOpacity: selected ? 0.55 : 0.12,
                                shadowRadius: selected ? 9 : 3,
                                elevation: selected ? 6 : 1,
                                opacity: busy ? 0.55 : 1,
                              }}
                            >
                              <Text style={{
                                color: selected ? "#FFFFFF" : "#E5E5E5",
                                fontSize: 12,
                                fontWeight: selected ? "700" : "500",
                              }}>
                                {filter.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                  {assets.length > 1 && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 12,
                      }}
                    >
                      <TouchableOpacity
                        disabled={mediaDraftIndex === 0}
                        onPress={() => {
                          setMediaDraftIndex((index) => Math.max(0, index - 1));
                          setZoomEffectEnabled(false);
                          setZoomEffectLevel(1.5);
                          setZoomEffectDuration(3);
                          setMusicAsset(null);
                          setMusicStart(0);
                        }}
                        style={{ padding: 10 }}
                      >
                        <Text style={{ color: "#0095F6", fontSize: 16 }}>
                          Previous
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ color: "#A8A8A8" }}>
                        {mediaDraftIndex + 1} / {assets.length}
                      </Text>
                      <TouchableOpacity
                        disabled={mediaDraftIndex >= assets.length - 1}
                        onPress={() => {
                          setMediaDraftIndex((index) =>
                            Math.min(assets.length - 1, index + 1),
                          );
                          setZoomEffectEnabled(false);
                          setZoomEffectLevel(1.5);
                          setZoomEffectDuration(3);
                          setMusicAsset(null);
                          setMusicStart(0);
                        }}
                        style={{ padding: 10 }}
                      >
                        <Text style={{ color: "#0095F6", fontSize: 16 }}>
                          Next
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TextInput
                    value={mediaDraftCaption}
                    onChangeText={setMediaDraftCaption}
                    placeholder="Write a caption..."
                    multiline
                    maxLength={2200}
                    style={{
                      minHeight: 48,
                      maxHeight: 110,
                      borderWidth: 1,
                      borderColor: "#262626",
                      borderRadius: 10,
                      padding: 12,
                      marginTop: 8,
                      color: "#FFFFFF",
                    }}
                  />
                  {mentionSuggestionList}
                  {isVideo && (
                    <View style={{ paddingTop: 10, paddingBottom: 8 }}>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={openMusicOptions}
                        style={{
                          padding: 11,
                          borderWidth: 1,
                          borderColor: "#262626",
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: "#0095F6", fontWeight: "600" }}>
                          {musicAsset
                            ? `Music: ${musicAsset.name || "Selected"} · Change Music`
                            : "♫ Choose Music File"}
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
                          style={{
                            marginTop: 8,
                            padding: 10,
                            borderWidth: 1,
                            borderColor: "#262626",
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: "#0095F6", fontWeight: "600" }}>
                            {musicPlayerStatus.playing
                              ? "Ⅱ Pause Music Preview"
                              : "▶ Preview Music"}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {musicAsset && (
                        <View style={{ paddingTop: 8 }}>
                          <Text style={{ color: "#FFFFFF" }}>
                            Music volume: {Math.round(musicVolume * 100)}%
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                setMusicVolume((v) =>
                                  Math.max(0, Number((v - 0.1).toFixed(1))),
                                )
                              }
                              style={{
                                padding: 10,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>−</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                setMusicVolume((v) =>
                                  Math.min(1, Number((v + 0.1).toFixed(1))),
                                )
                              }
                              style={{
                                padding: 10,
                                marginLeft: 8,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>＋</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                musicPlayer.pause();
                                setMusicAsset(null);
                                setMusicStart(0);
                              }}
                              style={{ padding: 10, marginLeft: 8 }}
                            >
                              <Text style={{ color: "#D93025" }}>
                                Remove Music
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={{ color: "#FFFFFF", paddingTop: 6 }}>
                            Music start: {musicStart}s
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                setMusicStart((v) => Math.max(0, v - 5))
                              }
                              style={{
                                padding: 10,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>−5s</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setMusicStart((v) => v + 5)}
                              style={{
                                padding: 10,
                                marginLeft: 8,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>＋5s</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            onPress={() => setKeepOriginalAudio((v) => !v)}
                            style={{ paddingVertical: 9 }}
                          >
                            <Text
                              style={{ color: "#0095F6", fontWeight: "600" }}
                            >
                              Original video audio:{" "}
                              {keepOriginalAudio ? "ON" : "OFF"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {mediaDraft.kind === "reels" && isVideo && (
                    <View style={{ paddingTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => setZoomEffectEnabled((v) => !v)}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: zoomEffectEnabled
                            ? "#0095F6"
                            : "#DDDDDD",
                        }}
                      >
                        <Text
                          style={{
                            color: zoomEffectEnabled ? "#0095F6" : "#333333",
                            fontWeight: "600",
                          }}
                        >
                          {zoomEffectEnabled
                            ? "Zoom Effect ON"
                            : "Enable Zoom Effect"}
                        </Text>
                      </TouchableOpacity>
                      {zoomEffectEnabled && (
                        <View style={{ paddingTop: 8 }}>
                          <Text style={{ color: "#FFFFFF" }}>
                            Zoom level: {zoomEffectLevel.toFixed(1)}x
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingTop: 6,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                setZoomEffectLevel((v) =>
                                  Math.max(1.2, Number((v - 0.1).toFixed(1))),
                                )
                              }
                              style={{
                                padding: 10,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>−</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                setZoomEffectLevel((v) =>
                                  Math.min(2.5, Number((v + 0.1).toFixed(1))),
                                )
                              }
                              style={{
                                padding: 10,
                                marginLeft: 8,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>＋</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={{ color: "#FFFFFF", paddingTop: 8 }}>
                            Effect duration: {zoomEffectDuration}s
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingTop: 6,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                setZoomEffectDuration((v) => Math.max(1, v - 1))
                              }
                              style={{
                                padding: 10,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>−</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                setZoomEffectDuration((v) =>
                                  Math.min(15, v + 1),
                                )
                              }
                              style={{
                                padding: 10,
                                marginLeft: 8,
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: "#0095F6" }}>＋</Text>
                            </TouchableOpacity>
                          </View>
                          <Text
                            style={{
                              color: "#A8A8A8",
                              fontSize: 12,
                              paddingTop: 6,
                            }}
                          >
                            The effect is processed before upload.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </ScrollView>
              );
            })()}
          <View
                    style={{
                      paddingHorizontal: 12,
                      paddingTop: 10,
                      paddingBottom: 22,
                      borderTopWidth: 1,
                      borderTopColor: "#262626",
                      backgroundColor: "#000000",
                      display: mediaDraft?.kind === "stories" ? "none" : "flex",
                    }}
                  >
                    <TouchableOpacity
                      disabled={busy}
                      onPress={uploadDraftMedia}
                      style={{
                        width: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 14,
                        backgroundColor: "#0095F6",
                        borderWidth: 1,
                        borderColor: "#0095F6",
                        borderRadius: 10,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                        {busy ? "Sharing..." : "Share"}
                      </Text>
                    </TouchableOpacity>
                  </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={musicSearchOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMusicSearchOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", padding: 16 }}>
          <View style={{ maxHeight: "88%", backgroundColor: "#151515", borderRadius: 22, borderWidth: 1, borderColor: "#343434", padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>Music Studio</Text>
                <Text style={{ color: "#999999", fontSize: 11, marginTop: 3 }}>Search · Library · Preview · Add to video</Text>
              </View>
              <TouchableOpacity onPress={() => setMusicSearchOpen(false)} style={{ padding: 5 }}>
                <Ionicons name="close-circle" size={26} color="#AAAAAA" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={musicSearchQuery}
              onChangeText={setMusicSearchQuery}
              placeholder="गाने या कलाकार का नाम लिखें"
              placeholderTextColor="#888888"
              returnKeyType="search"
              onSubmitEditing={searchMusicOnGoogle}
              style={{ color: "#FFFFFF", backgroundColor: "#242424", borderWidth: 1, borderColor: "#414141", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={searchMusicOnGoogle} disabled={musicSearchLoading} style={{ flex: 1, backgroundColor: "#1877F2", borderRadius: 11, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, opacity: musicSearchLoading ? 0.65 : 1 }}>
                {musicSearchLoading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="logo-google" size={17} color="#FFFFFF" />}
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>{musicSearchLoading ? "लोड हो रहा है..." : "Google Search"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={chooseMusicFile} disabled={musicSearchLoading} style={{ flex: 1, borderWidth: 1, borderColor: "#555555", borderRadius: 11, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, opacity: musicSearchLoading ? 0.65 : 1 }}>
                {musicSearchLoading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>{musicSearchLoading ? "सेव हो रहा है..." : "गाना जोड़ें"}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { id: "all", label: "All songs" },
                { id: "favorites", label: "Favorites" },
              ].map((item) => (
                <TouchableOpacity key={item.id} onPress={() => setMusicLibraryFilter(item.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: musicLibraryFilter === item.id ? "#303030" : "transparent", borderWidth: 1, borderColor: musicLibraryFilter === item.id ? "#777777" : "#3B3B3B" }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              <Text style={{ color: "#888888", fontSize: 11, alignSelf: "center", marginLeft: "auto" }}>{musicLibrary.length} saved</Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {!musicLibraryLoaded ? (
                <View style={{ padding: 24, alignItems: "center" }}><ActivityIndicator color="#FFFFFF" /><Text style={{ color: "#999999", marginTop: 8 }}>लाइब्रेरी लोड हो रही है...</Text></View>
              ) : searchLocalMusic(musicSearchQuery, musicLibrary.filter((track) => musicLibraryFilter === "favorites" ? track.favorite : true)).length ? (
                searchLocalMusic(musicSearchQuery, musicLibrary.filter((track) => musicLibraryFilter === "favorites" ? track.favorite : true)).map((track) => (
                  <View key={track.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#292929", gap: 9 }}>
                    <TouchableOpacity onPress={() => toggleMusicPreview(track)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#292929", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={musicPlayingId === track.id && musicPlayerStatus?.playing ? "pause" : "play"} size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => useMusicTrack(track)} style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>{track.title}</Text>
                      <Text numberOfLines={1} style={{ color: "#999999", fontSize: 11, marginTop: 2 }}>{track.artist || "Unknown artist"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleMusicFavorite(track)} hitSlop={8} style={{ padding: 5 }}>
                      <Ionicons name={track.favorite ? "heart" : "heart-outline"} size={19} color={track.favorite ? "#FF4D78" : "#AAAAAA"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => useMusicTrack(track)} hitSlop={8} style={{ padding: 5 }}>
                      <Ionicons name="checkmark-circle-outline" size={21} color="#38BDF8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteMusicLibraryTrack(track)} hitSlop={8} style={{ padding: 5 }}>
                      <Ionicons name="trash-outline" size={17} color="#888888" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={{ padding: 22, alignItems: "center" }}>
                  <Ionicons name="musical-notes-outline" size={30} color="#777777" />
                  <Text style={{ color: "#DDDDDD", fontWeight: "700", marginTop: 8 }}>अभी कोई गाना सेव नहीं है</Text>
                  <Text style={{ color: "#888888", fontSize: 11, textAlign: "center", marginTop: 4 }}>Google पर खोजें या अपनी अनुमति वाली ऑडियो फ़ाइल जोड़ें। सेव किए गाने अगली बार भी यहीं मिलेंगे।</Text>
                </View>
              )}
            </ScrollView>
            {musicAsset?.title || musicAsset?.name ? (
              <View style={{ backgroundColor: "#222222", borderRadius: 10, padding: 10 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>Selected: {musicAsset.title || musicAsset.name}</Text>
                <Text style={{ color: "#8CCBFF", fontSize: 11, marginTop: 3 }}>गाना एडिटर में जुड़ गया है</Text>
              </View>
            ) : null}
            <Text style={{ color: "#777777", fontSize: 10, lineHeight: 15 }}>Google Search वेब परिणाम खोलता है, सीधे ऑडियो स्ट्रीम नहीं। चुनी हुई फ़ाइल सुरक्षित रूप से ऐप की निजी Music Library में सेव होती है। Licensed streaming catalog बाद में इसी सिस्टम से जोड़ा जा सकेगा।</Text>
          </View>
        </View>
      </Modal>

      {activeTab !== "Reels" && activeTab !== "Home" && activeTab !== "Search" && renderAppHeader()}

      {activeTab !== "Reels" && !serverOnline && (
        <Text
          style={{
            paddingHorizontal: 12,
            paddingVertical: 4,
            color: "#888",
            fontSize: 11,
          }}
        >
          Server connection unavailable
        </Text>
      )}
      {activeTab !== "Reels" && busy && (
        <Text style={{ padding: 5, color: "#0095F6" }}>Uploading media…</Text>
      )}

      {activeTab === "Reels" ? (
        <View
          style={{ flex: 1, backgroundColor: "#000000" }}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            if (height > 0 && height !== reelViewportHeight)
              setReelViewportHeight(height);
          }}
        >
          {reels.length ? (
            <FlatList
              ref={reelListRef}
              data={reels}
              keyExtractor={(item, index) =>
                String(item.id || item.uri || index)
              }
              scrollEnabled={!reelZoomed}
              pagingEnabled
              snapToInterval={reelViewportHeight || undefined}
              snapToAlignment="start"
              decelerationRate="fast"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={5}
              removeClippedSubviews={false}
              getItemLayout={(_, index) => ({
                length: reelViewportHeight,
                offset: reelViewportHeight * index,
                index,
              })}
              scrollEventThrottle={16}
              onScroll={(event) => {
                if (reelViewportHeight > 0) {
                  const nextIndex = Math.max(
                    0,
                    Math.min(
                      Math.round(
                        event.nativeEvent.contentOffset.y / reelViewportHeight,
                      ),
                      reels.length - 1,
                    ),
                  );
                  setActiveReelIndex((current) =>
                    current === nextIndex ? current : nextIndex,
                  );
                }
              }}
              onMomentumScrollEnd={(event) => {
                if (reelViewportHeight > 0) {
                  const nextIndex = Math.round(
                    event.nativeEvent.contentOffset.y / reelViewportHeight,
                  );
                  setActiveReelIndex(
                    Math.max(0, Math.min(nextIndex, reels.length - 1)),
                  );
                }
              }}
              renderItem={({ item: r, index }) => {
                const id = Number(r.id);
                const hasServerId =
                  Number.isSafeInteger(id) && id > 0 && !r.isStarterReel;
                const username = String(r.user || r.username || "you").replace(
                  /^@/,
                  "",
                );
                const liked = reelLikeState[id] ?? !!r.isLiked;
                const saved = reelSavedState[id] ?? !!r.isSaved;
                const following = reelFollowState[username] ?? !!r.isFollowing;
                const rowHeight =
                  reelViewportHeight || Dimensions.get("window").height;
                return (
                  <View
                    style={{
                      width: "100%",
                      height: rowHeight,
                      backgroundColor: "#000000",
                      overflow: "hidden",
                    }}
                  >
                    {r.uri && Math.abs(index - activeReelIndex) <= 1 ? (
                      <ReelVideo
                        uri={r.uri}
                        height={rowHeight}
                        active={
                          activeTab === "Reels" &&
                          index === activeReelIndex &&
                          (appSettingsPreferences["feed.reelsAutoPlay"] !== false || manualReelPlay)
                        }
                        muted={mutedReels}
                        contentFit="cover"
                        zoomEnabled
                        onZoomChange={(level) => setReelZoomed(level > 1.01)}
                      />
                    ) : null}
                    {appSettingsPreferences["feed.reelsAutoPlay"] === false && !manualReelPlay && index === activeReelIndex ? (
                      <TouchableOpacity
                        onPress={() => setManualReelPlay(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Play reel"
                        style={{
                          position: "absolute",
                          top: "43%",
                          left: "43%",
                          width: 58,
                          height: 58,
                          borderRadius: 29,
                          backgroundColor: "rgba(0,0,0,0.55)",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 3,
                        }}
                      >
                        <Ionicons name="play" size={28} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                    <View
                      pointerEvents="box-none"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: "space-between",
                        paddingHorizontal: 15,
                        paddingTop: 15,
                        paddingBottom: 18,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "flex-end",
                        }}
                      >
                        {username.toLowerCase() === String(authSession?.username || "").toLowerCase() && hasServerId ? (
                          <TouchableOpacity onPress={() => requestDeleteContent("reels", r)} accessibilityLabel="Delete your reel" style={{ width: 42, height: 42, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                            <Ionicons name="trash-outline" size={20} color="#0095F6" />
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => setMutedReels((value) => !value)}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 22,
                            backgroundColor: "rgba(0,0,0,0.48)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          accessibilityLabel={
                            mutedReels ? "Unmute reel" : "Mute reel"
                          }
                        >
                          <Ionicons
                            name={mutedReels ? "volume-mute" : "volume-high"}
                            size={22}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      </View>
                      <View
                        style={{ flexDirection: "row", alignItems: "flex-end" }}
                      >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <TouchableOpacity
                            onPress={() => openUserProfile(username)}
                            style={{
                              alignSelf: "flex-start",
                              paddingVertical: 7,
                            }}
                          >
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 16,
                                fontWeight: "800",
                              }}
                            >
                              @{username}
                            </Text>
                          </TouchableOpacity>
                          {!!r.caption && (
                            <Text
                              numberOfLines={3}
                              style={{
                                color: "#FFFFFF",
                                fontSize: 14,
                                lineHeight: 20,
                                textShadowColor: "#000000",
                                textShadowRadius: 5,
                              }}
                            >
                              {r.caption}
                            </Text>
                          )}
                          {username !== (authSession?.username || "you") && (
                            <TouchableOpacity
                              disabled={
                                !hasServerId ||
                                !!reelBusyState[`follow-${username}`]
                              }
                              onPress={() => handleReelFollow(r)}
                              style={{
                                marginTop: 10,
                                alignSelf: "flex-start",
                                borderWidth: 1,
                                borderColor: "#262626",
                                borderRadius: 8,
                                paddingHorizontal: 14,
                                paddingVertical: 7,
                                opacity: hasServerId ? 1 : 0.55,
                              }}
                            >
                              <Text
                                style={{
                                  color: "#FFFFFF",
                                  fontWeight: "800",
                                  fontSize: 12,
                                }}
                              >
                                {r.followRequestStatus === "pending"
                                  ? "Requested"
                                  : following
                                    ? "Following"
                                    : "Follow"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View
                          style={{
                            alignItems: "center",
                            gap: 22,
                            paddingBottom: 4,
                          }}
                        >
                          <TouchableOpacity
                            disabled={!hasServerId || !!reelBusyState[id]}
                            onPress={() => handleReelLike(r)}
                            style={{ alignItems: "center" }}
                          >
                            <Ionicons
                              name={liked ? "heart" : "heart-outline"}
                              size={31}
                              color={liked ? "#FF3158" : "#FFFFFF"}
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              {r.likesCount ?? r.likes ?? "0"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleOpenReelComments(r)}
                            style={{ alignItems: "center" }}
                          >
                            <Ionicons
                              name="chatbubble-outline"
                              size={28}
                              color="#FFFFFF"
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              {Number(r.commentsCount || 0)}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleReelShare(r)}
                            style={{ alignItems: "center" }}
                          >
                            <Ionicons
                              name="paper-plane-outline"
                              size={28}
                              color="#FFFFFF"
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              Share
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={
                              !hasServerId || !!reelBusyState[`save-${id}`]
                            }
                            onPress={() => handleReelSave(r)}
                            style={{ alignItems: "center" }}
                          >
                            <Ionicons
                              name={saved ? "bookmark" : "bookmark-outline"}
                              size={28}
                              color="#FFFFFF"
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              Save
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleReelDownload(r)}
                            style={{ alignItems: "center" }}
                          >
                            <Ionicons
                              name="download-outline"
                              size={28}
                              color="#FFFFFF"
                            />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              Download
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                padding: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF" }}>No reels yet.</Text>
              <TouchableOpacity onPress={createReel} style={{ padding: 14 }}>
                <Text style={{ color: "#0095F6", fontWeight: "700" }}>
                  Upload Reel
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : activeTab === "Home" ? (
        <View style={[styles.content, { flex: 1 }]}>
          {/* Keep the Instagram-style top bar fixed; only stories and feed content scroll. */}
          {renderAppHeader()}
            <FlatList
              ListHeaderComponent={
                <View
                  onLayout={(event) => {
                    const height = event.nativeEvent.layout.height;
                    if (height > 0 && height !== feedHeaderHeight) {
                      setFeedHeaderHeight(height);
                    }
                  }}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stories}
                  >
                    {(() => {
                      const ownGroup = groupedStories.find(
                        (group) => group.own,
                      );
                      return (
                        <View style={{ width: 68, alignItems: "center" }}>
                          <Story
                            item={{
                              name: "Your story",
                              color: "#DDE7F5",
                              own: true,
                              uri: profile?.avatarUrl,
                            }}
                            onPress={() => {
                              if (ownGroup) openStoryGroup(ownGroup.items);
                              else createStory();
                            }}
                          />
                          <TouchableOpacity
                            onPress={createStory}
                            accessibilityLabel="Add Status"
                            style={{
                              position: "absolute",
                              right: 0,
                              bottom: 17,
                              width: 23,
                              height: 23,
                              borderRadius: 12,
                              backgroundColor: "#1C1C1E",
                              borderWidth: 2,
                              borderColor: "#303030",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="add" size={17} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                    {groupedStories
                      .filter((group) => !group.own)
                      .map((group) => (
                        <Story
                          key={group.key}
                          item={{
                            ...group.items[0],
                            name: group.name,
                            own: false,
                          }}
                          onPress={() => openStoryGroup(group.items)}
                        />
                      ))}

                  </ScrollView>
                  <View style={styles.feedDivider} />
                </View>
              }
              onLayout={(event) => {
                const height = event.nativeEvent.layout.height;
                if (height > 0 && height !== feedViewportHeight)
                  setFeedViewportHeight(height);
              }}
              data={groupPostItems(feedPosts)}
              keyExtractor={(item, index) =>
                String(item.groupId || item.id || `${item.user}-${index}`)
              }
              style={{ flex: 1 }}
              decelerationRate="normal"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
              getItemLayout={
                feedViewportHeight > 0
                  ? (_, index) => ({
                      length: feedViewportHeight,
                      offset: feedHeaderHeight + feedViewportHeight * index,
                      index,
                    })
                  : undefined
              }
              scrollEventThrottle={16}
              onScroll={(event) => {
                if (feedViewportHeight > 0) {
                  const count = groupPostItems(feedPosts).length;
                  const nextIndex = Math.max(
                    0,
                    Math.min(
                      Math.round(
                        (event.nativeEvent.contentOffset.y - feedHeaderHeight) / feedViewportHeight,
                      ),
                      Math.max(0, count - 1),
                    ),
                  );
                  setActiveFeedIndex((current) =>
                    current === nextIndex ? current : nextIndex,
                  );
                }
              }}
              onMomentumScrollEnd={(event) => {
                if (feedViewportHeight > 0) {
                  const count = groupPostItems(feedPosts).length;
                  const nextIndex = Math.round(
                    (event.nativeEvent.contentOffset.y - feedHeaderHeight) /
                      feedViewportHeight,
                  );
                  setActiveFeedIndex(
                    Math.max(0, Math.min(nextIndex, Math.max(0, count - 1))),
                  );
                }
              }}
              renderItem={({ item: post, index }) => (
                <PostCard
                  key={post.groupId || post.id || `${post.user}-${index}`}
                  post={{
                    ...post,
                    avatarUrl:
                      (post.user || "you") === "you"
                        ? profile?.avatarUrl || post.avatarUrl
                        : post.avatarUrl,
                  }}
                  authSession={authSession}
                  onOpenProfile={(username) => {
                    if (username && String(username).toLowerCase() !== String(authSession?.username || "").toLowerCase()) openUserProfile(username);
                    else setActiveTab("Profile");
                  }}
                  onDelete={(item, kind) => requestDeleteContent(kind, item)}
                  pageHeight={feedViewportHeight}
                  active={activeTab === "Home" && index === activeFeedIndex}
                  autoPlay={appSettingsPreferences["feed.autoPlay"] !== false}
                  onOpen={() => {
                    setSelectedPostMediaIndex(0);
                    setSelectedPost(post);
                  }}
                  onCreateAction={(action) => {
                    if (action === "live-camera") openLiveCamera();
  else if (action === "reel-camera") openReelCamera();
                    else if (action === "reel-photos") createReelFromPhotos();
                    else if (action === "photo-post")
                      openCaptureCamera("posts", "picture");
                    else if (action === "video-post")
                      openCaptureCamera("posts", "video");
                    else if (action === "story-camera")
                      openCaptureCamera("stories", "picture");
                    else if (action === "story-gallery") createStory();
                    else if (action === "post-gallery") pickImage();
                  }}
                />
              )}
              ListEmptyComponent={
                <View
                  style={{
                    flex: 1,
                    minHeight: 260,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#A8A8A8" }}>No posts yet.</Text>
                </View>
              }
            />
        </View>
      ) : activeTab === "Search" ? (
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 30 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1C1C1E",
              borderRadius: 12,
              paddingHorizontal: 14,
              marginBottom: 18,
              borderWidth: 0,
              borderColor: "transparent",
            }}
          >
            <Ionicons name="search-outline" size={20} color="#737373" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search people by name or username"
              placeholderTextColor="#737373"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 10,
                color: "#F5F5F5",
                fontSize: 15,
              }}
            />
            {!!searchQuery && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color="#737373" />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.trim().length < 2 ? (
            <View style={{ paddingTop: 8 }}>
              <Text style={{ color: "#F5F5F5", fontSize: 18, fontWeight: "800", marginBottom: 12 }}>Explore</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 3 }}>
                {groupPostItems(feedPosts).slice(0, 18).map((post, index) => {
                  const media = post.mediaItems?.[0] || post;
                  const uri = media.uri || post.uri || media.mediaUrl || post.mediaUrl;
                  return (
                    <TouchableOpacity key={post.groupId || post.id || `explore-${index}`} activeOpacity={0.88}
                      onPress={() => { setSelectedPostMediaIndex(0); setSelectedPost(post); }}
                      style={{ width: "33%", aspectRatio: 1, marginBottom: 2, backgroundColor: "#121212", overflow: "hidden" }}>
                      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> :
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Ionicons name="image-outline" size={26} color="#0095F6" /></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!feedPosts.length ? <Text style={{ color: "#A8A8A8", textAlign: "center", paddingVertical: 20 }}>Posts from the community will appear here.</Text> : null}
            </View>
          ) : searchLoading ? (
            <Text style={{ color: "#A8A8A8", paddingVertical: 12 }}>
              Searching...
            </Text>
          ) : searchError ? (
            <Text style={{ color: "#B42318", paddingVertical: 12 }}>
              {searchError}
            </Text>
          ) : searchResults.length === 0 ? (
            <Text style={{ color: "#A8A8A8", paddingVertical: 12 }}>
              No users found.
            </Text>
          ) : (
            searchResults.map((item) => (
              <View
                key={item.username}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderBottomColor: "#303030",
                }}
              >
                <TouchableOpacity
                  onPress={() => openUserProfile(item.username)}
                  activeOpacity={0.75}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  {item.avatarUrl ? (
                    <Image
                      source={{
                        uri: item.avatarUrl.startsWith("http")
                          ? item.avatarUrl
                          : "https://bhumi-social-app-1.onrender.com" +
                            item.avatarUrl,
                      }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: "#E4EAF4",
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: "#262626",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontSize: 20,
                          fontWeight: "700",
                        }}
                      >
                        {(item.displayName || item.username || "U")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: "#F5F5F5",
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {item.displayName || item.username}
                    </Text>
                    <Text
                      style={{ color: "#A8A8A8", fontSize: 13, marginTop: 3 }}
                    >
                      @{item.username}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#999999" />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!!searchFollowBusy[item.username]}
                  onPress={async () => {
                    const username = item.username;
                    if (!username || username === authSession?.username) return;
                    setSearchFollowBusy((prev) => ({
                      ...prev,
                      [username]: true,
                    }));
                    try {
                      const currentlyFollowing = !!item.isFollowing;
                      const requestPending =
                        item.followRequestStatus === "pending";
                      const result =
        currentlyFollowing || requestPending
          ? await unfollowProfile(username)
          : await followProfile(username);
                      const status =
                        result?.status ||
                        (currentlyFollowing || requestPending ? "not_following" : "following");
                      setSearchResults((prev) =>
                        prev.map((user) =>
                          user.username === username
                            ? {
                                ...user,
                                isFollowing: status === "following",
                                followRequestStatus:
                                  status === "requested"
                                    ? "pending"
                                    : status === "following"
                                      ? ""
                                      : "",
                              }
                            : user,
                        ),
                      );
                      Alert.alert(
                        status === "requested"
                          ? "Request sent"
                          : status === "following"
                            ? "Following"
                            : "Updated",
                        status === "requested"
                          ? "Private account follow request भेज दी गई।"
                          : status === "following"
                            ? "अब आप इस user को follow कर रहे हैं।"
                            : requestPending
                              ? "Follow request cancel कर दी गई।"
                              : "Follow हट गया।",
                      );
                    } catch (e) {
                      Alert.alert(
                        "Follow नहीं हुआ",
                        e.message || "फिर से कोशिश करें।",
                      );
                    } finally {
                      setSearchFollowBusy((prev) => ({
                        ...prev,
                        [username]: false,
                      }));
                    }
                  }}
                  activeOpacity={0.8}
                  style={{
                    marginLeft: 8,
                    minWidth: 88,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: item.isFollowing
                      ? "#F1F1F1"
                      : item.followRequestStatus === "pending"
                        ? "#F1F1F1"
                        : "#246BFD",
                    opacity: searchFollowBusy[item.username] ? 0.55 : 1,
                  }}
                >
                  <Text
                    style={{
                      color:
                        item.isFollowing ||
                        item.followRequestStatus === "pending"
                          ? "#333333"
                          : "#262626",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {searchFollowBusy[item.username]
                      ? "..."
                      : item.isFollowing
                        ? "Following"
                        : item.followRequestStatus === "pending"
                          ? "Requested"
                          : item.followsYou
                            ? "Follow Back"
                            : "Follow"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      ) : activeTab === "Profile" ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {!profile ? (
            <Text style={{ color: "#A8A8A8", textAlign: "center", padding: 24 }}>
              
            </Text>
          ) : (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 20,
                  padding: 2,
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: "transparent",
                  borderRadius: 0,
                  elevation: 0,
                }}
              >
                <TouchableOpacity
                  onPress={chooseProfilePhoto}
                  disabled={profileBusy}
                >
                  <View
                    style={{
                      width: 86,
                      height: 86,
                      borderRadius: 43,
                      borderWidth: 3,
                      borderColor: "#0095F6",
                      padding: 2,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {profile.avatarUrl ? (
                      <Image
                        source={{ uri: profile.avatarUrl }}
                        onError={(e) =>
                          console.log(
                            "PROFILE_AVATAR_IMAGE_ERROR:",
                            profile.avatarUrl,
                            e.nativeEvent?.error,
                          )
                        }
                        onLoad={() =>
                          console.log(
                            "PROFILE_AVATAR_IMAGE_LOADED:",
                            profile.avatarUrl,
                          )
                        }
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: "#DDE7F5",
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: "#262626",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#F5F5F5",
                            fontSize: 32,
                            fontWeight: "700",
                          }}
                        >
                          {(profile.displayName || "Y").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 12,
                      textAlign: "center",
                      marginTop: 5,
                    }}
                  >
                    Change Photo
                  </Text>
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 21,
                      fontWeight: "800",
                    }}
                  >
                    {profile.displayName || "you"}
                  </Text>
                  <Text
                    style={{ color: "#A8A8A8", marginTop: 5, fontSize: 13 }}
                  >
                    @{profile.username || "you"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 15,
                    }}
                  >
                    <View style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontWeight: "900",
                          fontSize: 18,
                        }}
                      >
                        {profile.postsCount ?? 0}
                      </Text>
                      <Text style={{ color: "#A8A8A8", fontSize: 11 }}>
                        Posts
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => showProfileConnections("followers")}
                      style={{ alignItems: "center" }}
                    >
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontWeight: "900",
                          fontSize: 18,
                        }}
                      >
                        {profile.followersCount ?? 0}
                      </Text>
                      <Text style={{ color: "#A8A8A8", fontSize: 11 }}>
                        Followers
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => showProfileConnections("following")}
                      style={{ alignItems: "center" }}
                    >
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontWeight: "900",
                          fontSize: 18,
                        }}
                      >
                        {profile.followingCount ?? 0}
                      </Text>
                      <Text style={{ color: "#A8A8A8", fontSize: 11 }}>
                        Following
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {!profileEditing ? (
                <View
                  style={{
                    marginBottom: 18,
                    padding: 12,
                    borderBottomWidth: 1,
                    borderColor: "#303030",
                    borderRadius: 0,
                  }}
                >
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 15,
                      fontWeight: "800",
                      marginBottom: 10,
                    }}
                  >
                    Your Status
                  </Text>
                  {(() => {
                    const ownStoryGroup = groupedStories.find(
                      (group) => group.own,
                    );
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        {ownStoryGroup ? (
                          <Story
                            item={{
                              ...ownStoryGroup.items[0],
                              name: "Your story",
                              own: true,
                            }}
                            onPress={() => openStoryGroup(ownStoryGroup.items)}
                          />
                        ) : null}
                        <TouchableOpacity
                          onPress={createStory}
                          accessibilityLabel="Add Status"
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 20,
                            backgroundColor: "#1C1C1E",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Ionicons
                            name="add-circle"
                            size={18}
                            color="#0095F6"
                          />
                          <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>
                            Add Status
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </View>
              ) : null}

              {!!profile.bio && (
                <Text
                  style={{
                    color: "#F5F5F5",
                    marginBottom: 20,
                    lineHeight: 23,
                    fontSize: 14,
                  }}
                >
                  {profile.bio}
                </Text>
              )}

              {profile.accountType === "business" && profile.businessProfile && (
                <View style={{ backgroundColor: "#121212", borderWidth: 1, borderColor: "#303030", borderRadius: 14, padding: 15, marginBottom: 18 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
                    <Ionicons name="business" size={20} color="#0095F6" />
                    <Text style={{ color: "#0095F6", fontWeight: "900", fontSize: 16, marginLeft: 8 }}>
                      {profile.businessProfile.businessName || "Business"}
                    </Text>
                    <View style={{ marginLeft: 8, borderWidth: 1, borderColor: "#303030", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: "#0095F6", fontSize: 9, fontWeight: "800" }}>BUSINESS</Text>
                    </View>
                  </View>
                  {!!profile.businessProfile.category && <Text style={{ color: "#A8A8A8", fontSize: 12, marginBottom: 6 }}>{profile.businessProfile.category}</Text>}
                  {!!profile.businessProfile.description && <Text style={{ color: "#F5F5F5", fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{profile.businessProfile.description}</Text>}
                  {!!(profile.businessProfile.area || profile.businessProfile.city || profile.businessProfile.state) && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                      <Ionicons name="location" size={15} color="#0095F6" />
                      <Text style={{ color: "#A8A8A8", fontSize: 12, marginLeft: 6 }}>
                        {[profile.businessProfile.area, profile.businessProfile.city, profile.businessProfile.state, profile.businessProfile.pincode].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  )}
                  {!!profile.businessProfile.serviceAreas && <Text style={{ color: "#A8A8A8", fontSize: 12, marginBottom: 5 }}>Serving: {profile.businessProfile.serviceAreas}</Text>}
                  {!!profile.businessProfile.serviceRadiusKm && <Text style={{ color: "#A8A8A8", fontSize: 12, marginBottom: 5 }}>Service radius: {profile.businessProfile.serviceRadiusKm} km</Text>}
                  {!!profile.businessProfile.address && <Text style={{ color: "#A8A8A8", fontSize: 12, marginBottom: 5 }}>Address: {profile.businessProfile.address}</Text>}
                  {!!profile.businessProfile.openingHours && <Text style={{ color: "#A8A8A8", fontSize: 12 }}>Hours: {profile.businessProfile.openingHours}</Text>}
                  {!!profile.businessProfile.phone && <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 6 }}>Phone: {profile.businessProfile.phone}</Text>}
                  {!!profile.businessProfile.whatsapp && <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 3 }}>WhatsApp: {profile.businessProfile.whatsapp}</Text>}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
                    {!!profile.businessProfile.phone && (
                      <TouchableOpacity onPress={() => Linking.openURL("tel:" + profile.businessProfile.phone.replace(/[^0-9+]/g, ""))} style={{ backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#303030", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="call" size={14} color="#0095F6" />
                        <Text style={{ color: "#F5F5F5", fontSize: 11, marginLeft: 5 }}>Call</Text>
                      </TouchableOpacity>
                    )}
                    {!!profile.businessProfile.whatsapp && (
                      <TouchableOpacity onPress={() => Linking.openURL("https://wa.me/" + profile.businessProfile.whatsapp.replace(/[^0-9]/g, ""))} style={{ backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#303030", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="logo-whatsapp" size={14} color="#0095F6" />
                        <Text style={{ color: "#F5F5F5", fontSize: 11, marginLeft: 5 }}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                    {!!profile.businessProfile.email && (
                      <TouchableOpacity onPress={() => Linking.openURL("mailto:" + profile.businessProfile.email)} style={{ backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#303030", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="mail" size={14} color="#0095F6" />
                        <Text style={{ color: "#F5F5F5", fontSize: 11, marginLeft: 5 }}>Email</Text>
                      </TouchableOpacity>
                    )}
                    {!!profile.businessProfile.website && (
                      <TouchableOpacity onPress={() => Linking.openURL(/^https?:\/\//i.test(profile.businessProfile.website) ? profile.businessProfile.website : "https://" + profile.businessProfile.website)} style={{ backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#303030", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="globe-outline" size={14} color="#0095F6" />
                        <Text style={{ color: "#F5F5F5", fontSize: 11, marginLeft: 5 }}>Website</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!profile.businessCatalog?.length && (
                    <View style={{ borderTopWidth: 1, borderTopColor: "#262626", marginTop: 11, paddingTop: 10 }}>
                      <Text style={{ color: "#0095F6", fontWeight: "900", marginBottom: 6 }}>Products & Services</Text>
                      {profile.businessCatalog.slice(0, 5).map((item) => (
                        <View key={item.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#303030" }}>
                          <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>{item.title} {item.price ? "· " + item.price : ""}</Text>
                          {!!item.description && <Text numberOfLines={2} style={{ color: "#A8A8A8", fontSize: 11, marginTop: 2 }}>{item.description}</Text>}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {profileEditing ? (
                <View>
                  <Text style={{ color: "#F5F5F5", marginBottom: 5 }}>
                    Display Name
                  </Text>
                  <TextInput
                    value={profileDraft.displayName}
                    onChangeText={(v) =>
                      setProfileDraft((d) => ({ ...d, displayName: v }))
                    }
                    maxLength={60}
                    placeholder="Display Name"
                    style={{
                      borderWidth: 1,
                      borderColor: "#303030",
                      borderRadius: 12,
                      padding: 11,
                      color: "#F5F5F5",
                      marginBottom: 12,
                    }}
                  />
                  <Text style={{ color: "#A8A8A8", marginBottom: 5 }}>
                    Username (स्थायी)
                  </Text>
                  <Text style={{ color: "#A8A8A8", paddingVertical: 10 }}>
                    @{profile.username || "you"}
                  </Text>
                  <Text style={{ color: "#A8A8A8", marginBottom: 5 }}>Bio</Text>
                  <TextInput
                    value={profileDraft.bio}
                    onChangeText={(v) =>
                      setProfileDraft((d) => ({ ...d, bio: v }))
                    }
                    maxLength={300}
                    multiline
                    placeholder="Write about yourself"
                    style={{
                      borderWidth: 1,
                      borderColor: "#303030",
                      borderRadius: 8,
                      padding: 11,
                      minHeight: 80,
                      color: "#F5F5F5",
                      marginBottom: 12,
                      textAlignVertical: "top",
                    }}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity
                      onPress={saveProfile}
                      disabled={profileBusy}
                      style={{
                        backgroundColor: "#0095F6",
                        borderWidth: 1,
                        borderColor: "#0095F6",
                        paddingVertical: 13,
                        paddingHorizontal: 24,
                        borderRadius: 13,
                        marginRight: 10,
                      }}
                    >
                      <Text style={{ color: "#FFF", fontWeight: "700" }}>
                        {profileBusy ? "Saving…" : "Save"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setProfileDraft({
                          displayName: profile.displayName || "you",
                          bio: profile.bio || "",
                        });
                        setProfileEditing(false);
                      }}
                      style={{ padding: 12 }}
                    >
                      <Text style={{ color: "#A8A8A8" }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setProfileEditing(true)}
                    style={{
                      borderWidth: 1,
                      borderColor: "#0095F6",
                      borderRadius: 14,
                      backgroundColor: "#0095F6",
                      paddingVertical: 13,
                      paddingHorizontal: 24,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                      Edit Profile
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Share.share({ message: `Follow @${profile.username || authSession?.username || "me"} on Bhumi Social AI.` })}
                    style={{
                      borderWidth: 1,
                      borderColor: "#303030",
                      borderRadius: 14,
                      backgroundColor: "#1C1C1E",
                      paddingVertical: 13,
                      paddingHorizontal: 18,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: "#F5F5F5", fontWeight: "800" }}>Share Profile</Text>
                  </TouchableOpacity>
                  {!!profile.avatarUrl && (
                    <TouchableOpacity
                      onPress={removeProfilePhoto}
                      disabled={profileBusy}
                      style={{
                        borderWidth: 1,
                        borderColor: "#9A4054",
                        borderRadius: 14,
                        backgroundColor: "#35191D",
                        paddingVertical: 13,
                        paddingHorizontal: 16,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: "#BE3548", fontWeight: "700" }}>
                        Remove Photo
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View
                style={{
                  height: 1,
                  backgroundColor: "#262626",
                  marginTop: 18,
                  marginBottom: 14,
                }}
              />
              <View
                style={{
                  marginTop: 18,
                  marginBottom: 16,
                  padding: 15,
                  borderWidth: 1,
                  borderColor: "#303030",
                  borderRadius: 17,
                  backgroundColor: "#121212",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontWeight: "800",
                      fontSize: 17,
                    }}
                  >
                    Follow Requests ({followRequests.length})
                  </Text>
                  <TouchableOpacity
                    onPress={refreshFollowRequests}
                    disabled={followRequestsBusy}
                  >
                    <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>
                      {followRequestsBusy ? "" : "Refresh"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {followRequests.length === 0 ? (
                  <Text style={{ color: "#A8A8A8", paddingVertical: 8 }}>
                    अभी कोई pending follow request नहीं है।
                  </Text>
                ) : (
                  followRequests.map((request) => (
                    <View
                      key={String(request.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 10,
                        borderTopWidth: 1,
                        borderTopColor: "#262626",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#F5F5F5", fontWeight: "800" }}>
                          {request.displayName || request.username}
                        </Text>
                        <Text style={{ color: "#A8A8A8", fontSize: 12 }}>
                          @{request.username}
                        </Text>
                      </View>
                      <TouchableOpacity
                        disabled={!!followRequestAction[request.id]}
                        onPress={() =>
                          resolveFollowRequest(request.id, "accept")
                        }
                        style={{
                          backgroundColor: "#0095F6",
                          paddingHorizontal: 13,
                          paddingVertical: 9,
                          borderRadius: 10,
                          marginRight: 7,
                        }}
                      >
                        <Text style={{ color: "#FFF", fontWeight: "700" }}>
                          Accept
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={!!followRequestAction[request.id]}
                        onPress={() =>
                          resolveFollowRequest(request.id, "reject")
                        }
                        style={{
                          backgroundColor: "#1C1C1E",
                          paddingHorizontal: 13,
                          paddingVertical: 9,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>
                          Reject
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
              {/* SOCIALAPP_PROFILE_SETTINGS_V1 */}
              <View
                style={{
                  marginTop: 28,
                  marginBottom: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: "#F5F5F5", fontWeight: "800", fontSize: 19 }}
                >
                  Profile Settings
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Open Settings"
                  onPress={() => setSettingsHubOpen(true)}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    backgroundColor: "#1C1C1E",
                    borderWidth: 1,
                    borderColor: "#303030",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="settings-outline" size={23} color="#F5F5F5" />
                </TouchableOpacity>
              </View>
              {privacySettings.accountType === "business" && (
              <TouchableOpacity
                onPress={() => { setBusinessDirectoryResults([]); setBusinessDirectoryOpen(true); }}
                style={{ marginBottom: 13, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: "#303030", backgroundColor: "#121212", flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons name="storefront" size={23} color="#0095F6" />
                <View style={{ marginLeft: 11, flex: 1 }}>
                  <Text style={{ color: "#F5F5F5", fontWeight: "800" }}>Area-wise Business Directory</Text>
                  <Text style={{ color: "#A8A8A8", fontSize: 11, marginTop: 3 }}>Discover local brands, shops and services</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0095F6" />
              </TouchableOpacity>
              )}
              <View>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#303030",
                    borderRadius: 16,
                    paddingHorizontal: 15,
                    paddingVertical: 15,
                    marginBottom: 12,
                    backgroundColor: "#121212",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontWeight: "700",
                          fontSize: 15,
                        }}
                      >
                        Notifications
                      </Text>
                      <Text
                        style={{ color: "#A8A8A8", fontSize: 12, marginTop: 4 }}
                      >
                        {notificationsEnabled
                          ? "Preference enabled"
                          : "Preference disabled"}
                      </Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={changeNotificationPreference}
                      disabled={notificationsBusy}
                      trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
                      thumbColor={notificationsEnabled ? "#DBDBDB" : "#F8FAFC"}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={openNotificationSettings}
                  disabled={notificationsBusy}
                  style={{
                    borderWidth: 1,
                    borderColor: "#303030",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 11,
                    backgroundColor: "#121212",
                  }}
                >
                  <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>
                    {notificationDetailsOpen
                      ? "Hide notification options"
                      : "Manage notification options"}
                  </Text>
                  <Text
                    style={{ color: "#A8A8A8", fontSize: 12, marginTop: 4 }}
                  >
                    Likes, comments, follows, messages and system alerts
                  </Text>
                </TouchableOpacity>
                {notificationDetailsOpen && (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#303030",
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 12,
                      backgroundColor: "#121212",
                    }}
                  >
                    {[
                      { key: "likes", label: "Likes" },
                      { key: "comments", label: "Comments" },
                      { key: "follows", label: "Follows" },
                      { key: "messages", label: "Messages" },
                      { key: "system_alerts", label: "System Alerts" },
                    ].map((item) => (
                      <View
                        key={item.key}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: "#F5F5F5", fontWeight: "600" }}>
                          {item.label}
                        </Text>
                        <Switch
                          value={!!notificationDetails[item.key]}
                          onValueChange={(value) =>
                            changeNotificationDetail(item.key, value)
                          }
                          disabled={notificationsBusy || !notificationsEnabled}
                        />
                      </View>
                    ))}
                  </View>
                )}
                {[
                  {
                    title: "Account Security",
                    subtitle: "Password and sign-in security",
                  },
                  { title: "Privacy", subtitle: "Control your privacy" },
                  {
                    title: "Account Settings",
                    subtitle: "Manage your account",
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.title}
                    onPress={() => {
                      if (item.title === "Privacy") {
                        openPrivacySettings();
                      } else if (item.title === "Account Security") {
                        setPasswordOpen(true);
                      } else if (item.title === "Account Settings") {
                        openAccountSettings();
                      } else if (item.title === "Notifications") {
                        openNotificationSettings();
                      } else {
                        Alert.alert(
                          item.title,
                          "This setting will be added in a later step.",
                        );
                      }
                    }}
                    style={{
                      paddingVertical: 15,
                      paddingHorizontal: 15,
                      borderWidth: 1,
                      borderColor: "#303030",
                      borderRadius: 15,
                      marginBottom: 10,
                      backgroundColor: "#121212",
                      elevation: 1,
                    }}
                  >
                    <Text
                      style={{
                        color: "#F5F5F5",
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{ color: "#A8A8A8", fontSize: 11, marginTop: 4 }}
                    >
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleOpenSavedScreen}
                activeOpacity={0.85}
                style={{
                  marginTop: 18,
                  marginBottom: 5,
                  paddingHorizontal: 15,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: "#1C1C1E",
                  borderWidth: 1,
                  borderColor: "#303030",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons name="bookmark" size={21} color="#0095F6" />
                  <View>
                    <Text
                      style={{
                        color: "#F5F5F5",
                        fontWeight: "800",
                        fontSize: 15,
                      }}
                    >
                      Saved
                    </Text>
                    <Text
                      style={{ color: "#A8A8A8", fontSize: 11, marginTop: 2 }}
                    >
                      Your saved posts and reels
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#0095F6" />
              </TouchableOpacity>
              <View
                style={{
                  marginTop: 22,
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: "#F5F5F5", fontSize: 19, fontWeight: "800" }}
                >
                  Your Posts
                </Text>
                <Ionicons name="grid-outline" size={21} color="#0095F6" />
              </View>
              {groupPostItems(
                feedPosts.filter((p) => (p.user || "you") === "you"),
              ).length ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    rowGap: 5,
                  }}
                >
                  {groupPostItems(
                    feedPosts.filter((p) => (p.user || "you") === "you"),
                  ).map((p, i) => {
                    const media = p.mediaItems?.[0] || p;
                    const isVideo = media.mediaType === "video";
                    const hasMultiple = (p.mediaItems?.length || 0) > 1;
                    return (
                      <TouchableOpacity
                        key={p.groupId || p.id || `my-post-${i}`}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedPostMediaIndex(0);
                          setSelectedPost(p);
                        }}
                        style={{
                          width: "32.5%",
                          aspectRatio: 1,
                          backgroundColor: "#1C1C1E",
                          borderRadius: 11,
                          overflow: "hidden",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "#303030",
                        }}
                      >
                        {media.uri &&
                        !isVideo &&
                        !profileImageErrors[
                          p.groupId || p.id || `my-post-${i}`
                        ] ? (
                          <Image
                            source={{ uri: media.uri }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                            onError={() =>
                              setProfileImageErrors((prev) => ({
                                ...prev,
                                [p.groupId || p.id || `my-post-${i}`]: true,
                              }))
                            }
                          />
                        ) : (
                          <View
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: isVideo
                                ? "#252A3B"
                                : p.color || "#D8E7DF",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isVideo ? (
                              <Ionicons
                                name="play-circle"
                                size={34}
                                color="#FFFFFF"
                              />
                            ) : (
                              <Text style={{ fontSize: 38 }}>
                                {p.emoji || "🌿"}
                              </Text>
                            )}
                          </View>
                        )}
                        {isVideo && media.uri ? (
                          <View
                            style={{
                              position: "absolute",
                              right: 7,
                              top: 7,
                              width: 27,
                              height: 27,
                              borderRadius: 9,
                              backgroundColor: "rgba(15, 23, 42, 0.68)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="play" size={15} color="#FFFFFF" />
                          </View>
                        ) : null}
                        {hasMultiple ? (
                          <View
                            style={{
                              position: "absolute",
                              right: 7,
                              top: 7,
                              width: 27,
                              height: 27,
                              borderRadius: 9,
                              backgroundColor: "rgba(15, 23, 42, 0.68)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons
                              name="copy-outline"
                              size={15}
                              color="#FFFFFF"
                            />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: 28,
                    paddingHorizontal: 18,
                    backgroundColor: "#121212",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#303030",
                  }}
                >
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 20,
                      backgroundColor: "#1C1C1E",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name="images-outline" size={29} color="#DBDBDB" />
                  </View>
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 16,
                      fontWeight: "800",
                      marginBottom: 6,
                    }}
                  >
                    Share your first post
                  </Text>
                  <Text
                    style={{
                      color: "#A8A8A8",
                      fontSize: 12,
                      textAlign: "center",
                      lineHeight: 18,
                      marginBottom: 16,
                    }}
                  >
                    Your photos and videos will appear here.
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleTab("Create")}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: "#0095F6",
                      paddingHorizontal: 22,
                      paddingVertical: 11,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Create First Post
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#A8A8A8" }}>{activeTab}</Text>
        </View>
      )}

      <View style={styles.bottomNav}>
        {[
          { name: "Home", icon: "home-outline", activeIcon: "home" },
          { name: "Reels", icon: "play-outline", activeIcon: "play" },
          { name: "Chat", icon: "paper-plane-outline", activeIcon: "paper-plane" },
          { name: "Search", icon: "search-outline", activeIcon: "search" },
          { name: "Profile", icon: "person-outline", activeIcon: "person" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.navItem}
            onPress={() => handleTab(tab.name)}
            accessibilityLabel={tab.name}
          >
            <Ionicons
              name={(activeTab === tab.name || (tab.name === "Chat" && messagesOpen)) ? tab.activeIcon : tab.icon}
              size={tab.name === "Create" ? 29 : 26}
              color={activeTab === tab.name ? "#F5F5F5" : "#A8A8A8"}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Modal
        visible={!!selectedStory}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedStory(null)}
      >
        <GestureDetector gesture={storySwipeGesture}>
          <View style={{ flex: 1, backgroundColor: "#000000" }}>
            {selectedStory?.uri ? (
              selectedStory.mediaType === "video" ? (
                <ReelVideo
                  uri={selectedStory.uri}
                  height={Dimensions.get("window").height}
                  
                  loop={false}
                  active={!storyPaused}
                  onPlayToEnd={() => moveStory(1)}
                  onTimeUpdate={(currentTime, duration) => {
                    if (Number.isFinite(duration) && duration > 0) {
                      setStoryProgress(
                        Math.min(100, (currentTime / duration) * 100),
                      );
                    }
                  }}
                />
              ) : (
                <ZoomableImage
                  key={selectedStory.uri}
                  uri={selectedStory.uri}
                  style={{ width: "100%", height: "100%" }}
                  onZoomChange={(level) => setStoryImageZoomed(level > 1.01)}
                  showControls={false}
                />
              )
            ) : (
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text
                  style={{ color: "#FFFFFF", textAlign: "center", padding: 24 }}
                >
                  Story media is unavailable.
                </Text>
              </View>
            )}

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 150,
                backgroundColor: "rgba(0,0,0,0.32)",
              }}
            />

            <View
              style={{
                position: "absolute",
                top: 12,
                left: 10,
                right: 10,
                flexDirection: "row",
                gap: 4,
                zIndex: 5,
              }}
            >
              {storyQueue.map((story, index) => (
                <View
                  key={String(story.id || story.uri || index)}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 3,
                    backgroundColor: "rgba(255,255,255,0.38)",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width:
                        index < storyIndex
                          ? "100%"
                          : index === storyIndex
                            ? `${storyProgress}%`
                            : "0%",
                      height: "100%",
                      borderRadius: 3,
                      backgroundColor: "#000000",
                    }}
                  />
                </View>
              ))}
            </View>

            <View
              style={{
                position: "absolute",
                top: 25,
                left: 12,
                right: 12,
                height: 48,
                flexDirection: "row",
                alignItems: "center",
                zIndex: 6,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#64748B",
                  borderWidth: 1.5,
                  borderColor: "#262626",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 9,
                }}
              >
                <Text
                  style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}
                >
                  {String(selectedStory?.name || selectedStory?.user || "U")
                    .replace(/^@/, "")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}
                >
                  {selectedStory?.name || selectedStory?.user || "Story"}
                </Text>
                {!!selectedStory?.createdAt && (
                  <Text
                    style={{ color: "#E5E5E5", fontSize: 11, marginTop: 2 }}
                  >
                    {formatPostTime(selectedStory.createdAt)}
                  </Text>
                )}
              </View>

              {String(selectedStory?.user || selectedStory?.username || "").replace(/^@/, "").toLowerCase() === String(authSession?.username || "").toLowerCase() && !selectedStory?.isStarterStory ? (
                <TouchableOpacity onPress={() => requestDeleteContent("stories", selectedStory)} accessibilityLabel="Delete your story" style={{ padding: 9 }}>
                  <Ionicons name="trash-outline" size={21} color="#0095F6" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setSelectedStory(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 8 }}
              >
                <Text
                  style={{ color: "#FFFFFF", fontSize: 29, lineHeight: 32 }}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            {!!selectedStory?.caption && (
              <View
                style={{
                  position: "absolute",
                  bottom: 34,
                  left: 18,
                  right: 18,
                  alignItems: "center",
                  zIndex: 4,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: "500",
                    textAlign: "center",
                    textShadowColor: "rgba(0,0,0,0.8)",
                    textShadowRadius: 5,
                  }}
                >
                  {selectedStory.caption}
                </Text>
              </View>
            )}

            <TouchableOpacity
              accessibilityLabel="Previous story"
              onPress={() => {
                if (storyLongPressRef.current) {
                  storyLongPressRef.current = false;
                  return;
                }
                moveStory(-1);
              }}
              onPressIn={() => {
                storyLongPressRef.current = false;
                setStoryPaused(true);
              }}
              onLongPress={() => { storyLongPressRef.current = true; }}
              delayLongPress={220}
              onPressOut={() => setStoryPaused(false)}
              style={{
                position: "absolute",
                left: 0,
                top: 85,
                bottom: 75,
                width: "35%",
                zIndex: 2,
              }}
              activeOpacity={1}
            />
            <TouchableOpacity
              accessibilityLabel="Next story"
              onPress={() => {
                if (storyLongPressRef.current) {
                  storyLongPressRef.current = false;
                  return;
                }
                moveStory(1);
              }}
              onPressIn={() => {
                storyLongPressRef.current = false;
                setStoryPaused(true);
              }}
              onLongPress={() => { storyLongPressRef.current = true; }}
              delayLongPress={220}
              onPressOut={() => setStoryPaused(false)}
              style={{
                position: "absolute",
                right: 0,
                top: 85,
                bottom: 75,
                width: "65%",
                zIndex: 2,
              }}
              activeOpacity={1}
            />
          </View>
        </GestureDetector>
      </Modal>

      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000",
            paddingTop: 42,
            paddingBottom: 18,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingVertical: 12,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#26385F",
                  borderWidth: 1.5,
                  borderColor: "#7C9FF2",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 11,
                }}
              >
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" }}
                >
                  {selectedPost?.user || "you"}
                </Text>
                <Text style={{ color: "#AAB4CA", fontSize: 11, marginTop: 3 }}>
                  Bhumi Social
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityLabel="Close post"
              onPress={() => setSelectedPost(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: "#20283A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={25} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 12,
            }}
          >
            {(selectedPost?.mediaItems?.length || 0) > 1 ? (
              <>
                <ScrollView
                  key={String(
                    selectedPost?.groupId ||
                      selectedPost?.id ||
                      "selected-post",
                  )}
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ width: "100%" }}
                  onMomentumScrollEnd={(event) => {
                    const width = event.nativeEvent.layoutMeasurement.width;
                    if (width > 0)
                      setSelectedPostMediaIndex(
                        Math.round(event.nativeEvent.contentOffset.x / width),
                      );
                  }}
                >
                  {(selectedPost.mediaItems || []).map((media, index) => (
                    <View
                      key={String(media.id || index)}
                      style={{
                        width: Dimensions.get("window").width,
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {media.uri && media.mediaType === "video" ? (
                        <ReelVideo uri={media.uri} zoomControls />
                      ) : media.uri ? (
                        <ZoomableImage
                          uri={media.uri}
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#121212",
                          }}
                        >
                          <Text style={{ fontSize: 64 }}>
                            {media.emoji || "🌿"}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
                <Text
                  style={{
                    color: "#FFFFFF",
                    backgroundColor: "#262626",
                    paddingHorizontal: 13,
                    paddingVertical: 6,
                    borderRadius: 14,
                    overflow: "hidden",
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 8,
                  }}
                >
                  {selectedPostMediaIndex + 1} /{" "}
                  {selectedPost.mediaItems.length}
                </Text>
              </>
            ) : selectedPost?.uri && selectedPost.mediaType === "video" ? (
              <ReelVideo uri={selectedPost.uri} zoomControls />
            ) : selectedPost?.uri ? (
              <ZoomableImage
                uri={selectedPost.uri}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#121212",
                }}
              >
                <Text style={{ fontSize: 64 }}>
                  {selectedPost?.emoji || "🌿"}
                </Text>
              </View>
            )}
          </View>
          <PostDetailActions post={selectedPost} authSession={authSession} />
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              padding: 16,
              backgroundColor: "#121212",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#262626",
            }}
          >
            {!!selectedPost?.caption ? (
              <Text style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 21 }}>
                {selectedPost.caption}
              </Text>
            ) : (
              <Text style={{ color: "#8E8E93", fontSize: 13 }}>
                No caption added
              </Text>
            )}
            <Text
              style={{
                color: "#A8A8A8",
                fontSize: 11,
                fontWeight: "700",
                marginTop: 12,
              }}
            >
              POST BY {selectedPost?.user || "you"}
            </Text>
          </View>
        </View>
      </Modal>

      <SettingsDashboard
        visible={settingsHubOpen}
        username={authSession?.username || ""}
        onClose={() => setSettingsHubOpen(false)}
        onLogout={handleSettingsLogout}
        onPreferencesChange={setAppSettingsPreferences}
        onAbout={() => { setSettingsHubOpen(false); openAboutApp(); }}
        onLegacyOpen={(key) => {
          setSettingsHubOpen(false);
          if (key === "privacy") openPrivacySettings();
          else if (key === "notifications") openNotificationSettings();
          else if (key === "security") setPasswordOpen(true);
          else if (key === "account") openAccountSettings();
          else if (key === "blocked") openBlockedAccounts();
          else if (key === "restricted") openRestrictedAccounts();
          else if (key === "messages") openMessages();
          else if (key === "profile") {
            setActiveTab("Profile");
            setProfileDraft({ displayName: profile?.displayName || authSession?.username || "", bio: profile?.bio || "" });
            setProfileEditing(true);
          }
        }}
      />

      <Modal
        visible={blockedAccountsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockedAccountsOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.78)",
            justifyContent: "flex-end",
            paddingBottom: Platform.OS === "android" ? 38 : 0,
          }}
        >
          <View
            style={{
              backgroundColor: "#000000",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 28,
              maxHeight: "82%",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: "900",
                marginBottom: 5,
              }}
            >
              Blocked Accounts
            </Text>
            <Text style={{ color: "#A8A8A8", fontSize: 13, marginBottom: 16 }}>
              Accounts you have blocked cannot follow or contact you.
            </Text>
            {blockedAccountsLoading ? (
              <Text
                style={{
                  color: "#A8A8A8",
                  textAlign: "center",
                  paddingVertical: 28,
                }}
              >
                
              </Text>
            ) : blockedAccounts.length === 0 ? (
              <Text
                style={{
                  color: "#A8A8A8",
                  textAlign: "center",
                  paddingVertical: 28,
                }}
              >
                You have not blocked anyone.
              </Text>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 0 }}
              >
                {blockedAccounts.map((item) => (
                  <View
                    key={item.username}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#000000",
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 9,
                      borderWidth: 1,
                      borderColor: "#262626",
                    }}
                  >
                    {item.avatarUrl ? (
                      <Image
                        source={{ uri: item.avatarUrl }}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          marginRight: 11,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          marginRight: 11,
                          backgroundColor: "#1C1C1E",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                          {String(item.displayName || item.username)
                            .slice(0, 1)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "800",
                          fontSize: 14,
                        }}
                      >
                        {item.displayName || item.username}
                      </Text>
                      <Text
                        style={{ color: "#A8A8A8", fontSize: 12, marginTop: 2 }}
                      >
                        @{item.username}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={blockedAccountsBusy}
                      onPress={() => handleUnblockAccount(item.username)}
                      style={{
                        backgroundColor: "#0095F6",
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 10,
                        opacity: blockedAccountsBusy ? 0.55 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "#121212",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {blockedAccountsBusy ? "Please wait" : "Unblock"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              onPress={() => setBlockedAccountsOpen(false)}
              style={{
                alignItems: "center",
                paddingVertical: 14,
                marginTop: 8,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={restrictedAccountsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRestrictedAccountsOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(5, 2, 12, 0.78)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#000000",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 28,
              maxHeight: "82%",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: "900",
                marginBottom: 5,
              }}
            >
              Restricted Accounts
            </Text>
            <Text style={{ color: "#A8A8A8", fontSize: 13, marginBottom: 16 }}>
              Manage people whose interactions with you are limited.
            </Text>
            {restrictedAccountsLoading ? (
              <Text
                style={{
                  color: "#A8A8A8",
                  textAlign: "center",
                  paddingVertical: 28,
                }}
              >
                
              </Text>
            ) : restrictedAccounts.length === 0 ? (
              <Text
                style={{
                  color: "#A8A8A8",
                  textAlign: "center",
                  paddingVertical: 28,
                }}
              >
                You have not restricted anyone.
              </Text>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 0 }}
              >
                {restrictedAccounts.map((item) => (
                  <View
                    key={item.username}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#000000",
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 9,
                      borderWidth: 1,
                      borderColor: "#262626",
                    }}
                  >
                    {item.avatarUrl ? (
                      <Image
                        source={{ uri: item.avatarUrl }}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          marginRight: 11,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          marginRight: 11,
                          backgroundColor: "#1C1C1E",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                          {String(item.displayName || item.username)
                            .slice(0, 1)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "800",
                          fontSize: 14,
                        }}
                      >
                        {item.displayName || item.username}
                      </Text>
                      <Text
                        style={{ color: "#A8A8A8", fontSize: 12, marginTop: 2 }}
                      >
                        @{item.username}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={restrictedAccountsBusy}
                      onPress={() => handleUnrestrictAccount(item.username)}
                      style={{
                        backgroundColor: "#0095F6",
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 10,
                        opacity: restrictedAccountsBusy ? 0.55 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "#121212",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {restrictedAccountsBusy ? "Please wait" : "Unrestrict"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              onPress={() => setRestrictedAccountsOpen(false)}
              style={{
                alignItems: "center",
                paddingVertical: 14,
                marginTop: 8,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}
              >
                Close
              </Text>
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
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(5, 2, 12, 0.78)",
            justifyContent: "flex-end",
            padding: 22,
            paddingBottom: 26,
          }}
        >
          <View
            style={{
              backgroundColor: "#000000",
              borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderRadius: 24,
              padding: 22,
            paddingBottom: 26,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: "800",
                marginBottom: 18,
              }}
            >
              Privacy Settings
            </Text>
            <Text style={{ color: "#A8A8A8", fontSize: 12, marginBottom: 12 }}>
              Choose how people can view and interact with your account.
            </Text>
            <TouchableOpacity onPress={openSnapPrivacySettings} disabled={snapPrivacyBusy} style={{ flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 14, borderRadius: 14, backgroundColor: "rgba(181,139,255,0.13)", borderWidth: 1, borderColor: "#7657A5" }}>
              <Ionicons name="shield-checkmark" size={22} color="#C9ACFF" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Privacy & Chat Controls</Text>
                <Text style={{ color: "#B8AFC5", fontSize: 11, marginTop: 3 }}>Messages, Story audience, read receipts and more</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C9ACFF" />
            </TouchableOpacity>
            {[
              { key: "business", title: "Business Account", subtitle: "Professional profile for your brand or business", active: privacySettings.accountType === "business" },
              { key: "creator", title: "Creator Account", subtitle: "Public profile for creators, reels and audience growth", active: privacySettings.accountType === "creator" },
              { key: "private", title: "Private Account", subtitle: "Only approved followers can see your posts", active: privacySettings.accountType === "personal" && privacySettings.isPrivate },
              { key: "public", title: "Public Account", subtitle: "Anyone can see your public posts and profile", active: privacySettings.accountType === "personal" && !privacySettings.isPrivate },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => switchAccountMode(item.key)}
                disabled={privacyBusy || (item.active && item.key !== "business")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  marginBottom: 9,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: item.active ? "#0095F6" : "#262626",
                  backgroundColor: item.active ? "rgba(216,184,106,0.13)" : "#000000",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{item.title}</Text>
                  <Text style={{ color: "#A8A8A8", fontSize: 11, marginTop: 4 }}>{item.subtitle}</Text>
                </View>
                <Ionicons name={item.active ? "checkmark-circle" : "ellipse-outline"} size={23} color={item.active ? "#0095F6" : "#8C7C9E"} />
              </TouchableOpacity>
            ))}
            {[
              {
                key: "showActivity",
                title: "Show Activity",
                subtitle: "Allow your activity to be visible",
              },
              {
                key: "allowMessages",
                title: "Allow Messages",
                subtitle: "Allow other users to message you",
              },
            ].map((item) => (
              <View
                key={item.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#262626",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: "#A8A8A8", fontSize: 12, marginTop: 3 }}
                  >
                    {item.subtitle}
                  </Text>
                </View>
                <Switch
                  value={privacySettings[item.key]}
                  onValueChange={(value) =>
                    setPrivacySettings((current) => ({
                      ...current,
                      [item.key]: value,
                    }))
                  }
                  disabled={privacyBusy}
                />
              </View>
            ))}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <TouchableOpacity
                onPress={() => setPrivacyOpen(false)}
                disabled={privacyBusy}
                style={{ padding: 12, marginRight: 8 }}
              >
                <Text style={{ color: "#A8A8A8" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={persistPrivacySettings}
                disabled={privacyBusy}
                style={{
                  padding: 12,
                  backgroundColor: "#0095F6",
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#121212", fontWeight: "800" }}>
                  {privacyBusy ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={snapPrivacyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSnapPrivacyOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(5,2,12,0.82)", justifyContent: "flex-end" }}>
          <View style={{ maxHeight: "88%", backgroundColor: "#101014", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: "#34313D", padding: 20 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Ionicons name="shield-checkmark" size={24} color="#B58BFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginLeft: 9 }}>Privacy & Chat Controls</Text>
              </View>
              <Text style={{ color: "#AAA5B4", fontSize: 12, marginBottom: 18 }}>Snap-inspired controls · changes save automatically</Text>
              {[
                { key: "contactAudience", title: "Who can message or call me?", options: [["friends","Friends only"],["followers","Followers"],["everyone","Everyone"]] },
                { key: "storyAudience", title: "Who can view my Stories?", options: [["followers","Followers"],["close_friends","Close Friends"],["everyone","Everyone"]] },
                { key: "disappearingMessages", title: "Disappearing messages", options: [["off","Off"],["24h","After 24 hours"],["7d","After 7 days"]] },
              ].map((item) => (
                <View key={item.key} style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#302D37" }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "800", marginBottom: 10 }}>{item.title}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {item.options.map(([value, label]) => (
                      <TouchableOpacity key={value} disabled={snapPrivacyBusy} onPress={() => updateSnapPrivacy(item.key, value)} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: snapPrivacy[item.key] === value ? "#B58BFF" : "#45414D", backgroundColor: snapPrivacy[item.key] === value ? "rgba(181,139,255,0.18)" : "transparent" }}>
                        <Text style={{ color: snapPrivacy[item.key] === value ? "#D9C5FF" : "#C4C0CB", fontSize: 12, fontWeight: "700" }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              {[
                { key: "readReceipts", title: "Read receipts", subtitle: "Let people know when you have read their messages." },
                { key: "typingIndicator", title: "Typing indicator", subtitle: "Show when you are typing in a chat." },
                { key: "storyReplies", title: "Allow Story replies", subtitle: "Let viewers reply to your Stories." },
                { key: "hideFromSuggestions", title: "Hide me from suggestions", subtitle: "Reduce your profile appearing in discovery suggestions." },
              ].map((item) => (
                <View key={item.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#302D37" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{item.title}</Text>
                    <Text style={{ color: "#AAA5B4", fontSize: 11, marginTop: 3 }}>{item.subtitle}</Text>
                  </View>
                  <Switch value={!!snapPrivacy[item.key]} disabled={snapPrivacyBusy} onValueChange={(value) => updateSnapPrivacy(item.key, value)} />
                </View>
              ))}
              <TouchableOpacity onPress={() => setSnapPrivacyOpen(false)} style={{ alignSelf: "flex-end", marginTop: 18, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 12, backgroundColor: "#B58BFF" }}>
                <Text style={{ color: "#17121F", fontWeight: "900" }}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>


      <Modal
        visible={businessProfileOpen && privacySettings.accountType === "business"}
        transparent
        animationType="slide"
        onRequestClose={() => !businessProfileBusy && setBusinessProfileOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "rgba(5,2,12,0.88)", justifyContent: "flex-end" }}
        >
          <View style={{ maxHeight: "92%", backgroundColor: "#000000", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: "#363636", padding: 18 }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Ionicons name="business" size={24} color="#0095F6" />
                <Text style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginLeft: 9 }}>Business Studio</Text>
              </View>
              <Text style={{ color: "#0095F6", fontSize: 12, fontWeight: "700", marginBottom: 16 }}>PREMIUM BUSINESS PROFILE · AREA DISCOVERY</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 }}>
                {[
                  ["Content", businessInsights.contentCount],
                  ["Followers", businessInsights.followers],
                  ["Likes", businessInsights.likes],
                  ["Comments", businessInsights.comments],
                ].map(([label, value]) => (
                  <View key={label} style={{ minWidth: "47%", flexGrow: 1, padding: 11, borderRadius: 12, backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#262626" }}>
                    <Text style={{ color: "#0095F6", fontSize: 18, fontWeight: "900" }}>{value}</Text>
                    <Text style={{ color: "#A8A8A8", fontSize: 11 }}>{label}</Text>
                  </View>
                ))}
              </View>
              {[
                ["businessName", "Business / Brand Name", "e.g. Your brand name"],
                ["category", "Business Category", "Restaurant, Salon, Fashion, Services..."],
                ["description", "About Your Business", "Describe products, services and specialties"],
                ["phone", "Business Phone", "Contact number"],
                ["whatsapp", "WhatsApp Number", "WhatsApp contact number"],
                ["email", "Business Email", "name@example.com"],
                ["website", "Website / Booking Link", "https://"],
                ["address", "Full Address", "Shop, street, landmark"],
                ["area", "Area / Locality", "e.g. Navrangpura"],
                ["city", "City", "e.g. Ahmedabad"],
                ["state", "State", "e.g. Gujarat"],
                ["pincode", "PIN Code", "6-digit PIN code"],
                ["serviceAreas", "Service Areas", "Comma-separated areas you serve"],
                ["serviceRadiusKm", "Service Radius (KM)", "0 = area list only"],
                ["openingHours", "Business Hours", "e.g. Mon-Sat 10 AM-8 PM"],
              ].map(([key, label, placeholder]) => (
                <View key={key} style={{ marginBottom: 11 }}>
                  <Text style={{ color: "#D1D1D1", fontSize: 12, fontWeight: "700", marginBottom: 5 }}>{label}</Text>
                  <TextInput
                    value={String(businessProfile[key] ?? "")}
                    onChangeText={(value) => setBusinessProfile((current) => ({ ...current, [key]: key === "serviceRadiusKm" ? value.replace(/[^0-9]/g, "") : value }))}
                    placeholder={placeholder}
                    placeholderTextColor="#8E8E93"
                    multiline={key === "description" || key === "address" || key === "serviceAreas"}
                    keyboardType={key === "phone" || key === "whatsapp" || key === "pincode" || key === "serviceRadiusKm" ? "phone-pad" : "default"}
                    style={{ color: "#FFFFFF", borderWidth: 1, borderColor: "#262626", borderRadius: 12, backgroundColor: "#121212", paddingHorizontal: 12, paddingVertical: 11, minHeight: key === "description" || key === "serviceAreas" ? 76 : 44, textAlignVertical: "top" }}
                  />
                </View>
              ))}

              <View style={{ borderTopWidth: 1, borderTopColor: "#262626", paddingTop: 15, marginBottom: 15 }}>
                <Text style={{ color: "#0095F6", fontSize: 16, fontWeight: "900", marginBottom: 9 }}>Product & Service Catalogue</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {["product", "service"].map((type) => (
                    <TouchableOpacity key={type} onPress={() => setCatalogDraft((old) => ({ ...old, itemType: type }))} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: catalogDraft.itemType === type ? "#0095F6" : "#262626", backgroundColor: catalogDraft.itemType === type ? "#1C1C1E" : "#121212" }}>
                      <Text style={{ color: catalogDraft.itemType === type ? "#0095F6" : "#A8A8A8", fontWeight: "800" }}>{type === "product" ? "Product" : "Service"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {[
                  ["title", "Item name", "Name of product or service"],
                  ["category", "Category", "e.g. Clothing, Repair, Beauty"],
                  ["price", "Price / Starting price", "e.g. ₹499 or Contact for price"],
                  ["description", "Description", "Details, benefits and availability"],
                ].map(([key, label, placeholder]) => (
                  <View key={key} style={{ marginBottom: 7 }}>
                    <Text style={{ color: "#A8A8A8", fontSize: 11, marginBottom: 3 }}>{label}</Text>
                    <TextInput value={catalogDraft[key]} onChangeText={(value) => setCatalogDraft((old) => ({ ...old, [key]: value }))} placeholder={placeholder} placeholderTextColor="#8E8E93" multiline={key === "description"} style={{ color: "#FFFFFF", backgroundColor: "#121212", borderWidth: 1, borderColor: "#262626", borderRadius: 10, padding: 10, minHeight: key === "description" ? 60 : 40 }} />
                  </View>
                ))}
                <TouchableOpacity onPress={addBusinessCatalogItem} style={{ backgroundColor: "#0095F6", borderRadius: 10, padding: 11, alignItems: "center" }}>
                  <Text style={{ color: "#121212", fontWeight: "900" }}>Add to Catalogue</Text>
                </TouchableOpacity>
                {businessCatalog.map((item) => (
                  <View key={item.id} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderBottomColor: "#262626" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{item.title}</Text>
                      <Text style={{ color: "#A8A8A8", fontSize: 11 }}>{item.item_type} · {item.price || "Price on request"}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeBusinessCatalogItem(item.id)}><Ionicons name="trash-outline" size={18} color="#0095F6" /></TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: "#262626", paddingTop: 15, marginBottom: 15 }}>
                <Text style={{ color: "#0095F6", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Customer Quick Replies</Text>
                <TextInput value={quickReplyDraft.shortcut} onChangeText={(value) => setQuickReplyDraft((old) => ({ ...old, shortcut: value }))} placeholder="Shortcut e.g. welcome" placeholderTextColor="#8E8E93" style={{ color: "#FFFFFF", backgroundColor: "#121212", borderWidth: 1, borderColor: "#262626", borderRadius: 10, padding: 10, marginBottom: 7 }} />
                <TextInput value={quickReplyDraft.message} onChangeText={(value) => setQuickReplyDraft((old) => ({ ...old, message: value }))} placeholder="Saved reply message..." placeholderTextColor="#8E8E93" multiline style={{ color: "#FFFFFF", backgroundColor: "#121212", borderWidth: 1, borderColor: "#262626", borderRadius: 10, padding: 10, minHeight: 62, marginBottom: 7 }} />
                <TouchableOpacity onPress={addBusinessQuickReply} style={{ backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#363636", borderRadius: 10, padding: 11, alignItems: "center" }}>
                  <Text style={{ color: "#0095F6", fontWeight: "900" }}>Save Quick Reply</Text>
                </TouchableOpacity>
                {businessQuickReplies.map((reply) => (
                  <View key={reply.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#262626" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#0095F6", fontWeight: "800" }}>/{reply.shortcut}</Text>
                      <Text numberOfLines={2} style={{ color: "#A8A8A8", fontSize: 11 }}>{reply.message}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeBusinessQuickReply(reply.id)}><Ionicons name="trash-outline" size={18} color="#0095F6" /></TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={{ backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#363636", borderRadius: 14, padding: 12, marginTop: 2, marginBottom: 14 }}>
                <Text style={{ color: "#0095F6", fontWeight: "800" }}>Area-wise Business Discovery</Text>
                <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 4 }}>Customers can discover your business by city, locality, category and service areas.</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingBottom: 20 }}>
                <TouchableOpacity onPress={() => setBusinessProfileOpen(false)} disabled={businessProfileBusy} style={{ padding: 13, marginRight: 8 }}>
                  <Text style={{ color: "#A8A8A8", fontWeight: "700" }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={persistBusinessProfile} disabled={businessProfileBusy} style={{ backgroundColor: "#0095F6", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13 }}>
                  <Text style={{ color: "#121212", fontWeight: "900" }}>{businessProfileBusy ? "Saving..." : "Save Business Profile"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      <Modal visible={businessDirectoryOpen && privacySettings.accountType === "business"} transparent animationType="slide" onRequestClose={() => setBusinessDirectoryOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "rgba(5,2,12,0.88)", justifyContent: "flex-end" }}>
          <View style={{ maxHeight: "90%", backgroundColor: "#000000", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: "#363636", padding: 17 }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ color: "#0095F6", fontSize: 20, fontWeight: "900", marginBottom: 5 }}>Local Business Directory</Text>
              <Text style={{ color: "#A8A8A8", fontSize: 12, marginBottom: 13 }}>Search by city, area or business category</Text>
              {[
                ["city", "City", "e.g. Ahmedabad"],
                ["area", "Area / Locality", "e.g. Navrangpura"],
                ["category", "Category", "e.g. Salon, Restaurant"],
                ["q", "Business name / keyword", "Search brands and services"],
              ].map(([key, label, placeholder]) => (
                <View key={key} style={{ marginBottom: 9 }}>
                  <Text style={{ color: "#D1D1D1", fontSize: 12, marginBottom: 4 }}>{label}</Text>
                  <TextInput value={businessDirectoryFilters[key]} onChangeText={(value) => setBusinessDirectoryFilters((old) => ({ ...old, [key]: value }))} placeholder={placeholder} placeholderTextColor="#8E8E93" style={{ color: "#FFFFFF", backgroundColor: "#121212", borderWidth: 1, borderColor: "#262626", borderRadius: 11, padding: 11 }} />
                </View>
              ))}
              <TouchableOpacity onPress={searchBusinessDirectory} disabled={businessDirectoryBusy} style={{ backgroundColor: "#0095F6", padding: 13, borderRadius: 12, alignItems: "center", marginVertical: 8 }}>
                <Text style={{ color: "#121212", fontWeight: "900" }}>{businessDirectoryBusy ? "Searching..." : "Find Local Businesses"}</Text>
              </TouchableOpacity>
              {businessDirectoryResults.map((item) => (
                <TouchableOpacity key={item.username} onPress={() => { setBusinessDirectoryOpen(false); openUserProfile(item.username); }} style={{ padding: 13, borderRadius: 13, borderWidth: 1, borderColor: "#262626", marginBottom: 8, backgroundColor: "#121212" }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{item.businessName || item.username}</Text>
                  <Text style={{ color: "#0095F6", fontSize: 11, marginTop: 3 }}>{[item.category, item.area, item.city, item.state].filter(Boolean).join(" · ")}</Text>
                  {!!item.description && <Text numberOfLines={2} style={{ color: "#A8A8A8", fontSize: 12, marginTop: 5 }}>{item.description}</Text>}
                </TouchableOpacity>
              ))}
              {!businessDirectoryBusy && businessDirectoryResults.length === 0 && <Text style={{ color: "#8F819E", fontSize: 12, textAlign: "center", paddingVertical: 12 }}>Enter a city, area or category to discover businesses.</Text>}
              <TouchableOpacity onPress={() => setBusinessDirectoryOpen(false)} style={{ alignSelf: "flex-end", padding: 13 }}>
                <Text style={{ color: "#0095F6", fontWeight: "800" }}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(5, 2, 12, 0.82)",
            justifyContent: "center",
            padding: 22,
          }}
        >
          <View
            style={{
              backgroundColor: "#000000",
              borderRadius: 24,
              padding: 22,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#FFFFFF",
                marginBottom: 12,
              }}
            >
              Update Available
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: "#A8A8A8",
                textAlign: "center",
                lineHeight: 22,
                marginBottom: 22,
              }}
            >
              {updateInfo?.message ||
                "A new in-app update for Bhumi Social AI is available."}
            </Text>
            <TouchableOpacity
              onPress={downloadAndInstallUpdate}
              disabled={updateDownloading}
              style={{
                backgroundColor: updateDownloading ? "#594B68" : "#0095F6",
                paddingVertical: 13,
                paddingHorizontal: 24,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "#121212", fontWeight: "800", fontSize: 16 }}
              >
                {updateDownloading
                  ? "Updating app..."
                  : "Update Now"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Share.share({
                  message:
                    "Download Bhumi Social AI: https://bhumi-social-app-1.onrender.com/download",
                })
              }
              style={{
                backgroundColor: "#1C1C1E",
                paddingVertical: 13,
                paddingHorizontal: 24,
                borderRadius: 12,
                width: "100%",
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <Text
                style={{ color: "#121212", fontWeight: "800", fontSize: 16 }}
              >
                Share App Link
              </Text>
            </TouchableOpacity>
            {!updateInfo?.force_update && (
              <TouchableOpacity
                onPress={() => setUpdatePromptVisible(false)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  marginTop: 6,
                }}
              >
                <Text
                  style={{ color: "#A8A8A8", fontWeight: "600", fontSize: 15 }}
                >
                  Later
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* SOCIALAPP_ABOUT_APP_MODAL_V1 */}
      <Modal
        visible={aboutAppOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAboutAppOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(5, 2, 12, 0.82)", justifyContent: "flex-end", paddingBottom: Platform.OS === "android" ? 38 : 0 }}>
          <View style={{ backgroundColor: "#000000", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: "#262626", paddingHorizontal: 22, paddingTop: 26, paddingBottom: 30 }}>
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
                <Ionicons name="information-circle-outline" size={34} color="#0095F6" />
              </View>
              <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Bhumi Social AI</Text>
              <Text style={{ color: "#A8A8A8", fontSize: 13, marginTop: 6 }}>Version {appConfig.expo?.version || "1.0.0"}</Text>
            </View>
            <TouchableOpacity onPress={() => { setAboutAppOpen(false); Linking.openURL("https://bhumi-social-app-1.onrender.com/api/app-version"); }} style={{ minHeight: 50, borderRadius: 15, backgroundColor: "#0095F6", alignItems: "center", justifyContent: "center", marginBottom: 11 }}>
              <Text style={{ color: "#121212", fontSize: 15, fontWeight: "800" }}>Check Updates</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setAboutAppOpen(false); Linking.openURL("https://bhumi-social-app-1.onrender.com/download"); }} style={{ minHeight: 50, borderRadius: 15, backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#363636", alignItems: "center", justifyContent: "center", marginBottom: 11 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>Download App</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setAboutAppOpen(false); Share.share({ message: "Download Bhumi Social AI: https://bhumi-social-app-1.onrender.com/download" }); }} style={{ minHeight: 50, borderRadius: 15, backgroundColor: "#1C1C1E", borderWidth: 1, borderColor: "#363636", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#0095F6", fontSize: 15, fontWeight: "700" }}>Share App</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAboutAppOpen(false)} style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16, marginTop: 5 }}>
              <Text style={{ color: "#A8A8A8", fontSize: 14, fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(5, 2, 12, 0.78)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: "#000000",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 22,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "800",
                  color: "#FFFFFF",
                  marginBottom: 6,
                }}
              >
                Account Settings
              </Text>
              <Text style={{ color: "#A8A8A8", marginBottom: 18 }}>
                Email and mobile number are optional.
              </Text>
              <Text
                style={{ color: "#FFFFFF", fontWeight: "700", marginBottom: 6 }}
              >
                Email address
              </Text>
              <TextInput
                value={accountEmail}
                onChangeText={setAccountEmail}
                placeholder="Email address (optional)"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!accountSettingsBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 14,
                  padding: 13,
                  marginBottom: 14,
                  color: "#FFFFFF",
                }}
              />
              <Text
                style={{ color: "#FFFFFF", fontWeight: "700", marginBottom: 6 }}
              >
                Mobile number
              </Text>
              <TextInput
                value={accountPhone}
                onChangeText={setAccountPhone}
                placeholder="Mobile number (optional)"
                keyboardType="phone-pad"
                editable={!accountSettingsBusy}
                style={{
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 14,
                  padding: 13,
                  marginBottom: 18,
                  color: "#FFFFFF",
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity
                  disabled={accountSettingsBusy}
                  onPress={() => setAccountSettingsOpen(false)}
                  style={{ padding: 13, marginRight: 8 }}
                >
                  <Text style={{ color: "#A8A8A8", fontWeight: "700" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={accountSettingsBusy}
                  onPress={saveAccountSettingsChanges}
                  style={{
                    backgroundColor: "#0095F6",
                    paddingVertical: 13,
                    paddingHorizontal: 20,
                    borderRadius: 14,
                    opacity: accountSettingsBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "#121212", fontWeight: "800" }}>
                    {accountSettingsBusy ? "Saving..." : "Save changes"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(5, 2, 12, 0.78)",
              justifyContent: "flex-end",
              padding: 20,
              paddingBottom: Platform.OS === "android" ? 56 : 20,
            }}
          >
            <View
              style={{
                backgroundColor: "#000000",
                borderRadius: 22,
                padding: 20,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 20,
                  fontWeight: "800",
                  marginBottom: 18,
                }}
              >
                Change Password
              </Text>

              {[
                {
                  label: "Old Password",
                  value: oldPassword,
                  setter: setOldPassword,
                },
                {
                  label: "New Password",
                  value: newPassword,
                  setter: setNewPassword,
                },
                {
                  label: "Confirm New Password",
                  value: confirmNewPassword,
                  setter: setConfirmNewPassword,
                },
              ].map((field) => (
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
                    borderColor: "#262626",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    color: "#FFFFFF",
                  }}
                />
              ))}

              <TouchableOpacity
                disabled={passwordBusy}
                onPress={() => {
                  Alert.alert(
                    "Log Out Other Devices",
                    "This will sign out your account from other devices. This device will stay logged in.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Log Out Other Devices",
                        style: "destructive",
                        onPress: async () => {
                          setPasswordBusy(true);
                          try {
                            const result = await logoutOtherSessions();
                            Alert.alert(
                              "Success",
                              result.message ||
                                "Other devices have been signed out.",
                            );
                          } catch (e) {
                            Alert.alert(
                              "Could Not Sign Out Devices",
                              e.message || "Please try again.",
                            );
                          } finally {
                            setPasswordBusy(false);
                          }
                        },
                      },
                    ],
                  );
                }}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 12,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    color: "#B42318",
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Log Out Other Devices
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => setPasswordOpen(false)}
                  disabled={passwordBusy}
                  style={{ padding: 12, marginRight: 8 }}
                >
                  <Text style={{ color: "#A8A8A8" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!oldPassword || !newPassword || !confirmNewPassword) {
                      Alert.alert(
                        "Missing information",
                        "Fill in all three password fields.",
                      );
                      return;
                    }
                    if (newPassword !== confirmNewPassword) {
                      Alert.alert(
                        "Passwords do not match",
                        "Enter the same new password twice.",
                      );
                      return;
                    }
                    if (newPassword.length < 4 || newPassword.length > 24) {
                      Alert.alert(
                        "Invalid password",
                        "The new password must be 4 to 24 characters.",
                      );
                      return;
                    }
                    setPasswordBusy(true);
                    try {
                      const result = await changeAccountPassword(
                        oldPassword,
                        newPassword,
                        confirmNewPassword,
                      );
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setPasswordOpen(false);
                      Alert.alert(
                        "Success",
                        result.message || "Password changed successfully.",
                      );
                    } catch (e) {
                      Alert.alert(
                        "Password change failed",
                        e.message || "Please try again.",
                      );
                    } finally {
                      setPasswordBusy(false);
                    }
                  }}
                  disabled={passwordBusy}
                  style={{
                    padding: 12,
                    backgroundColor: "#0095F6",
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: "#121212", fontWeight: "800" }}>
                    {passwordBusy ? "Saving..." : "Change Password"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ChatPersonalization
        visible={chatPersonalizationOpen && !!selectedChatUser}
        username={selectedChatUser}
        onClose={() => setChatPersonalizationOpen(false)}
        onSaved={(next) => {
          setChatPreferences(next);
          const peer = String(selectedChatUser || "").toLowerCase();
          const updated = {
            ...chatFriendPrefs,
            ["messages.favorite." + peer]: next.favorite,
            ["messages.closeFriend." + peer]: next.closeFriend,
          };
          setChatFriendPrefs(updated);
          setMessageConversations((items) => sortChatConversations(items, updated));
        }}
      />

      {/* SOCIALAPP_DIRECT_MESSAGES_MODAL_V1 */}
      <Modal
        visible={messagesOpen}
        animationType="slide"
        onRequestClose={closeMessages}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#000000", paddingBottom: Platform.OS === "android" ? 6 : 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 10,
                backgroundColor: "#000000",
                minHeight: 58,
              }}
            >
              {selectedChatUser ? (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedChatUser("");
                    setChatError("");
                  }}
                  style={{ paddingRight: 14 }}
                >
                  <Ionicons name="arrow-back" size={25} color="#F5F5F5" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setChatInboxTab("Requests")}
                  accessibilityRole="button"
                  accessibilityLabel="Open message requests"
                  style={{ paddingRight: 18 }}
                >
                  <Ionicons
                    name="mail-unread-outline"
                    size={25}
                    color="#F5F5F5"
                  />
                </TouchableOpacity>
              )}
              {selectedChatUser ? (
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 43,
                      height: 43,
                      borderRadius: 22,
                      backgroundColor: "#1C1C1E",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {messageConversations.find(
                      (c) =>
                        String(c.username || "").toLowerCase() ===
                        selectedChatUser.toLowerCase(),
                    )?.avatarUrl ? (
                      <Image
                        source={{
                          uri: String(
                            messageConversations.find(
                              (c) =>
                                String(c.username || "").toLowerCase() ===
                                selectedChatUser.toLowerCase(),
                            ).avatarUrl,
                          ).startsWith("http")
                            ? messageConversations.find(
                                (c) =>
                                  String(c.username || "").toLowerCase() ===
                                  selectedChatUser.toLowerCase(),
                              ).avatarUrl
                            : `https://bhumi-social-app-1.onrender.com${messageConversations.find((c) => String(c.username || "").toLowerCase() === selectedChatUser.toLowerCase()).avatarUrl}`,
                        }}
                        style={{ width: 43, height: 43, borderRadius: 22 }}
                      />
                    ) : (
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontSize: 17,
                          fontWeight: "800",
                        }}
                      >
                        {selectedChatUser.slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 17,
                        fontWeight: "800",
                        color: "#F5F5F5",
                      }}
                    >
                      {chatPreferences.name || messageConversations.find(
                        (c) =>
                          String(c.username || "").toLowerCase() ===
                          selectedChatUser.toLowerCase(),
                      )?.displayName || selectedChatUser}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3, gap: 5 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: chatPresence?.isOnline ? "#25D366" : "#8B8B93" }} />
                      <Text numberOfLines={1} style={{ fontSize: 11, color: chatPresence?.isOnline ? "#25D366" : "#A7A9AE" }}>
                        {chatPresence?.hidden ? "एक्टिविटी छुपाई गई" : chatPresence?.isOnline ? "ऑनलाइन" : chatPresence?.lastSeenAt ? ("ऑफ़लाइन · " + formatHindiLastSeen(chatPresence.lastSeenAt)) : "ऑफ़लाइन"}
                        {chatPreferences.favorite ? "  ★ Favourite" : ""}{chatPreferences.closeFriend ? " · Close Friend" : ""}
                      </Text>
                    </View>
                  </View>
                  <VoiceVideoCallControls username={selectedChatUser} enableIncoming={false} />
                  <TouchableOpacity onPress={() => setChatPersonalizationOpen(true)} accessibilityLabel="Chat personalization" style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "transparent", borderWidth: 0, borderColor: "transparent", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="color-palette-outline" size={21} color="#F5F5F5" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => closeMessages()}
                    style={{ paddingHorizontal: 7 }}
                  >
                    <Ionicons
                      name="trending-up-outline"
                      size={29}
                      color="#F5F5F5"
                    />
                  </TouchableOpacity>
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: "#F5F5F5",
                        fontSize: 23,
                        fontWeight: "900",
                        letterSpacing: -0.7,
                      }}
                    >
                      {authSession?.username || "Messages"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={21}
                      color="#F5F5F5"
                      style={{ marginLeft: 7 }}
                    />
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: "#F32655",
                        marginLeft: 8,
                      }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setNewChatComposerOpen(true);
                      setNewChatUsername("");
                      setChatPeopleResults([]);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="New message"
                    style={{ paddingHorizontal: 9 }}
                  >
                    <Ionicons name="create-outline" size={25} color="#F5F5F5" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={closeMessages}
                    style={{ paddingHorizontal: 8 }}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={27}
                      color="#F5F5F5"
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!selectedChatUser ? (
              <View
                style={{ flex: 1, backgroundColor: "#000000", paddingTop: 8 }}
              >
                {chatError ? (
                  <Text
                    style={{
                      color: "#FF6B6B",
                      paddingHorizontal: 20,
                      paddingBottom: 8,
                    }}
                  >
                    {chatError}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    marginHorizontal: 16,
                    marginBottom: 8,
                    height: 44,
                    borderRadius: 24,
                    backgroundColor: "#1C1C1E",
                  }}
                >
                  <Ionicons name="search" size={23} color="#F5F5F5" />
                  <TextInput
                    value={chatSearchQuery}
                    onChangeText={setChatSearchQuery}
                    placeholder="Search"
                    placeholderTextColor="#737373"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      flex: 1,
                      paddingHorizontal: 13,
                      color: "#F5F5F5",
                      fontSize: 16,
                    }}
                  />
                  {chatSearchQuery ? (
                    <TouchableOpacity onPress={() => setChatSearchQuery("")}>
                      <Ionicons name="close-circle" size={19} color="#737373" />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => setChatUnreadOnly((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={chatUnreadOnly ? "Show all messages" : "Show unread messages"}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: chatUnreadOnly ? "#DBDBDB" : "transparent",
                    }}
                  >
                    <Ionicons
                      name="options-outline"
                      size={21}
                      color="#F5F5F5"
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 18,
                    paddingTop: 2,
                    paddingBottom: 8,
                    gap: 16,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setNoteDraft(ownNote?.text || "");
                      setNoteError("");
                      setNoteComposerOpen(true);
                    }}
                    style={{ width: 76, alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 34,
                        backgroundColor: "#000000",
                        borderWidth: 2,
                        borderColor: ownNote ? "#0095F6" : "#DBDBDB",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "visible",
                      }}
                    >
                      {profile?.avatarUrl ? (
                        <Image
                          source={{ uri: profile.avatarUrl }}
                          style={{ width: 64, height: 64, borderRadius: 32 }}
                        />
                      ) : (
                        <Ionicons
                          name="happy-outline"
                          size={48}
                          color="#737373"
                        />
                      )}
                      {ownNote?.text ? (
                        <View
                          style={{
                            position: "absolute",
                            top: -13,
                            left: -8,
                            right: -8,
                            minHeight: 29,
                            paddingHorizontal: 7,
                            paddingVertical: 5,
                            borderRadius: 12,
                            backgroundColor: "#000000",
                            borderWidth: 1,
                            borderColor: "#303030",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 2,
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            style={{
                              color: "#F5F5F5",
                              fontSize: 9,
                              textAlign: "center",
                            }}
                          >
                            {ownNote.text}
                          </Text>
                        </View>
                      ) : null}
                      <View
                        style={{
                          position: "absolute",
                          right: 0,
                          bottom: 0,
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#3797F0",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          borderColor: "#303030",
                        }}
                      >
                        <Ionicons name="add" size={17} color="#F5F5F5" />
                      </View>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ color: "#F5F5F5", fontSize: 12, marginTop: 7 }}
                    >
                      Your note
                    </Text>
                  </TouchableOpacity>
                  {friendsNotes.map((note, i) => (
                    <TouchableOpacity
                      key={String(note.username) + "-note-" + i}
                      onPress={() => setNoteViewer(note)}
                      style={{ width: 76, alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 34,
                          backgroundColor: "#000000",
                          borderWidth: 2,
                          borderColor: "#3797F0",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "visible",
                        }}
                      >
                        {note.avatarUrl ? (
                          <Image
                            source={{
                              uri: String(note.avatarUrl).startsWith("http")
                                ? note.avatarUrl
                                : `https://bhumi-social-app-1.onrender.com${note.avatarUrl}`,
                            }}
                            style={{ width: 64, height: 64, borderRadius: 32 }}
                          />
                        ) : (
                          <Text
                            style={{
                              color: "#F5F5F5",
                              fontSize: 25,
                              fontWeight: "800",
                            }}
                          >
                            {String(note.username || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </Text>
                        )}
                        <View
                          style={{
                            position: "absolute",
                            top: -13,
                            left: -8,
                            right: -8,
                            minHeight: 29,
                            paddingHorizontal: 7,
                            paddingVertical: 5,
                            borderRadius: 12,
                            backgroundColor: "#000000",
                            borderWidth: 1,
                            borderColor: "#303030",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 2,
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            style={{
                              color: "#F5F5F5",
                              fontSize: 9,
                              textAlign: "center",
                            }}
                          >
                            {note.text}
                          </Text>
                        </View>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{ color: "#F5F5F5", fontSize: 12, marginTop: 7 }}
                      >
                        {note.displayName || note.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* INSTAGRAM_STYLE_INBOX_STORIES_V1 */}
                <View style={{ paddingTop: 10, paddingBottom: 8 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, alignItems: "flex-start" }}
                  >
                    {(() => {
                      const ownGroup = groupedStories.find((group) => group.own);
                      return (
                        <View style={{ width: 72, alignItems: "center" }}>
                          <Story
                            item={{
                              name: "Your story",
                              color: "#DDE7F5",
                              own: true,
                              uri: profile?.avatarUrl,
                            }}
                            onPress={() => {
                              if (ownGroup) openStoryGroup(ownGroup.items);
                              else createStory();
                            }}
                          />
                          <TouchableOpacity
                            onPress={createStory}
                            accessibilityLabel="Add story"
                            style={{
                              position: "absolute",
                              right: 5,
                              bottom: 17,
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: "#0095F6",
                              borderWidth: 2,
                              borderColor: "#000000",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="add" size={15} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                    {groupedStories
                      .filter((group) => !group.own)
                      .map((group) => (
                        <Story
                          key={"inbox-" + group.key}
                          item={{ ...group.items[0], name: group.name, own: false }}
                          onPress={() => openStoryGroup(group.items)}
                        />
                      ))}
                  </ScrollView>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    paddingHorizontal: 18,
                    marginBottom: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: "#303030",
                  }}
                >
                  {["All", "Primary", "General", "Requests"].map((tab) => {
                    const active = chatInboxTab === tab;
                    return (
                      <TouchableOpacity
                        key={tab}
                        onPress={() => setChatInboxTab(tab)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{
                          flex: 1,
                          minHeight: 43,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          borderBottomWidth: active ? 2 : 0,
                          borderBottomColor: active ? "#3797F0" : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? "#F5F5F5" : "#A8A8A8",
                            fontSize: 14,
                            fontWeight: active ? "800" : "600",
                          }}
                        >
                          {tab}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {newChatComposerOpen ? (
                  <View
                    style={{
                      marginHorizontal: 16,
                      marginBottom: 12,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: "#000000",
                    }}
                  >
                    <Text
                      style={{
                        color: "#F5F5F5",
                        fontSize: 14,
                        fontWeight: "800",
                        marginBottom: 10,
                      }}
                    >
                      New message
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#1C1C1E",
                        borderRadius: 22,
                        paddingHorizontal: 13,
                      }}
                    >
                      <Ionicons
                        name="search-outline"
                        size={19}
                        color="#737373"
                      />
                      <TextInput
                        value={newChatUsername}
                        onChangeText={setNewChatUsername}
                        placeholder="Search people by name or username"
                        placeholderTextColor="#737373"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                        style={{
                          flex: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 12,
                          color: "#F5F5F5",
                        }}
                      />
                      {newChatUsername ? (
                        <TouchableOpacity
                          onPress={() => setNewChatUsername("")}
                        >
                          <Ionicons
                            name="close-circle"
                            size={19}
                            color="#737373"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {chatPeopleBusy ? (
                      <Text style={{ color: "#A8A8A8", padding: 10 }}>
                        Searching people...
                      </Text>
                    ) : null}
                    {chatPeopleError ? (
                      <Text style={{ color: "#B42318", padding: 10 }}>
                        {chatPeopleError}
                      </Text>
                    ) : null}
                    {chatPeopleResults.map((person, index) => (
                      <TouchableOpacity
                        key={String(person.username || index)}
                        onPress={() => {
                          setNewChatComposerOpen(false);
                          setNewChatUsername("");
                          setChatPeopleResults([]);
                          openDirectChat(person.username);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 12,
                          gap: 13,
                        }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 22,
                            backgroundColor: "#1C1C1E",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {person.avatarUrl ? (
                            <Image
                              source={{
                                uri: String(person.avatarUrl).startsWith("http")
                                  ? person.avatarUrl
                                  : `https://bhumi-social-app-1.onrender.com${person.avatarUrl}`,
                              }}
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 22,
                              }}
                            />
                          ) : (
                            <Text
                              style={{ color: "#F5F5F5", fontWeight: "800" }}
                            >
                              {String(person.username || "?")
                                .slice(0, 1)
                                .toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#F5F5F5", fontWeight: "800" }}>
                            {person.displayName || person.username}
                          </Text>
                          <Text style={{ color: "#A8A8A8", fontSize: 13 }}>
                            @{person.username}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {newChatUsername.trim().length >= 2 &&
                    !chatPeopleBusy &&
                    !chatPeopleError &&
                    chatPeopleResults.length === 0 ? (
                      <Text
                        style={{
                          color: "#A8A8A8",
                          textAlign: "center",
                          padding: 12,
                        }}
                      >
                        No people found
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {chatBusy ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 9 }}>
                    <ActivityIndicator color="#3797F0" size="small" />
                    <Text style={{ color: "#A8A8A8", fontSize: 12 }}>Updating inbox…</Text>
                  </View>
                ) : null}
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 10 }}
                >
                  {getVisibleMessageConversations()
                    .map((conversation, index) => {
                      const username =
                        conversation.username ||
                        conversation.peer ||
                        conversation.otherUsername ||
                        conversation.user?.username ||
                        "";
                      if (!username) return null;
                      const unreadCount = Number(conversation.unreadCount || 0);
                      return (
                        <View
                          key={String(username) + index}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 18,
                            paddingVertical: 11,
                            gap: 10,
                          }}
                        >
                        <TouchableOpacity
                          onPress={() => openDirectChat(username)}
                          activeOpacity={0.78}
                          style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 13 }}
                        >
                          <View
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 28,
                              backgroundColor: "#1C1C1E",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              borderWidth: 0,
                              borderColor: "transparent",
                            }}
                          >
                            {conversation.avatarUrl ? (
                              <Image
                                source={{
                                  uri: String(
                                    conversation.avatarUrl,
                                  ).startsWith("http")
                                    ? conversation.avatarUrl
                                    : `https://bhumi-social-app-1.onrender.com${conversation.avatarUrl}`,
                                }}
                                style={{
                                  width: 56,
                                  height: 56,
                                  borderRadius: 28,
                                }}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text
                                style={{
                                  color: "#F5F5F5",
                                  fontSize: 22,
                                  fontWeight: "800",
                                }}
                              >
                                {String(username).slice(0, 1).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: "#F5F5F5",
                                fontSize: 15,
                                fontWeight: "700",
                              }}
                            >
                              {chatFriendPrefs["messages.chatName." + String(username).toLowerCase()] || conversation.displayName || username}
                              {chatFriendPrefs["messages.favorite." + String(username).toLowerCase()] ? "  ★" : ""}
                              {chatFriendPrefs["messages.closeFriend." + String(username).toLowerCase()] ? "  ♥" : ""}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={{
                                color: "#A8A8A8",
                                marginTop: 3,
                                fontSize: 12,
                              }}
                            >
                              {conversation.lastMessage ||
                                "Start a conversation"}
                              {String(
                                conversation.lastMessageSender || "",
                              ).toLowerCase() ===
                              String(authSession?.username || "").toLowerCase()
                                ? conversation.readAt
                                  ? " · Seen"
                                  : conversation.deliveredAt
                                    ? " · Delivered"
                                    : " · Sent"
                                : ""}
                            </Text>
                          </View>
                        </TouchableOpacity>
                          <View style={{ alignItems: "flex-end", minWidth: 38 }}>

                            <Text style={{ color: "#A8A8A8", fontSize: 13 }}>
                              {conversation.lastMessageAt
                                ? (() => {
                                    const date = new Date(
                                      conversation.lastMessageAt,
                                    );
                                    const diff = Math.max(
                                      0,
                                      Date.now() - date.getTime(),
                                    );
                                    const minutes = Math.floor(diff / 60000);
                                    if (minutes < 1) return "now";
                                    if (minutes < 60) return `${minutes}m`;
                                    if (minutes < 1440)
                                      return `${Math.floor(minutes / 60)}h`;
                                    if (minutes < 2880) return "Yesterday";
                                    return date.toLocaleDateString([], {
                                      day: "numeric",
                                      month: "short",
                                    });
                                  })()
                                : ""}
                            </Text>
                            {unreadCount > 0 ? (
                              <View
                                style={{
                                  minWidth: 20,
                                  height: 20,
                                  borderRadius: 10,
                                  backgroundColor: "#3797F0",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  paddingHorizontal: 5,
                                  marginTop: 5,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#F5F5F5",
                                    fontSize: 10,
                                    fontWeight: "800",
                                  }}
                                >
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </Text>
                              </View>
                            ) : null}
                            <TouchableOpacity
                              onPress={() => moveConversationFolder(conversation)}
                              disabled={chatFolderSaving === String(username).toLowerCase()}
                              accessibilityRole="button"
                              accessibilityLabel={conversation.folder === "general" ? "Move conversation to Primary" : conversation.isRequest ? "Accept message request to Primary" : "Move conversation to General"}
                              style={{ marginTop: 6, padding: 5, borderRadius: 8, backgroundColor: "#1C1C1E" }}
                            >
                              {chatFolderSaving === String(username).toLowerCase()
                                ? <ActivityIndicator size="small" color="#3797F0" />
                                : <Ionicons name="folder-outline" size={17} color="#A8A8A8" />}
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  {!chatBusy &&
                  !chatError &&
                  getVisibleMessageConversations().length === 0 ? (
                    <Text
                      style={{
                        color: "#A8A8A8",
                        textAlign: "center",
                        padding: 28,
                      }}
                    >
                      {messageConversations.length === 0
                        ? "No conversations yet. Start a new chat."
                        : chatUnreadOnly
                          ? "No unread messages here."
                          : chatInboxTab === "Requests"
                            ? "No message requests."
                            : "No conversations match these filters."}
                    </Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <ScrollView
                  ref={directMessagesScrollRef}
                  style={{ flex: 1, backgroundColor: chatThemeColors.bg }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  onContentSizeChange={() =>
                    directMessagesScrollRef.current?.scrollToEnd({
                      animated: true,
                    })
                  }
                  contentContainerStyle={{
                    paddingHorizontal: 14,
                    paddingVertical: 16,
                    flexGrow: 1,
                    justifyContent: "flex-end",
                  }}
                >
                  {chatBusy && directMessages.length === 0 ? (
                    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 28 }}>
                      <ActivityIndicator color="#3797F0" size="small" />
                      <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 10 }}>
                        Loading messages…
                      </Text>
                    </View>
                  ) : null}
                  {directMessages.map((message, index) => {
                    const mine =
                      String(message.sender || "").toLowerCase() ===
                      String(authSession?.username || "").toLowerCase();
                    return (
                      <View
                        key={String(message.id || index)}
                        style={{
                          width: "100%",
                          flexDirection: "row",
                          alignItems: "flex-end",
                          justifyContent: mine ? "flex-end" : "flex-start",
                          paddingHorizontal: 2,
                          marginVertical: 6,
                        }}
                      >
                        {!mine ? (
                          <View style={{ width: 27, height: 27, borderRadius: 14, marginRight: 7, marginBottom: 2, backgroundColor: "transparent", borderWidth: 1, borderColor: chatThemeColors.accent, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            {messageConversations.find((item) => String(item.username || "").toLowerCase() === selectedChatUser.toLowerCase())?.avatarUrl ? (
                              <Image source={{ uri: String(messageConversations.find((item) => String(item.username || "").toLowerCase() === selectedChatUser.toLowerCase()).avatarUrl).startsWith("http") ? messageConversations.find((item) => String(item.username || "").toLowerCase() === selectedChatUser.toLowerCase()).avatarUrl : "https://bhumi-social-app-1.onrender.com" + messageConversations.find((item) => String(item.username || "").toLowerCase() === selectedChatUser.toLowerCase()).avatarUrl }} style={{ width: 27, height: 27, borderRadius: 14 }} />
                            ) : <Text style={{ color: "#F5F5F5", fontSize: 11, fontWeight: "800" }}>{String(selectedChatUser || "?").slice(0,1).toUpperCase()}</Text>}
                          </View>
                        ) : null}
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onLongPress={() => {
                            setChatReplyTo(null);
                            setChatUnsendTarget(message);
                          }}
                          style={{
                            maxWidth: "82%",
                            backgroundColor: mine ? chatThemeColors.mine : chatThemeColors.other,
                            borderRadius: 16,
                            paddingHorizontal: 2,
                            paddingVertical: 2,
                            borderWidth: 0,
                            borderColor: "transparent",
                            elevation: 0,
                          }}
                        >
                          {message.replyToId ? (
                            <View
                              style={{
                                borderLeftWidth: 3,
                                borderLeftColor: chatThemeColors.accent,
                                backgroundColor: "transparent",
                                borderRadius: 8,
                                padding: 8,
                                marginBottom: 8,
                              }}
                            >
                              <Text
                                numberOfLines={1}
                                style={{
                                  color: "#F5F5F5",
                                  fontSize: 11,
                                  fontWeight: "800",
                                }}
                              >
                                @{message.replySender || selectedChatUser}
                              </Text>
                              <Text
                                numberOfLines={2}
                                style={{
                                  color: "#A8A8A8",
                                  fontSize: 12,
                                }}
                              >
                                {message.replyText || "Message unavailable"}
                              </Text>
                            </View>
                          ) : null}
                          {(message.attachmentUrl || message.imageUrl) ? (
  (() => {
    const attachmentPath = message.attachmentUrl || message.imageUrl;
    const attachmentUrl = attachmentPath.startsWith("http")
      ? attachmentPath
      : `https://bhumi-social-app-1.onrender.com${attachmentPath}`;
    const attachmentType = message.attachmentType || "image";
    const authHeaders = authSession?.token
      ? { Authorization: `Bearer ${authSession.token}` }
      : {};

    if (attachmentType === "image") {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setChatImagePreviewUri(attachmentUrl)}
          accessibilityRole="button"
          accessibilityLabel="Open image attachment"
        >
          <Image
            source={{ uri: attachmentUrl, headers: authHeaders }}
            style={{
              width: 230,
              height: 230,
              borderRadius: 16,
              marginBottom: message.text ? 8 : 0,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    if (attachmentType === "video") {
      return (
        <ChatVideoAttachment
          uri={attachmentUrl}
          token={authSession?.token}
          mine={mine}
        />
      );
    }

    if (attachmentType === "audio") {
      return (
        <ChatAudioAttachment
          uri={attachmentUrl}
          token={authSession?.token}
          mine={mine}
          name={message.attachmentName}
        />
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={async () => {
          try {
            if (Platform.OS !== "android") {
              await Share.share({
                message: `${message.attachmentName || "Chat attachment"}\n${attachmentUrl}`,
              });
              return;
            }

            const fileName = String(message.attachmentName || "chat-document")
              .replace(/[^a-zA-Z0-9._-]/g, "_");
            const destination = `${FileSystem.cacheDirectory}chat-${Date.now()}-${fileName}`;
            const download = await FileSystem.downloadAsync(
              attachmentUrl,
              destination,
              { headers: authHeaders }
            );
            const info = await FileSystem.getInfoAsync(download.uri);
            if (!info.exists || !info.size) {
              throw new Error("Document download अधूरा है।");
            }

            const extension = fileName.split(".").pop().toLowerCase();
            const mimeTypes = {
              pdf: "application/pdf",
              txt: "text/plain",
              doc: "application/msword",
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              xls: "application/vnd.ms-excel",
              xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ppt: "application/vnd.ms-powerpoint",
              pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              csv: "text/csv",
              rtf: "application/rtf",
            };
            const receivedMimeType = String(message.mimeType || "").toLowerCase();
            const mimeType =
              !receivedMimeType || receivedMimeType === "application/octet-stream"
                ? (mimeTypes[extension] || "*/*")
                : receivedMimeType;
            const contentUri = await FileSystem.getContentUriAsync(download.uri);

            await IntentLauncher.startActivityAsync(
              "android.intent.action.VIEW",
              {
                data: contentUri,
                type: mimeType,
                flags: 1,
              }
            );
          } catch (error) {
            Alert.alert(
              "Attachment",
              error?.message || "Document खुल नहीं सका।"
            );
          }
        }}
        style={{
          width: 230,
          padding: 14,
          borderRadius: 14,
          marginBottom: message.text ? 8 : 0,
          backgroundColor: "#1C1C1E",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Ionicons
          name="document-text"
          size={30}
          color="#F5F5F5"
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{
            color: "#F5F5F5",
            fontSize: 13,
            fontWeight: "700",
          }}>
            {message.attachmentName || "Document"}
          </Text>
          <Text style={{
            color: "#A8A8A8",
            fontSize: 11,
            marginTop: 3,
          }}>
            DOCUMENT · Tap to open
          </Text>
        </View>
      </TouchableOpacity>
    );
  })()
) : null}
                          {message.text ? (
                            <Text
                              style={{
                                color: mine ? chatThemeColors.accent : "#F5F5F5",
                                fontSize: 15,
                                lineHeight: 21,
                              }}
                            >
                              {message.text}
                            </Text>
                          ) : null}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: 6,
                              marginTop: 6,
                            }}
                          >
                            <Text
                              style={{
                                color: mine ? "#0095F6" : "#737373",
                                fontSize: 10,
                              }}
                            >
                              {message.createdAt
                                ? new Date(
                                    message.createdAt,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </Text>
                            {mine ? (
                              <Text
                                style={{
                                  color: "#F5F5F5",
                                  fontSize: 9,
                                  fontWeight: "700",
                                }}
                              >
                                {message.readAt
                                  ? "Seen"
                                  : message.deliveredAt
                                    ? "Delivered"
                                    : "Sent"}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                        {mine ? (
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              marginLeft: 7,
                              marginBottom: 2,
                              backgroundColor: "#1C1C1E",
                              borderWidth: 0,
                              borderColor: "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            {profile?.avatarUrl ? (
                              <Image
                                source={{ uri: profile.avatarUrl }}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 15,
                                }}
                              />
                            ) : (
                              <Text
                                style={{
                                  color: "#F5F5F5",
                                  fontSize: 12,
                                  fontWeight: "800",
                                }}
                              >
                                {String(authSession?.username || "Y")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  {!chatBusy && directMessages.length === 0 && !chatError ? (
                    <Text
                      style={{
                        color: "#A8A8A8",
                        textAlign: "center",
                        paddingHorizontal: 24,
                        paddingVertical: 44,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      No messages yet. Say hello! 👋
                    </Text>
                  ) : null}
                </ScrollView>
                {chatPeerTyping ? (
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 12,
                      fontWeight: "700",
                      paddingHorizontal: 18,
                      paddingVertical: 7,
                    }}
                  >
                    Typing…
                  </Text>
                ) : null}
                {chatUnsendTarget ? (
                  <View
                    style={{
                      marginHorizontal: 14,
                      marginTop: 9,
                      marginBottom: 3,
                      padding: 15,
                      borderRadius: 18,
                      backgroundColor: "#1C1C1E",
                      borderWidth: 1,
                      borderColor: "#303030",
                      elevation: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: "#F5F5F5",
                        fontSize: 12,
                        fontWeight: "700",
                        marginBottom: 9,
                      }}
                    >
                      Message options
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          setChatReplyTo(chatUnsendTarget);
                          setChatUnsendTarget(null);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                          paddingHorizontal: 17,
                          paddingVertical: 10,
                          borderRadius: 20,
                          backgroundColor: "#3797F0",
                          elevation: 1,
                        }}
                      >
                        <Text
                          style={{
                            color: "#F5F5F5",
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          Reply
                        </Text>
                      </TouchableOpacity>
                      {String(chatUnsendTarget.sender || "").toLowerCase() ===
                      String(authSession?.username || "").toLowerCase() ? (
                        <TouchableOpacity
                          disabled={chatBusy}
                          onPress={handleUnsendChatMessage}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 7,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: "#1C1C1E",
                          }}
                        >
                          <Text
                            style={{
                              color: "#C62828",
                              fontWeight: "800",
                              fontSize: 12,
                            }}
                          >
                            {chatBusy ? "Removing…" : "Unsend"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => setChatUnsendTarget(null)}
                        style={{ paddingHorizontal: 12, paddingVertical: 9 }}
                      >
                        <Text
                          style={{
                            color: "#A8A8A8",
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                {chatReplyTo ? (
                  <View
                    style={{
                      marginHorizontal: 14,
                      marginTop: 9,
                      marginBottom: 3,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 16,
                      backgroundColor: "#1C1C1E",
                      borderWidth: 1,
                      borderColor: "#303030",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontSize: 11,
                          fontWeight: "800",
                        }}
                      >
                        Replying to @{chatReplyTo.sender || selectedChatUser}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: "#A8A8A8", fontSize: 12, marginTop: 4 }}
                      >
                        {chatReplyTo.text ||
                          (chatReplyTo.imageUrl ? "Photo" : "Message")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setChatReplyTo(null)}
                      accessibilityLabel="Cancel reply"
                    >
                      <Ionicons name="close-circle" size={22} color="#737373" />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {chatError ? (
                  <Text
                    style={{
                      color: "#B42318",
                      paddingHorizontal: 16,
                      paddingTop: 8,
                      paddingBottom: 4,
                      fontSize: 12,
                    }}
                  >
                    {chatError}
                  </Text>
                ) : null}
                <View>
                  {chatMediaDraft ? (() => {
                    const draftType = String(chatMediaDraft.mimeType || chatMediaDraft.type || "").toLowerCase();
                    const draftName = chatMediaDraft.name || chatMediaDraft.fileName || "Attachment";
                    const isPhoto = draftType.startsWith("image/");
                    const isVideo = draftType.startsWith("video/");
                    const isAudio = draftType.startsWith("audio/");
                    return (
                      <View style={{
                        marginHorizontal: 14, marginTop: 10, marginBottom: 8, padding: 11,
                        flexDirection: "row", alignItems: "center", gap: 13,
                        backgroundColor: "#000000", borderRadius: 18,
                        borderWidth: 1, borderColor: "#303030", elevation: 2,
                      }}>
                        <View style={{
                          width: 66, height: 66, borderRadius: 13, overflow: "hidden",
                          backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center",
                        }}>
                          {isPhoto ? (
                            <Image source={{ uri: chatMediaDraft.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          ) : (
                            <Ionicons name={isVideo ? "videocam" : isAudio ? "mic" : "document-text"} size={32} color="#F5F5F5" />
                          )}
                        </View>
                        <View style={{ flex: 1, justifyContent: "center", gap: 5 }}>
                          <Text style={{ color: "#F5F5F5", fontSize: 14, fontWeight: "800" }}>
                            {isPhoto ? "Photo attached" : isVideo ? "Video attached" : isAudio ? "Voice message attached" : "Document attached"}
                          </Text>
                          <Text numberOfLines={2} style={{ color: "#A8A8A8", fontSize: 11, fontWeight: "500" }}>
                            {draftName} · Ready to share
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => setChatMediaDraft(null)} accessibilityLabel="Remove attachment"
                          style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#1C1C1E" }}>
                          <Ionicons name="close" size={19} color="#B42318" />
                        </TouchableOpacity>
                      </View>
                    );
                  })() : null}
                  {chatEmojiOpen ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 14,
                        backgroundColor: "#1C1C1E",
                        borderTopWidth: 1,
                        borderTopColor: "#303030",
                      }}
                    >
                      {[
                        "😀",
                        "😂",
                        "🥰",
                        "😍",
                        "😊",
                        "😭",
                        "😎",
                        "🙏",
                        "👍",
                        "❤️",
                        "🔥",
                        "🎉",
                        "😘",
                        "🤔",
                        "👏",
                        "💯",
                      ].map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => setChatDraft((v) => v + emoji)}
                          style={{
                            width: 36,
                            height: 36,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#000000",
                            borderRadius: 12,
                          }}
                        >
                          <Text style={{ fontSize: 24 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      marginBottom: Platform.OS === "android" ? 6 : 0,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: "#303030",
                      backgroundColor: "#000000",
                      gap: 9,
                      elevation: 7,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => chooseChatMedia(false)}
                      accessibilityLabel="Choose photo from gallery"
                    >
                      <Ionicons
                        name="images-outline"
                        size={25}
                        color="#F5F5F5"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => chooseChatMedia(true)}
                      accessibilityLabel="Take a photo"
                    >
                      <Ionicons
                        name="camera-outline"
                        size={25}
                        color="#F5F5F5"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={chooseChatDocument} accessibilityLabel="Attach document">
                      <Ionicons name="document-attach-outline" size={23} color="#F5F5F5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={isChatRecording ? stopChatVoiceRecording : startChatVoiceRecording}
                      disabled={chatBusy}
                      accessibilityLabel={isChatRecording ? "Stop voice recording" : "Start voice recording"}
                      style={{ width: 34, height: 40, alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name={isChatRecording ? "stop-circle" : "mic-outline"} size={24} color={isChatRecording ? "#C62828" : "#0095F6"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setChatEmojiOpen((v) => !v)}
                      accessibilityLabel="Open emoji picker"
                    >
                      <Ionicons
                        name="happy-outline"
                        size={25}
                        color="#F5F5F5"
                      />
                    </TouchableOpacity>
                    <TextInput
                      value={chatDraft}
                      onChangeText={handleChatDraftChange}
                      placeholder="Message..."
                      multiline
                      maxLength={5000}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        maxHeight: 110,
                        backgroundColor: "#1C1C1E",
                        borderWidth: 1,
                        borderColor: "#303030",
                        borderRadius: 24,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        color: "#F5F5F5",
                        fontSize: 15,
                        textAlignVertical: "center",
                      }}
                    />
                    <TouchableOpacity
                      onPress={sendChatDraft}
                      disabled={
                        chatBusy || isChatRecording || (!chatDraft.trim() && !chatMediaDraft)
                      }
                      accessibilityLabel="Send message"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#0095F6",
                        elevation: 1,
                      }}
                    >
                      <Ionicons name="send" size={19} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            <View style={[styles.bottomNav, selectedChatUser && { display: "none" }]}>
              {[
                { name: "Home", icon: "home-outline", activeIcon: "home" },
                { name: "Reels", icon: "play-outline", activeIcon: "play" },
                { name: "Chat", icon: "paper-plane-outline", activeIcon: "paper-plane" },
                { name: "Search", icon: "search-outline", activeIcon: "search" },
                { name: "Profile", icon: "person-outline", activeIcon: "person" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.navItem}
                  onPress={() => {
                    if (tab.name === "Chat") {
                      if (!messagesOpen) openMessages();
                      return;
                    }
                    closeMessages();
                    handleTab(tab.name);
                  }}
                  accessibilityLabel={tab.name}
                >
                  <Ionicons
                    name={(activeTab === tab.name || (tab.name === "Chat" && messagesOpen)) ? tab.activeIcon : tab.icon}
                    size={25}
                    color={activeTab === tab.name ? "#F5F5F5" : "#A8A8A8"}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!chatImagePreviewUri}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setChatImagePreviewUri(null)}
      >
        <View style={{ flex:1, backgroundColor:"#000000" }}>
          <View style={{ height:58, paddingHorizontal:18, flexDirection:"row", alignItems:"center", justifyContent:"flex-end" }}>
            <TouchableOpacity
              onPress={() => setChatImagePreviewUri(null)}
              accessibilityRole="button"
              accessibilityLabel="Close image preview"
              style={{ width:42, height:42, borderRadius:21, alignItems:"center", justifyContent:"center", backgroundColor:"#1C1C1E" }}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {chatImagePreviewUri ? (
            <Image
              source={{ uri:chatImagePreviewUri, headers:authSession?.token ? { Authorization:"Bearer " + authSession.token } : {} }}
              style={{ flex:1, width:"100%" }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>


      <Modal
        visible={noteComposerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteComposerOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.42)",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <View
              style={{
                backgroundColor: "#000000",
                borderRadius: 20,
                padding: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 19,
                  fontWeight: "700",
                  color: "#FFFFFF",
                  marginBottom: 14,
                }}
              >
                Your note
              </Text>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Share a thought..."
                placeholderTextColor="#A8A8A8"
                maxLength={60}
                multiline
                autoFocus
                style={{
                  minHeight: 90,
                  borderWidth: 1,
                  borderColor: "#262626",
                  borderRadius: 12,
                  padding: 12,
                  color: "#FFFFFF",
                  fontSize: 16,
                  textAlignVertical: "top",
                }}
              />
              <Text
                style={{ color: "#A8A8A8", textAlign: "right", marginTop: 6 }}
              >
                {noteDraft.length}/60
              </Text>
              {!!noteError && (
                <Text style={{ color: "#B42318", marginTop: 8 }}>
                  {noteError}
                </Text>
              )}
              <TouchableOpacity
                onPress={submitUserNote}
                disabled={!noteDraft.trim() || noteBusy}
                style={{
                  backgroundColor: "#0095F6",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginTop: 14,
                  opacity: !noteDraft.trim() || noteBusy ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {noteBusy ? "Please wait..." : "Share note"}
                </Text>
              </TouchableOpacity>
              {ownNote && (
                <TouchableOpacity
                  onPress={removeUserNote}
                  disabled={noteBusy}
                  style={{ paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ color: "#B42318", fontWeight: "600" }}>
                    Delete note
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setNoteComposerOpen(false)}
                style={{ paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#A8A8A8", fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!noteViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteViewer(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setNoteViewer(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.42)",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              backgroundColor: "#000000",
              borderRadius: 20,
              padding: 22,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#FFFFFF",
                marginBottom: 14,
              }}
            >
              {noteViewer?.displayName || noteViewer?.username || "Note"}
            </Text>
            <Text style={{ fontSize: 18, color: "#FFFFFF", lineHeight: 26 }}>
              {noteViewer?.text || ""}
            </Text>
            <TouchableOpacity
              onPress={() => setNoteViewer(null)}
              style={{
                alignSelf: "flex-end",
                marginTop: 20,
                paddingVertical: 8,
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={viewedProfileOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setViewedProfileMenuOpen(false);
          setViewedProfileOpen(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
          <View style={{
            height: 52, flexDirection: "row", alignItems: "center",
            paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#262626"
          }}>
            <TouchableOpacity onPress={() => setViewedProfileOpen(false)} style={{ width: 42 }}>
              <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
            </TouchableOpacity>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>
              {viewedProfile ? `@${viewedProfile.username}` : "Profile"}
            </Text>
            {viewedProfile && String(viewedProfile.username || "").toLowerCase() !== String(authSession?.username || "").toLowerCase() ? (
              <TouchableOpacity onPress={() => setViewedProfileMenuOpen(v => !v)} style={{ padding: 8 }}>
                <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : <View style={{ width: 38 }} />}
          </View>

          {viewedProfileBusy && !viewedProfile ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "#A8A8A8" }}></Text>
            </View>
          ) : viewedProfile ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {viewedProfile.avatarUrl ? (
                    <Image source={{ uri: viewedProfile.avatarUrl }}
                      style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: "#1C1C1E" }} />
                  ) : (
                    <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 32, fontWeight: "800", color: "#FFFFFF" }}>
                        {String(viewedProfile.displayName || viewedProfile.username || "?").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-evenly", marginLeft: 12 }}>
                    {[
                      ["postsCount", "Posts"],
                      ["followersCount", "Followers"],
                      ["followingCount", "Following"]
                    ].map(([field, label]) => (
                      <TouchableOpacity
                        key={field}
                        disabled={field === "postsCount"}
                        onPress={() => openProfileConnections(viewedProfile.username, field === "followersCount" ? "followers" : "following")}
                        activeOpacity={0.7}
                        style={{ alignItems: "center", paddingHorizontal: 3 }}
                      >
                        <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFFFFF" }}>{viewedProfile[field] || 0}</Text>
                        <Text style={{ color: "#A8A8A8", fontSize: 12 }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ marginTop: 13 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
                    {viewedProfile.displayName || viewedProfile.username}
                  </Text>
                  <Text style={{ color: "#A8A8A8", marginTop: 2, fontSize: 12 }}>
                    @{viewedProfile.username}
                  </Text>
                  {!!viewedProfile.bio && (
                    <Text style={{ color: "#FFFFFF", marginTop: 6, lineHeight: 20 }}>{viewedProfile.bio}</Text>
                  )}
                </View>

                {viewedProfile.accountType === "business" && viewedProfile.businessProfile && (
                  <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: "#111111", borderWidth: 1, borderColor: "#292929" }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "900" }}>
                      {viewedProfile.businessProfile.businessName || viewedProfile.displayName || "Business"}
                    </Text>
                    {!!viewedProfile.businessProfile.category && (
                      <Text style={{ color: "#B7A5FF", fontSize: 12, fontWeight: "700", marginTop: 4 }}>
                        {viewedProfile.businessProfile.category}
                      </Text>
                    )}
                    {!!viewedProfile.businessProfile.description && (
                      <Text style={{ color: "#E6E6E6", fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                        {viewedProfile.businessProfile.description}
                      </Text>
                    )}
                    {!!(viewedProfile.businessProfile.area || viewedProfile.businessProfile.city || viewedProfile.businessProfile.state) && (
                      <Text style={{ color: "#C8C8C8", fontSize: 12, marginTop: 9 }}>
                        <Ionicons name="location-outline" size={13} color="#A8A8A8" /> {[viewedProfile.businessProfile.area, viewedProfile.businessProfile.city, viewedProfile.businessProfile.state, viewedProfile.businessProfile.pincode].filter(Boolean).join(", ")}
                      </Text>
                    )}
                    {!!viewedProfile.businessProfile.serviceAreas && (
                      <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 6 }}>Service areas: {viewedProfile.businessProfile.serviceAreas}</Text>
                    )}
                    {!!viewedProfile.businessProfile.openingHours && (
                      <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 6 }}>Hours: {viewedProfile.businessProfile.openingHours}</Text>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
                      {!!viewedProfile.businessProfile.phone && (
                        <TouchableOpacity onPress={() => Linking.openURL("tel:" + viewedProfile.businessProfile.phone.replace(/[^0-9+]/g, ""))} style={{ backgroundColor: "#242424", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Call</Text>
                        </TouchableOpacity>
                      )}
                      {!!viewedProfile.businessProfile.whatsapp && (
                        <TouchableOpacity onPress={() => Linking.openURL("https://wa.me/" + viewedProfile.businessProfile.whatsapp.replace(/[^0-9]/g, ""))} style={{ backgroundColor: "#242424", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>WhatsApp</Text>
                        </TouchableOpacity>
                      )}
                      {!!viewedProfile.businessProfile.website && (
                        <TouchableOpacity onPress={() => Linking.openURL(/^https?:\/\//i.test(viewedProfile.businessProfile.website) ? viewedProfile.businessProfile.website : "https://" + viewedProfile.businessProfile.website)} style={{ backgroundColor: "#242424", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Website</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {!!viewedProfile.businessCatalog?.length && (
                  <View style={{ marginTop: 13 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginBottom: 8 }}>Products & Services</Text>
                    {viewedProfile.businessCatalog.slice(0, 6).map((item) => (
                      <View key={String(item.id)} style={{ padding: 11, marginBottom: 7, borderRadius: 10, backgroundColor: "#151515", borderWidth: 1, borderColor: "#292929" }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{item.title}</Text>
                        {!!item.description && <Text style={{ color: "#A8A8A8", fontSize: 12, marginTop: 3 }}>{item.description}</Text>}
                        {!!item.price && <Text style={{ color: "#B7A5FF", fontSize: 12, marginTop: 5 }}>{item.price}</Text>}
                      </View>
                    ))}
                  </View>
                )}

                {String(viewedProfile.username || "").toLowerCase() !== String(authSession?.username || "").toLowerCase() && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 15 }}>
                    <TouchableOpacity disabled={viewedProfileFollowBusy}
                      onPress={handleToggleViewedProfileFollow} activeOpacity={0.8}
                      style={{
                        flex: 1, height: 36, borderRadius: 9, alignItems: "center",
                        justifyContent: "center", flexDirection: "row",
                        backgroundColor: viewedProfile.isFollowing || viewedProfile.followRequestStatus === "pending" ? "#EFEFEF" : "#262626",
                        opacity: viewedProfileFollowBusy ? 0.6 : 1
                      }}>
                      <Text style={{
                        color: viewedProfile.isFollowing || viewedProfile.followRequestStatus === "pending" ? "#222222" : "#FFFFFF",
                        fontWeight: "800", fontSize: 13
                      }}>
                        {viewedProfileFollowBusy ? "Please wait..." :
                          viewedProfile.isFollowing ? "Following" :
                          viewedProfile.followRequestStatus === "pending" ? "Requested" :
                          viewedProfile.followsYou ? "Follow Back" : "Follow"}
                      </Text>
                      {(viewedProfile.isFollowing || viewedProfile.followRequestStatus === "pending") && (
                        <Ionicons name="chevron-down" size={14} color="#222222" style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        const username = viewedProfile.username;
                        setViewedProfileOpen(false);
                        setMessagesOpen(true);
                        await openDirectChat(username);
                      }}
                      activeOpacity={0.8}
                      style={{ flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#1C1C1E" }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>Message</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(() => {
                  const username = String(viewedProfile.username || "").trim().toLowerCase();
                  const stories = serverStories.filter(item =>
                    String(item.user || item.name || "").trim().toLowerCase() === username
                  );
                  return (
                    <View style={{ marginTop: 19 }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "800", marginBottom: 10 }}>Status</Text>
                      {stories.length ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {stories.map((story, index) => (
                            <Story key={String(story.id || story._id || index)}
                              item={{ ...story, name: viewedProfile.displayName || viewedProfile.username, own: false }}
                              onPress={() => openStoryGroup(stories)} />
                          ))}
                        </ScrollView>
                      ) : <Text style={{ color: "#A8A8A8", fontSize: 13 }}>No status yet</Text>}
                    </View>
                  );
                })()}
              </View>

              <View style={{ flexDirection: "row", borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#262626", marginTop: 18 }}>
                {[["posts", "grid-outline"], ["tagged", "person-outline"]].map(([tab, icon]) => (
                  <TouchableOpacity key={tab} onPress={() => setViewedProfileTab(tab)}
                    style={{
                      flex: 1, height: 46, alignItems: "center", justifyContent: "center",
                      borderBottomWidth: viewedProfileTab === tab ? 2 : 0, borderBottomColor: "#262626"
                    }}>
                    <Ionicons name={icon} size={22} color={viewedProfileTab === tab ? "#FFFFFF" : "#999999"} />
                  </TouchableOpacity>
                ))}
              </View>

              {viewedProfileTab === "posts" ? (
                viewedProfilePostsBusy ? (
                  <Text style={{ textAlign: "center", padding: 28, color: "#A8A8A8" }}></Text>
                ) : viewedProfilePosts.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {viewedProfilePosts.map((post, index) => (
                      <View key={String(post.id || post._id || index)} style={{ width: "33.3333%", aspectRatio: 1, padding: 1 }}>
                        {(post.uri || post.mediaUrl) ? (
                          <Image source={{ uri: post.uri || post.mediaUrl }}
                            style={{ width: "100%", height: "100%", backgroundColor: "#1C1C1E" }} resizeMode="cover" />
                        ) : (
                          <View style={{ flex: 1, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center", padding: 5 }}>
                            <Text numberOfLines={3} style={{ fontSize: 10, color: "#FFFFFF" }}>{post.caption || "Post"}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 48 }}>
                    <Ionicons name="camera-outline" size={42} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800", marginTop: 10 }}>No posts yet</Text>
                  </View>
                )
              ) : (
                <View style={{ alignItems: "center", paddingVertical: 48 }}>
                  <Ionicons name="images-outline" size={38} color="#555555" />
                  <Text style={{ color: "#A8A8A8", marginTop: 10 }}>No tagged photos yet</Text>
                </View>
              )}
            </ScrollView>
          ) : null}

          {viewedProfileMenuOpen && viewedProfile && (
            <View style={{
              position: "absolute", top: 52, right: 12, width: 235,
              backgroundColor: "#151020", borderWidth: 1, borderColor: "#30253E", borderRadius: 14, paddingVertical: 5,
              elevation: 8, shadowColor: "#FFFFFF", shadowOpacity: 0.14,
              shadowRadius: 12, shadowOffset: { width: 0, height: 5 }
            }}>
              <TouchableOpacity onPress={() => {
                setViewedProfileMenuOpen(false);
                const username = String(viewedProfile.username || "").replace(/^@/, "").trim();
                const profileLink = `bhumisocial://profile/${encodeURIComponent(username)}`;
                Share.share({
                  title: `@${username} on Bhumi Social AI`,
                  message: `View @${username}'s profile on Bhumi Social AI:\n${profileLink}\n\nGet Bhumi Social AI: https://bhumi-social-app-1.onrender.com/download`,
                });
              }} style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
                <Text style={{ color: "#F5F5F5", fontSize: 14 }}>Share Profile</Text>
              </TouchableOpacity>
              <View style={{ height: 0.5, backgroundColor: "#30253E" }} />
              <TouchableOpacity disabled={viewedProfileBlockBusy} onPress={handleBlockViewedProfile} style={{ paddingHorizontal: 16, paddingVertical: 13, opacity: viewedProfileBlockBusy ? 0.55 : 1 }}>
                <Text style={{ color: "#FF6B7A", fontSize: 14, fontWeight: "700" }}>
                  {viewedProfileBlockBusy ? "Blocking…" : "Block Account"}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 0.5, backgroundColor: "#30253E" }} />
              <TouchableOpacity disabled={viewedProfileRestrictBusy} onPress={() => {
                setViewedProfileMenuOpen(false);
                handleToggleViewedProfileRestriction();
              }} style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
                <Text style={{ color: "#F5F5F5", fontSize: 14 }}>
                  {viewedProfileRestricted ? "Unrestrict" : "Restrict"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={profileConnectionsOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setProfileConnectionsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
          <View style={{
            minHeight: 54, flexDirection: "row", alignItems: "center",
            paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#303030"
          }}>
            <TouchableOpacity onPress={() => setProfileConnectionsOpen(false)} style={{ padding: 8, marginRight: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#F5F5F5", fontSize: 17, fontWeight: "800" }}>
                {profileConnectionsType === "followers" ? "Followers" : "Following"}
              </Text>
              <Text style={{ color: "#A8A8A8", fontSize: 11 }}>@{profileConnectionsUsername}</Text>
            </View>
            <TouchableOpacity onPress={() => setProfileConnectionsOpen(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#0095F6" />
            </TouchableOpacity>
          </View>
          {profileConnectionsBusy ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color="#0095F6" />
              <Text style={{ color: "#A8A8A8", marginTop: 12 }}></Text>
            </View>
          ) : profileConnectionsError ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Text style={{ color: "#F5F5F5", textAlign: "center" }}>{profileConnectionsError}</Text>
              <TouchableOpacity onPress={() => openProfileConnections(profileConnectionsUsername, profileConnectionsType)} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: "#262626" }}>
                <Text style={{ color: "#F5F5F5", fontWeight: "800" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : profileConnectionsItems.length ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}>
              {profileConnectionsItems.map((entry, index) => {
                const username = String(entry?.username || entry?.user || entry || "").replace(/^@/, "").trim();
                if (!username) return null;
                return (
                  <TouchableOpacity
                    key={username + "-" + index}
                    onPress={() => {
                      setProfileConnectionsOpen(false);
                      openUserProfile(username);
                    }}
                    activeOpacity={0.75}
                    style={{ minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#303030", gap: 12 }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#F5F5F5", fontSize: 18, fontWeight: "800" }}>{username.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#F5F5F5", fontSize: 14, fontWeight: "800" }}>@{username}</Text>
                      <Text style={{ color: "#A8A8A8", fontSize: 11 }}>View profile</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#0095F6" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Ionicons name="people-outline" size={42} color="#A8A8A8" />
              <Text style={{ color: "#F5F5F5", fontSize: 16, fontWeight: "800", marginTop: 12 }}>
                No {profileConnectionsType} yet
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={notificationsListOpen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setNotificationsListOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000",
            justifyContent: "flex-start",
            paddingBottom: 0,
          }}
        >
          <View
            style={{
              height: "100%",
              backgroundColor: "#000000",
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              paddingTop: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#303030",
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: "#F5F5F5" }}
              >
                Notifications
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
              >
                {unreadNotificationCount > 0 ? (
                  <TouchableOpacity onPress={handleReadAllNotifications}>
                    <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>
                      Mark all read
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => setNotificationsListOpen(false)}
                >
                  <Ionicons name="close" size={27} color="#0095F6" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
              {["All", "Likes", "Comments", "Follows", "Messages"].map((filter) => (
                <TouchableOpacity key={filter} onPress={() => setNotificationFilter(filter)}
                  style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 18, backgroundColor: notificationFilter === filter ? "#0095F6" : "#262626" }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{filter}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {notificationsLoading ? (
              <ActivityIndicator color="#0095F6" size="small" style={{ marginTop: 28 }} />
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {notificationsList.filter((item) => {
                  if (notificationFilter === "All") return true;
                  if (notificationFilter === "Likes") return item.kind === "like" || item.kind === "reel_like";
                  if (notificationFilter === "Comments") return item.kind === "comment" || item.kind === "reel_comment";
                  if (notificationFilter === "Messages") return item.kind === "message";
                  return ["follow", "follow_request", "follow_accepted", "follow_rejected"].includes(item.kind);
                }).map((item, index) => {
                  const actor = item.actor ? "@" + item.actor : "Someone";
                  const messages = {
                    follow_request: "sent you a follow request",
                    follow: "started following you",
                    follow_accepted: "accepted your follow request",
                    follow_rejected: "declined your follow request",
                    like: "liked your post",
                    comment: "commented on your post",
                    reel_like: "liked your reel",
                    reel_comment: "commented on your reel",
                    message: "sent you a message",
                    mention_posts: "mentioned you in a post",
                    mention_stories: "mentioned you in a story/status",
                    mention_reels: "mentioned you in a reel",
                  };
                  return (
                    <TouchableOpacity
                      key={String(item.id || index)}
                      onPress={() => handleNotificationPress(item)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 18,
                        paddingVertical: 16,
                        backgroundColor: item.isRead ? "#000000" : "#121212",
                        borderBottomWidth: 1,
                        borderBottomColor: "#303030",
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: "#262626",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <Ionicons
                          name={
                            item.kind === "like" || item.kind === "reel_like"
                              ? "heart"
                              : item.kind === "comment" || item.kind === "reel_comment"
                                ? "chatbubble"
                                : item.kind === "message"
                                  ? "paper-plane"
                                  : "person"
                          }
                          size={21}
                          color="#0095F6"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "#F5F5F5",
                            fontSize: 14,
                            lineHeight: 20,
                          }}
                        >
                          <Text style={{ fontWeight: "800" }}>{actor}</Text>{" "}
                          {messages[item.kind] || "sent you a notification"}
                        </Text>
                        <Text
                          style={{
                            color: "#A8A8A8",
                            fontSize: 11,
                            marginTop: 5,
                          }}
                        >
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString()
                            : ""}
                        </Text>
                      </View>
                      {!item.isRead ? (
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: "#0095F6",
                            marginLeft: 8,
                          }}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {notificationsList.filter((item) => {
                  if (notificationFilter === "All") return true;
                  if (notificationFilter === "Likes") return item.kind === "like" || item.kind === "reel_like";
                  if (notificationFilter === "Comments") return item.kind === "comment" || item.kind === "reel_comment";
                  return ["follow", "follow_request", "follow_accepted", "follow_rejected"].includes(item.kind);
                }).length === 0 ? (
                  <View style={{ alignItems: "center", padding: 36 }}>
                    <Ionicons name="notifications-outline" size={34} color="#A8A8A8" />
                    <Text style={{ color: "#F5F5F5", fontSize: 14, fontWeight: "700", marginTop: 10 }}>
                      {notificationsList.length === 0 ? "No notifications yet." : "No " + notificationFilter.toLowerCase() + " notifications."}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={reelCommentsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReelCommentsOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            paddingBottom: Platform.OS === "android" ? 38 : 0,
            backgroundColor: "rgba(0,0,0,0.38)",
          }}
        >
          <View
            style={{
              height: "76%",
              backgroundColor: "#000000",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#262626",
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "800" }}
              >
                Reel comments
              </Text>
              <TouchableOpacity onPress={() => setReelCommentsOpen(false)}>
                <Ionicons name="close" size={27} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {reelCommentsBusy && reelComments.length === 0 ? (
              <Text
                style={{ color: "#A8A8A8", textAlign: "center", padding: 24 }}
              >
                
              </Text>
            ) : null}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingVertical: 10,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {reelComments.map((item, index) => (
                <View
                  key={String(item.id || index)}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "#262626",
                  }}
                >
                  <Text
                    style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 21 }}
                  >
                    <Text style={{ fontWeight: "800" }}>
                      @{item.username || "user"}{" "}
                    </Text>
                    {item.text}
                  </Text>
                  {!!item.createdAt ? (
                    <Text
                      style={{ color: "#A8A8A8", fontSize: 10, marginTop: 4 }}
                    >
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  ) : null}
                  {item.isPending ? (
                    <Text
                      style={{ color: "#B7791F", fontSize: 11, marginTop: 4 }}
                    >
                      Pending approval
                    </Text>
                  ) : null}
                  {item.isPending && item.canApprove ? (
                    <TouchableOpacity
                      onPress={() => handleApproveReelComment(item.id)}
                      disabled={reelCommentsBusy}
                      style={{
                        alignSelf: "flex-start",
                        marginTop: 6,
                        paddingVertical: 5,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: "#1C1C1E",
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        Approve
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {!reelCommentsBusy && reelComments.length === 0 ? (
                <Text
                  style={{ color: "#A8A8A8", textAlign: "center", padding: 28 }}
                >
                  No comments yet. Be the first to comment.
                </Text>
              ) : null}
            </ScrollView>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: "#262626",
                gap: 9,
              }}
            >
              <TextInput
                value={reelCommentDraft}
                onChangeText={setReelCommentDraft}
                placeholder="Add a comment..."
                placeholderTextColor="#A8A8A8"
                maxLength={2000}
                editable={!reelCommentsBusy}
                style={{
                  flex: 1,
                  backgroundColor: "#1C1C1E",
                  borderRadius: 22,
                  paddingHorizontal: 15,
                  paddingVertical: 11,
                  color: "#FFFFFF",
                }}
              />
              <TouchableOpacity
                onPress={handleSubmitReelComment}
                disabled={reelCommentsBusy || !reelCommentDraft.trim()}
                style={{ paddingHorizontal: 10, paddingVertical: 9 }}
              >
                <Text
                  style={{
                    color:
                      reelCommentsBusy || !reelCommentDraft.trim()
                        ? "#AAB4C0"
                        : "#1685D9",
                    fontWeight: "800",
                  }}
                >
                  Post
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={savedScreenOpen}
        animationType="slide"
        onRequestClose={() => setSavedScreenOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0614" }}>
          <View
            style={{
              height: 58,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: "#262626",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <TouchableOpacity onPress={() => setSavedScreenOpen(false)}>
                <Ionicons name="arrow-back" size={25} color="#0095F6" />
              </TouchableOpacity>
              <Text
                style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "800" }}
              >
                Saved
              </Text>
            </View>
            <TouchableOpacity onPress={handleOpenSavedScreen}>
              <Ionicons name="refresh" size={22} color="#0095F6" />
            </TouchableOpacity>
          </View>
          {savedContentBusy ? (
            <Text
              style={{ color: "#A8A8A8", textAlign: "center", padding: 30 }}
            >
              
            </Text>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "flex-start",
                  gap: 6,
                }}
              >
                {savedContent.map((item, index) => (
                  <View
                    key={`${item.kind || "content"}-${item.id || index}`}
                    style={{
                      width: "32%",
                      aspectRatio: 0.82,
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: "#1C1C1E",
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleOpenSavedItem(item)}
                      style={{ flex: 1 }}
                    >
                      {item.uri && item.mediaType !== "video" ? (
                        <Image
                          source={{ uri: item.uri }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor:
                              item.mediaType === "video"
                                ? "#202638"
                                : "#EEF1F5",
                          }}
                        >
                          <Ionicons
                            name={
                              item.mediaType === "video" ||
                              item.kind === "reels"
                                ? "play-circle"
                                : "image"
                            }
                            size={42}
                            color={
                              item.mediaType === "video" ||
                              item.kind === "reels"
                                ? "#FFFFFF"
                                : "#718096"
                            }
                          />
                        </View>
                      )}
                      <View
                        style={{
                          position: "absolute",
                          left: 5,
                          top: 5,
                          paddingHorizontal: 6,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: "rgba(0,0,0,0.42)",
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 9,
                            fontWeight: "700",
                          }}
                        >
                          {item.kind === "reels" ? "REEL" : "POST"}
                        </Text>
                      </View>
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          padding: 6,
                          backgroundColor: "rgba(0,0,0,0.48)",
                        }}
                      >
                        <Text
                          numberOfLines={2}
                          style={{ color: "#FFFFFF", fontSize: 10 }}
                        >
                          {item.caption ||
                            `@${item.user || item.username || "user"}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveSavedItem(item)}
                      style={{
                        position: "absolute",
                        right: 5,
                        top: 5,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.52)",
                      }}
                    >
                      <Ionicons name="bookmark" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {!savedContent.length ? (
                <View style={{ alignItems: "center", padding: 45 }}>
                  <Ionicons name="bookmark-outline" size={42} color="#A0A8B4" />
                  <Text style={{ color: "#A8A8A8", marginTop: 12 }}>
                    Nothing saved yet.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={appPinLocked && !!authSession}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={{ flex:1,backgroundColor:"#000000",justifyContent:"center",paddingHorizontal:28 }}>
          <View style={{ backgroundColor:"#121212",borderWidth:1,borderColor:"#303030",borderRadius:22,padding:22,alignItems:"center" }}>
            <View style={{ width:64,height:64,borderRadius:32,backgroundColor:"#1C1C1E",alignItems:"center",justifyContent:"center",marginBottom:14 }}>
              <Ionicons name="lock-closed" size={29} color="#0095F6"/>
            </View>
            <Text style={{ color:"#FFFFFF",fontSize:21,fontWeight:"900" }}>Bhumi Social AI Locked</Text>
            <Text style={{ color:"#A8A8A8",fontSize:12,textAlign:"center",lineHeight:18,marginTop:7 }}>Enter your device App PIN to continue.</Text>
            <TextInput
              value={appPinInput}
              onChangeText={(value)=>{setAppPinInput(value.replace(/\D/g,"").slice(0,6));setAppPinError("");}}
              placeholder="Enter 4–6 digit PIN"
              placeholderTextColor="#777777"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
              style={{ width:"100%",color:"#FFFFFF",borderWidth:1,borderColor:"#3A3A3A",borderRadius:13,padding:14,marginTop:18,fontSize:20,textAlign:"center",letterSpacing:8 }}
            />
            {appPinError ? <Text style={{ color:"#F08080",fontSize:12,marginTop:9 }}>{appPinError}</Text> : null}
            {appBiometricEnabled ? (
              <TouchableOpacity
                onPress={async()=>{
                  try {
                    const result = await LocalAuthentication.authenticateAsync({
                      promptMessage:"Unlock Bhumi Social AI",
                      cancelLabel:"Use App PIN",
                      disableDeviceFallback:true,
                    });
                    if (result.success) {
                      setAppPinLocked(false);
                      setAppPinInput("");
                      setAppPinError("");
                    }
                  } catch (error) {
                    setAppPinError(error?.message || "Biometric unlock failed. Use your App PIN.");
                  }
                }}
                style={{ width:"100%",backgroundColor:"#17354A",borderRadius:13,padding:13,alignItems:"center",marginTop:14,flexDirection:"row",justifyContent:"center" }}
              >
                <Ionicons name="finger-print" size={19} color="#8CCBFF"/>
                <Text style={{ color:"#8CCBFF",fontWeight:"900",marginLeft:8 }}>Unlock with Biometrics</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={()=>{
                if (appLockPinRef.current && appPinInput === appLockPinRef.current) {
                  setAppPinLocked(false);
                  setAppPinInput("");
                  setAppPinError("");
                } else {
                  setAppPinError("PIN सही नहीं है। दोबारा कोशिश करें।");
                  setAppPinInput("");
                }
              }}
              style={{ width:"100%",backgroundColor:"#0095F6",borderRadius:13,padding:14,alignItems:"center",marginTop:15 }}
            >
              <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>Unlock App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async()=>{
                try { await clearAuthSession(); } catch (_) {}
                setAuthSession(null);
                setAppPinLocked(false);
                setAppPinInput("");
              }}
              style={{ padding:13,marginTop:4 }}
            >
              <Text style={{ color:"#A8A8A8",fontWeight:"800" }}>Sign out instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <CustomAlertHost />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  content: { flex: 1 },
  header: {
    height: 58,
    marginTop: 0,
    paddingTop: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#262626",
    backgroundColor: "#000000",
  },
  brand: {
    flex: 1,
    textAlign: "left",
    fontSize: 18,
    fontWeight: "800",
    color: "#F5F5F5",
    letterSpacing: -0.4,
  },
  headerSideSpacer: { width: 116 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 19 },
  headerIcon: { fontSize: 27, color: "#0095F6" },
  stories: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  story: { width: 68, alignItems: "center" },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 0,
    borderWidth: 2,
    borderColor: "#F56040",
    alignItems: "center",
    justifyContent: "center",
  },
  storyInnerRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#C13584",
    alignItems: "center",
    justifyContent: "center",
  },
  ownRing: { borderColor: "#404040" },
  ownStoryInnerRing: { borderColor: "#404040" },
  storyAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { fontSize: 30, color: "#FFFFFF" },
  avatarLetter: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  storyName: { marginTop: 5, fontSize: 11, color: "#F5F5F5" },
  feedDivider: { height: 1, backgroundColor: "#262626" },
  post: {
    marginHorizontal: 0,
    marginBottom: 10,
    backgroundColor: "#000000",
    borderWidth: 0,
    borderColor: "#000000",
    borderRadius: 0,
    overflow: "hidden",
  },
  postHeader: {
    height: 58,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  smallAvatarText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  postUserInfo: { flex: 1, marginLeft: 10 },
  username: { fontSize: 14, fontWeight: "700", color: "#F5F5F5" },
  location: { marginTop: 2, fontSize: 11, color: "#A8A8A8" },
  more: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0095F6",
    paddingHorizontal: 5,
  },
  postImage: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  postEmoji: { fontSize: 112 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingTop: 10,
    gap: 20,
  },
  actionIcon: { fontSize: 28, color: "#F5F5F5" },
  liked: { color: "#E1306C" },
  actionSpacer: { flex: 1 },
  likes: {
    marginHorizontal: 13,
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  caption: {
    marginHorizontal: 13,
    marginTop: 5,
    fontSize: 13,
    color: "#F5F5F5",
    lineHeight: 19,
  },
  comments: {
    marginHorizontal: 13,
    marginTop: 5,
    color: "#A8A8A8",
    fontSize: 12,
  },
  time: {
    marginHorizontal: 13,
    marginTop: 6,
    fontSize: 9,
    color: "#A8A8A8",
    letterSpacing: 0.6,
  },
  bottomNav: {
    height: Platform.OS === "android" ? 72 : 62,
    paddingBottom: Platform.OS === "android" ? 16 : 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#262626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#000000",
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navIcon: { fontSize: 24, color: "#8E8E93" },
  activeNavIcon: { color: "#0095F6", fontWeight: "800" },
  navLabel: { fontSize: 9, color: "#A8A8A8", marginTop: 1 },
  activeNavLabel: { color: "#0095F6", fontWeight: "800" },
});

// Android APK rebuild trigger for the latest integrated master changes.

// Rebuild APK after the Settings light-theme integration.
