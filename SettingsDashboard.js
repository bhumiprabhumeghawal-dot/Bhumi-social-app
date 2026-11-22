import React from "react";
import {
  Modal, View, Text, TextInput, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Linking, Platform, StyleSheet, Image, Share
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import CreatorBusinessHub from "./CreatorBusinessHub";
import { loadSettingsPreferences, saveSettingsPreferences, loadNotificationPreference, saveNotificationPreference, loadNotificationDetails, saveNotificationDetails, loadLoginHistory, loadActiveSessions, revokeActiveSession, logoutOtherSessions, loadLocationShares, createOrUpdateLocationShare, stopLocationShare } from "./api";

const GOLD = "#0095F6";
const BG = "#000000";
const PANEL = "#121212";
const BORDER = "#262626";
const TEXT = "#F5F5F5";
const MUTED = "#A8A8A8";
const BACKGROUND_LOCATION_TASK = "BHUMI_SOCIAL_LIVE_LOCATION";
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const point = data?.locations?.[0];
    if (!point) return;
    try {
      const [shareId, recipient, duration, approximate] = await Promise.all([
        SecureStore.getItemAsync("bhumi_live_share_id"),
        SecureStore.getItemAsync("bhumi_live_share_recipient"),
        SecureStore.getItemAsync("bhumi_live_share_duration"),
        SecureStore.getItemAsync("bhumi_live_share_approximate"),
      ]);
      if (!shareId || !recipient) return;
      const latitude = approximate === "true" ? Math.round(point.coords.latitude * 100) / 100 : point.coords.latitude;
      const longitude = approximate === "true" ? Math.round(point.coords.longitude * 100) / 100 : point.coords.longitude;
      await createOrUpdateLocationShare({ share_id:shareId, recipient_username:recipient, latitude, longitude, accuracy:point.coords.accuracy, duration_minutes:Number(duration) || 60 });
    } catch (taskError) {
      console.warn("Background location update failed:", taskError?.message || taskError);
      await Promise.all([
        SecureStore.deleteItemAsync("bhumi_live_share_id"),
        SecureStore.deleteItemAsync("bhumi_live_share_recipient"),
        SecureStore.deleteItemAsync("bhumi_live_share_duration"),
        SecureStore.deleteItemAsync("bhumi_live_share_approximate"),
      ]).catch(() => {});
      try { await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); } catch (_) {}
    }
  });
}

async function measureDirectoryBytes(directory) {
  if (!directory) return 0;
  let total = 0;
  let entries = [];
  try { entries = await FileSystem.readDirectoryAsync(directory); } catch (_) { return 0; }
  for (const entry of entries) {
    const path = directory.endsWith("/") ? directory + entry : directory + "/" + entry;
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) continue;
      if (info.isDirectory) total += await measureDirectoryBytes(path);
      else total += Number(info.size || 0);
    } catch (_) {}
  }
  return total;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + " MB";
  return (value / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

const ACTION_KEYS = new Set([
  "profile.usernameChange","account.profileQr","account.multipleAccounts","account.verification",
  "account.dataDownload","account.deactivation","account.deletion",
  "security.twoFactor","security.loginHistory","security.activeDevices","security.appLock",
  "security.fingerprint","security.faceUnlock","security.pin","security.checkup",
  "privacy.profileVisitors","privacy.hiddenWords",
  "story.hideFrom","story.highlights","story.closeFriends","feed.mutedAccounts","feed.favorites",
  "appearance.appIcon","appearance.display","appearance.chat",
  "advanced.permissions","advanced.reset","advanced.storage","advanced.clearCache",
  "creator.accountType","creator.businessAccount","creator.dashboard","creator.insights","creator.followerAnalytics","creator.contentAnalytics","creator.audience","creator.monetization","creator.collaboration","creator.promotions","premium.profileStudio",
  "account.reportProblem","account.helpCenter","account.appUpdates",
  "account.appVersionInfo","account.terms","account.privacyPolicy","account.openSource",
  "location.history","location.liveSharing","location.nearbyFriends"
]);

const SECTIONS = [
  { key:"account", title:"Account Settings", subtitle:"Personal details and account controls", icon:"person-circle-outline", fields:[
    ["profile.usernameChange","Change Username","Update your public username",false],
    ["account.profileQr","Profile QR Code","Share your profile using a QR code",true],
    ["account.multipleAccounts","Multiple Account Management","Manage additional accounts",false],
    ["account.verification","Profile Verification Request","Request profile verification",false],
    ["account.dataDownload","Download Your Data","Request an export of your account data",false],
    ["account.deactivation","Deactivate Account","Temporarily deactivate your account",false],
    ["account.deletion","Delete Account Request","Start a protected account deletion request",false],
  ]},
  { key:"location", title:"Location Settings", subtitle:"Live sharing and nearby discovery", icon:"location-outline", fields:[
    ["location.liveSharing","Live Location Sharing","Allow selected friends to see your live location",false],
    ["location.nearbyFriends","Nearby Friends","Show you to friends who also enable this feature",false],
    ["location.approximate","Approximate Location","Share an approximate area instead of exact coordinates",true],
    ["location.locationTag","Location Tags","Allow adding a location to posts and stories",true],
    ["location.background","Background Location","Continue sharing while the app is backgrounded; requires Always permission and a visible system notification",false],
    ["location.history","Location Sharing History","Keep a list of active and recent shares",false],
  ]},
  { key:"privacy", title:"Privacy Settings", subtitle:"Control who can see and contact you", icon:"shield-checkmark-outline", legacy:"privacy", fields:[
    ["privacy.onlineStatus","Show Online Status","Let others see when you are active",true],
    ["privacy.readReceipts","Read Receipts","Let chat participants know when messages are read",true],
    ["privacy.profileVisitors","Profile Visitor History","Allow an optional profile visit history",false],
    ["privacy.tags","Allow Tags","Control who can tag you",true],
    ["privacy.mentions","Allow Mentions","Control who can mention you",true],
    ["privacy.comments","Allow Comments","Control who can comment on your posts",true],
    ["privacy.storyReplies","Story Replies","Allow replies to your stories",true],
    ["privacy.privateAccount","Private Account","Require approval before new people follow you",false],
    ["privacy.lastSeen","Last Seen","Control who can see your last active time",true],
    ["privacy.followers","Who Can Follow Me","Control follow permissions",true],
    ["privacy.messageAccess","Who Can Message Me","Control who can start a conversation",true],
    ["privacy.hiddenWords","Hidden Words","Filter offensive comments and message requests",false],
    ["privacy.sensitiveContent","Sensitive Content Control","Limit potentially sensitive recommendations",true],
  ]},
  { key:"security", title:"Security Settings", subtitle:"Protect your account and sessions", icon:"lock-closed-outline", legacy:"security", fields:[
    ["security.twoFactor","Two-Factor Authentication","Add an extra sign-in verification step",false],
    ["security.loginAlerts","New Device Login Alerts","Receive alerts for new sign-ins",true],
    ["security.suspiciousAlerts","Suspicious Login Protection","Enable additional sign-in risk alerts",true],
    ["security.loginHistory","Login History","Review recent account sign-ins",false],
    ["security.activeDevices","Active Devices","Review devices currently signed in",false],
    ["security.appLock","App Lock","Require authentication when opening the app",false],
    ["security.fingerprint","Fingerprint Unlock","Use supported device biometrics",false],
    ["security.faceUnlock","Face Unlock","Use supported device face authentication",false],
    ["security.pin","App PIN","Protect access with an app PIN",false],
    ["security.autoLock","Automatic Lock","Lock the app after inactivity",true],
    ["security.checkup","Security Checkup","Review important account protection settings",false],
  ]},
  { key:"notifications", title:"Notification Settings", subtitle:"Choose alerts, sounds and quiet hours", icon:"notifications-outline", legacy:"notifications", fields:[
    ["notifications.enabled","All Notifications","Turn all social activity notifications on or off",true],
    ["notifications.sound","Notification Sound","Play a sound for app notifications",true],
    ["notifications.royalTone","Royal Futuristic Tone","Use the Bhumi Social signature tone",true],
    ["notifications.quietHours","Quiet Hours","Silence non-critical notifications on a schedule",false],
    ["notifications.preview","Notification Preview","Show message previews in notifications",true],
    ["notifications.likes","Like Alerts","Receive notifications for likes",true],
    ["notifications.comments","Comment Alerts","Receive notifications for comments",true],
    ["notifications.follows","Follow Alerts","Receive notifications for follows",true],
    ["notifications.messages","Message Alerts","Receive notifications for messages",true],
    ["notifications.requests","Follow Request Alerts","Receive alerts for follow requests",true],
    ["notifications.stories","Story Alerts","Receive story activity alerts",true],
    ["notifications.live","Live Alerts","Receive live broadcast alerts",true],
    ["notifications.mentions","Mention Alerts","Receive alerts when someone mentions you",true],
    ["notifications.tags","Tag Alerts","Receive alerts when someone tags you",true],
    ["notifications.reels","Reels Alerts","Receive reels activity alerts",true],
    ["notifications.updates","App Update Alerts","Receive app update announcements",true],
  ]},
  { key:"messages", title:"Chat Privacy & Messages", subtitle:"Control who can message you and what chat signals others can see", icon:"chatbubbles-outline", fields:[
    ["messages.allowMessages","Allow Direct Messages","Let people send you direct messages",true],
    ["messages.messageRequests","Message Requests","Allow first-time messages to arrive in Requests",true],
    ["messages.allowUnknown","Allow Unknown Senders","Allow message requests from people you do not follow",true],
    ["messages.readReceipts","Read Receipts","When off, do not send read status when you open a chat",true],
    ["messages.typing","Typing Indicator","When off, hide your typing status from other people",true],
    ["messages.allowVoiceCalls","Allow Voice Calls","Allow incoming audio calls",true],
    ["messages.allowVideoCalls","Allow Video Calls","Allow incoming video calls",true],
    ["messages.disappearing","Disappearing Messages","Enable disappearing message preference",false],
    ["messages.mediaDownload","Media Auto Download","Automatically download chat media",true],
  ]},
  { key:"story", title:"Story Settings", subtitle:"Manage story audience and replies", icon:"images-outline", fields:[
    ["story.closeFriends","Close Friends","Manage your Close Friends membership from each friend’s Chat Studio",true],
    ["story.hideFrom","Hide Story From","Manage people who cannot view your stories",false],
    ["story.replies","Allow Story Replies","Control story reply availability",true],
    ["story.mentions","Allow Story Mentions","Control mentions in stories",true],
    ["story.autoSave","Auto Save Stories","Save your own stories to your archive",false],
    ["story.sharing","Allow Story Sharing","Allow others to share your stories",true],
    ["story.reactions","Allow Story Reactions","Allow reactions to your stories",true],
    ["story.archive","Story Archive","Keep expired stories in your archive",true],
    ["story.highlights","Story Highlights","Manage saved story highlights",true],
  ]},
  { key:"feed", title:"Feed & Reels Settings", subtitle:"Control what and how you watch", icon:"play-circle-outline", fields:[
    ["feed.favorites","Favorites Feed","Prioritize selected accounts in your feed",true],
    ["feed.mutedAccounts","Muted Accounts","Manage accounts muted from your feed",false],
    ["feed.suggested","Suggested Posts","Control suggested content",true],
    ["feed.autoPlay","Video Auto-play","Automatically play feed videos",true],
    ["feed.dataQuality","High Quality on Mobile Data","Use higher media quality on mobile data",false],
    ["feed.highQualityUpload","High Quality Uploads","Prefer higher quality media uploads",true],
    ["feed.highQualityPlayback","High Quality Playback","Prefer higher quality media playback",true],
    ["feed.reelsAutoPlay","Reels Auto Play","Automatically play reels",true],
    ["feed.notInterested","Content Preferences","Tune suggested content preferences",true],
    ["feed.sensitive","Sensitive Content Control","Limit sensitive recommended content",true],
  ]},
  { key:"appearance", title:"Appearance Settings", subtitle:"Make the app feel like yours", icon:"color-palette-outline", fields:[
    ["appearance.theme","App Theme","Choose your preferred appearance",true],
    ["appearance.royalTheme","Bhumi Blue Theme","Use the Bhumi blue premium theme",true],
    ["appearance.language","App Language","Choose your display language",true],
    ["appearance.largeText","Larger Text","Increase text size across the app",false],
    ["appearance.animations","App Animations","Enable interface animations",true],
    ["appearance.appIcon","App Icon","Choose an available app icon",true],
    ["appearance.display","Display Settings","Customize display preferences",true],
    ["appearance.chat","Chat Appearance","Customize chat appearance",true],
  ]},
  { key:"advanced", title:"Data & Storage Settings", subtitle:"Manage network usage, downloads, permissions and storage", icon:"options-outline", fields:[
    ["advanced.dataSaver","Data Saver","Reduce media data usage",false],
    ["advanced.cache","Cache Management","Allow the app to manage cached media",true],
    ["advanced.backgroundData","Background Data","Allow background network activity",true],
    ["advanced.permissions","App Permissions Manager","Review permissions granted to this app",false],
    ["advanced.reset","Reset Preferences","Restore app preferences to defaults",false],
    ["advanced.storage","Storage Usage","Review media and cache storage",false],
    ["advanced.clearCache","Clear Cache","Clear temporary cached files",false],
    ["advanced.downloads","Download Preferences","Choose media download preferences",true],
    ["advanced.wifiOnly","Wi-Fi Only Downloads","Restrict automatic downloads to Wi-Fi",false],
  ]},
  { key:"creator", title:"Creator & Professional", subtitle:"Tools for creators and business profiles", icon:"analytics-outline", fields:[
    ["creator.accountType","Creator Account","Enable creator account preference",false],
    ["creator.businessAccount","Business Account","Enable business account preference",false],
    ["creator.dashboard","Professional Dashboard","Show professional tools and insights",true],
    ["creator.insights","Account Insights","View account performance insights",true],
    ["creator.followerAnalytics","Followers Analytics","Review follower growth analytics",true],
    ["creator.contentAnalytics","Post & Reels Analytics","Review content performance analytics",true],
    ["creator.audience","Audience Insights","Review audience activity and reach",true],
    ["creator.monetization","Monetization","View eligible monetization tools",false],
    ["creator.collaboration","Brand Collaboration","Manage brand collaboration tools",false],
    ["creator.promotions","Promotion Tools","Manage promotional content tools",false],
  ]},
  { key:"appLock", title:"App Lock & Protection", subtitle:"Extra privacy for app access and media", icon:"finger-print-outline", fields:[
    ["protection.privateMedia","Private Media Folder","Enable private media organization preference",false],
    ["protection.hidePreviews","Hide Notification Content","Hide sensitive notification previews",false],
    ["protection.screenshot","Screenshot Protection","Request protection where the device supports it",false],
    ["protection.recording","Screen Recording Protection","Request protection where the device supports it",false],
    ["protection.hiddenChats","Hidden Chats","Enable hidden chat preference",false],
  ]},
  { key:"premium", title:"Premium Personalization", subtitle:"Personalize your Bhumi Social experience", icon:"sparkles-outline", fields:[
    ["premium.profileBadge","Premium Profile Badge","Show an eligible premium profile badge",false],
    ["premium.profileEffects","Profile Effects","Enable supported profile effects",false],
    ["premium.animatedRing","Animated Profile Ring","Enable an animated profile ring preference",false],
    ["premium.chatThemes","Premium Chat Themes","Use premium chat theme options",true],
    ["premium.customSounds","Custom App Sounds","Choose supported app sounds",true],
    ["premium.profileStudio","Profile Customization Studio","Open profile personalization tools",true],
  ]},
  { key:"help", title:"Help & Support", subtitle:"Support, reports and assistance", icon:"help-circle-outline", fields:[
    ["account.reportProblem","Report a Problem","Send a problem report to the support team",false],
    ["account.helpCenter","Help Center","Find help with Bhumi Social AI",false],
    ["account.appUpdates","Check App Updates","Check whether a newer app version is available",false],
  ]},
  { key:"about", title:"About Bhumi Social AI", subtitle:"App information, version and legal details", icon:"information-circle-outline", fields:[
    ["account.appVersionInfo","App Version Information","View the installed app version",false],
    ["account.terms","Terms of Service","Review the terms for using Bhumi Social AI",false],
    ["account.privacyPolicy","Privacy Policy","Review how account information is handled",false],
    ["account.openSource","Open Source Licenses","View third-party software notices",false],
  ]},
];

export default function SettingsDashboard({ visible, username, onClose, onLogout, onAbout, onLegacyOpen }) {
  const [active, setActive] = React.useState(null);
  const [hubVisible, setHubVisible] = React.useState(false);
  const [qrVisible, setQrVisible] = React.useState(false);
  const [pinSetupVisible, setPinSetupVisible] = React.useState(false);
  const [pinValue, setPinValue] = React.useState("");
  const [pinConfirmValue, setPinConfirmValue] = React.useState("");
  const [pinAlreadySet, setPinAlreadySet] = React.useState(false);
  const [securityVisible, setSecurityVisible] = React.useState(false);
  const [securityLoading, setSecurityLoading] = React.useState(false);
  const [loginHistory, setLoginHistory] = React.useState([]);
  const [activeSessions, setActiveSessions] = React.useState([]);
  const [locationVisible, setLocationVisible] = React.useState(false);
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationShares, setLocationShares] = React.useState({ outgoing:[], incoming:[] });
  const [locationRecipient, setLocationRecipient] = React.useState("");
  const [locationDuration, setLocationDuration] = React.useState(60);
  const [locationStatus, setLocationStatus] = React.useState("");
  const [nearbyDistances, setNearbyDistances] = React.useState({});
  const locationWatchRef = React.useRef(null);
  const activeLocationShareRef = React.useRef(null);
  const locationDurationRef = React.useRef(60);
  const [preferences, setPreferences] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState("");
  const [notice, setNotice] = React.useState(null);
  const [settingsSearch, setSettingsSearch] = React.useState("");
  const normalizedSearch = settingsSearch.trim().toLowerCase();
  const visibleSections = SECTIONS.map((section) => {
    const sectionMatches = normalizedSearch &&
      (section.title.toLowerCase().includes(normalizedSearch) ||
       section.subtitle.toLowerCase().includes(normalizedSearch));
    return {
      ...section,
      fields: !normalizedSearch || sectionMatches
        ? section.fields
        : section.fields.filter((field) =>
            field[1].toLowerCase().includes(normalizedSearch) ||
            field[2].toLowerCase().includes(normalizedSearch)),
    };
  }).filter((section) => !normalizedSearch ||
    section.title.toLowerCase().includes(normalizedSearch) ||
    section.subtitle.toLowerCase().includes(normalizedSearch) ||
    section.fields.length > 0);
  React.useEffect(() => {
    let alive = true;
    if (visible) {
      setLoading(true);
      Promise.all([
        loadSettingsPreferences(),
        loadNotificationPreference(),
        loadNotificationDetails(),
        SecureStore.getItemAsync("bhumi_app_lock_pin"),
        SecureStore.getItemAsync("bhumi_app_auto_lock"),
      ]).then(([data, notificationsEnabled, notificationDetails, storedAppPin, storedAutoLock]) => {
        if (!alive) return;
        const merged = { ...(data || {}) };
        merged["security.appLock"] = !!storedAppPin;
        merged["security.pin"] = !!storedAppPin;
        if (storedAppPin) merged["security.autoLock"] = storedAutoLock !== "false";
        merged["notifications.enabled"] = notificationsEnabled;
        Object.entries(notificationDetails || {}).forEach(([name, enabled]) => {
          const key = ({ likes:"notifications.likes", comments:"notifications.comments", follows:"notifications.follows", messages:"notifications.messages" })[name];
          if (key) merged[key] = enabled;
        });
        setPreferences(merged);
      }).catch((error) => {
        if (alive) setNotice({ title: "Settings", message: error.message || "Could not load preferences." });
      }).finally(() => { if (alive) setLoading(false); });
    } else {
      setActive(null);
      setNotice(null);
    }
    return () => { alive = false; };
  }, [visible, username]);

  const saveValue = async (key, value) => {
    const previous = preferences[key];
    setPreferences((current) => ({ ...current, [key]: value }));
    setSavingKey(key);
    try {
      if (key === "notifications.enabled") {
        const saved = await saveNotificationPreference(value);
        setPreferences((current) => ({ ...current, [key]: saved }));
      } else {
        const detailKey = ({ "notifications.likes":"likes", "notifications.comments":"comments", "notifications.follows":"follows", "notifications.messages":"messages" })[key];
        if (detailKey) {
          await saveNotificationDetails({ [detailKey]: value });
          setPreferences((current) => ({ ...current, [key]: value }));
        } else {
          const saved = await saveSettingsPreferences({ [key]: value });
          if (key === "security.autoLock") {
            await SecureStore.setItemAsync("bhumi_app_auto_lock", value ? "true" : "false");
          }
          if (key === "location.background" && !value) {
            const activeId = activeLocationShareRef.current?.shareId || await SecureStore.getItemAsync("bhumi_live_share_id");
            if (activeId) {
              await stopLocationShare(activeId).catch(() => {});
              await stopLocationWatcher();
              setNotice({ title:"Background Location disabled", message:"Background updates have stopped and the active share was ended. Start a new share to continue in foreground-only mode." });
            }
          }
          setPreferences(saved);
        }
      }
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      setNotice({ title: "Save failed", message: error.message || "Could not save this setting." });
    } finally { setSavingKey(""); }
  };

  const refreshSecurityData = async () => {
    setSecurityLoading(true);
    try {
      const [history, sessions] = await Promise.all([loadLoginHistory(50), loadActiveSessions()]);
      setLoginHistory(history);
      setActiveSessions(sessions);
    } catch (error) {
      setNotice({ title:"Login & Security", message:error?.message || "Security information could not be loaded." });
    } finally { setSecurityLoading(false); }
  };

  const openSecurityPanel = () => {
    setActive(null);
    setSecurityVisible(true);
    void refreshSecurityData();
  };

  const refreshLocationShares = async () => {
    setLocationLoading(true);
    try { setLocationShares(await loadLocationShares()); }
    catch (error) { setLocationStatus(error?.message || "Location shares could not be loaded."); }
    finally { setLocationLoading(false); }
  };

  const openLocationPanel = async () => {
    setActive(null);
    setLocationVisible(true);
    setLocationStatus("");
    const [shareId, recipient] = await Promise.all([
      SecureStore.getItemAsync("bhumi_live_share_id"),
      SecureStore.getItemAsync("bhumi_live_share_recipient"),
    ]);
    if (shareId && recipient) activeLocationShareRef.current = { shareId, recipient };
    void refreshLocationShares();
  };

  const findNearbyFriends = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Nearby friends देखने के लिए foreground location permission दें।");
      const current = await Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.Balanced });
      const toRad = (value) => value * Math.PI / 180;
      const distanceKm = (lat, lon) => {
        const dLat = toRad(lat-current.coords.latitude);
        const dLon = toRad(lon-current.coords.longitude);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(current.coords.latitude))*Math.cos(toRad(lat))*Math.sin(dLon/2)**2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      };
      const distances = {};
      (locationShares.incoming || []).forEach((share) => {
        distances[share.share_id] = distanceKm(share.latitude,share.longitude);
      });
      setNearbyDistances(distances);
    } catch (error) {
      setLocationStatus(error?.message || "Nearby friends नहीं दिख सके।");
    }
  };

  const stopLocationWatcher = async () => {
    try { locationWatchRef.current?.remove?.(); } catch (_) {}
    locationWatchRef.current = null;
    activeLocationShareRef.current = null;
    try {
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (_) {}
    await Promise.all([
      SecureStore.deleteItemAsync("bhumi_live_share_id"),
      SecureStore.deleteItemAsync("bhumi_live_share_recipient"),
      SecureStore.deleteItemAsync("bhumi_live_share_duration"),
      SecureStore.deleteItemAsync("bhumi_live_share_approximate"),
    ]).catch(() => {});
  };

  const startLiveLocationShare = async () => {
    const recipient = locationRecipient.trim().replace(/^@/, "");
    if (!recipient) { setLocationStatus("जिस दोस्त को लोकेशन भेजनी है उसका username लिखें।"); return; }
    setLocationLoading(true);
    setLocationStatus("Location permission माँगी जा रही है…");
    let createdShareId = null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Live location के लिए While Using the App location permission जरूरी है।");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const approximate = !!preferences["location.approximate"];
      const latitude = approximate ? Math.round(position.coords.latitude * 100) / 100 : position.coords.latitude;
      const longitude = approximate ? Math.round(position.coords.longitude * 100) / 100 : position.coords.longitude;
      await stopLocationWatcher();
      const created = await createOrUpdateLocationShare({
        recipient_username: recipient,
        latitude,
        longitude,
        accuracy: position.coords.accuracy,
        duration_minutes: locationDuration,
      });
      createdShareId = created.share_id;
      activeLocationShareRef.current = { shareId:created.share_id, recipient:created.recipient_username };
      locationDurationRef.current = locationDuration;
      if (preferences["location.background"]) {
        const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
        if (backgroundPermission.status !== "granted") {
          await stopLocationShare(created.share_id);
          activeLocationShareRef.current = null;
          throw new Error("Background permission नहीं मिली। Location sharing शुरू नहीं की गई। Android Settings में Allow all the time चुनें, या Background Location बंद करके foreground sharing करें।");
        }
        await Promise.all([
          SecureStore.setItemAsync("bhumi_live_share_id", created.share_id),
          SecureStore.setItemAsync("bhumi_live_share_recipient", created.recipient_username),
          SecureStore.setItemAsync("bhumi_live_share_duration", String(locationDuration)),
          SecureStore.setItemAsync("bhumi_live_share_approximate", approximate ? "true" : "false"),
        ]);
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 30,
          pausesUpdatesAutomatically: true,
          foregroundService: {
            notificationTitle: "Bhumi Social AI location sharing",
            notificationBody: "Your live location is being shared with @" + created.recipient_username + ".",
            notificationColor: "#0095F6",
          },
        });
      } else {
        locationWatchRef.current = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 30,
        }, async (nextPosition) => {
          const active = activeLocationShareRef.current;
          if (!active) return;
          const approx = !!preferences["location.approximate"];
          try {
            await createOrUpdateLocationShare({
              share_id: active.shareId,
              recipient_username: active.recipient,
              latitude: approx ? Math.round(nextPosition.coords.latitude * 100) / 100 : nextPosition.coords.latitude,
              longitude: approx ? Math.round(nextPosition.coords.longitude * 100) / 100 : nextPosition.coords.longitude,
              accuracy: nextPosition.coords.accuracy,
              duration_minutes: locationDurationRef.current,
            });
          } catch (error) {
            setLocationStatus(error?.message || "Location update नहीं हो पाया।");
          }
        });
      }
      setLocationStatus("आपकी live location @" + created.recipient_username + " के साथ साझा हो रही है। " + (preferences["location.background"] ? "Background location service चालू है।" : "Updates app foreground में होंगी।"));
      await refreshLocationShares();
    } catch (error) {
      if (createdShareId) {
        try { await stopLocationShare(createdShareId); } catch (_) {}
        await stopLocationWatcher();
      }
      setLocationStatus(error?.message || "Live location शुरू नहीं हो सकी।");
    } finally { setLocationLoading(false); }
  };

  const endLocationShare = async (shareId) => {
    try {
      await stopLocationShare(shareId);
      const storedShareId = await SecureStore.getItemAsync("bhumi_live_share_id");
      if (activeLocationShareRef.current?.shareId === shareId || storedShareId === shareId) await stopLocationWatcher();
      setLocationStatus("Location sharing बंद कर दी गई है।");
      await refreshLocationShares();
    } catch (error) { setLocationStatus(error?.message || "Location sharing बंद नहीं हुई।"); }
  };

  React.useEffect(() => () => { void stopLocationWatcher(); }, []);
  const runSettingAction = (key) => {
    if (key === "security.appLock" || key === "security.pin") {
      setActive(null);
      SecureStore.getItemAsync("bhumi_app_lock_pin").then((storedPin) => {
        setPinAlreadySet(!!storedPin);
        setPinValue("");
        setPinConfirmValue("");
        setPinSetupVisible(true);
      }).catch((error) => setNotice({ title:"App Lock", message:error?.message || "Secure storage is unavailable on this device." }));
      return;
    }
    if (key === "security.fingerprint" || key === "security.faceUnlock") {
      setNotice({ title:"Biometric Unlock", message:"Fingerprint and Face Unlock are not enabled in this build. App PIN protection is available here; biometric unlock will only be shown as available after native biometric support is integrated and tested." });
      return;
    }
    if (key === "security.twoFactor") {
      setNotice({ title:"Two-Factor Authentication", message:"Two-factor sign-in is not enabled on the account server yet. This option has not been switched on." });
      return;
    }
    if (key === "security.loginHistory" || key === "security.activeDevices" || key === "security.checkup") {
      openSecurityPanel();
      return;
    }
    if (key === "security.activeDevices") {
      setActive(null);
      onLegacyOpen?.("security");
      return;
    }
    if (key === "security.checkup") {
      setActive(null);
      onLegacyOpen?.("security");
      return;
    }
    if (key === "account.verification" || key === "account.dataDownload" || key === "account.deactivation") {
      const subjects = {
        "account.verification":"Bhumi Social AI - Profile Verification Request",
        "account.dataDownload":"Bhumi Social AI - Personal Data Export Request",
        "account.deactivation":"Bhumi Social AI - Account Deactivation Request"
      };
      const body = encodeURIComponent("Username: @" + (username || "") + "\\n\\nPlease help me with this request. I understand identity verification may be required.\\n");
      const mailto = "mailto:bhumiprabhumeghawal@gmail.com?subject=" + encodeURIComponent(subjects[key]) + "&body=" + body;
      Linking.openURL(mailto).catch(() => setNotice({ title:"Account request", message:"Please email bhumiprabhumeghawal@gmail.com with your username and request. Never send your password or one-time code." }));
      return;
    }
    if (key === "account.multipleAccounts") {
      setNotice({ title:"Multiple Accounts", message:"Account switching is not yet available in this app. You can sign out and sign in to another account; each account remains separate." });
      return;
    }
    if (key === "appearance.appIcon") {
      setNotice({ title:"App Icon", message:"Only the official Bhumi Social AI icon is included in this build. Alternative icon packs are not available yet." });
      return;
    }
    if (key === "appearance.display" || key === "appearance.language") {
      setNotice({ title:"Display Settings", message:"The app currently uses its supported dark interface and English/Hindi text where provided. Per-user display and language switching is not fully implemented yet." });
      return;
    }
    if (key === "feed.favorites" || key === "feed.mutedAccounts") {
      setNotice({ title: key === "feed.favorites" ? "Favorites Feed" : "Muted Accounts", message: "This dedicated list-management screen is not implemented yet. This control has not been enabled as a working feature." });
      return;
    }
    if (key === "location.history" || key === "location.liveSharing" || key === "location.nearbyFriends") {
      openLocationPanel();
      return;
    }
    if (key === "location.background") {
      setNotice({ title:"Background Location", message:"Live sharing updates only while Bhumi Social AI is open in the foreground. Background tracking is intentionally not enabled; you can stop sharing at any time and each share expires automatically." });
      return;
    }
    if (key === "account.profileQr") {
      setActive(null);
      setQrVisible(true);
      return;
    }
    if (key === "premium.profileStudio") {
      setActive(null);
      onLegacyOpen?.("profile");
      return;
    }
    if (key === "account.helpCenter") {
      const subject = encodeURIComponent("Bhumi Social AI - Help Request");
      Linking.openURL("mailto:bhumiprabhumeghawal@gmail.com?subject=" + subject)
        .catch(() => setNotice({ title: "Help Center", message: "Contact support at bhumiprabhumeghawal@gmail.com." }));
      return;
    }
    if (key.startsWith("creator.")) {
      setActive(null);
      setHubVisible(true);
      return;
    }
    if (key === "account.deletion") {
      setActive(null);
      const url = "https://bhumi-social-app-1.onrender.com/delete-account?username=" + encodeURIComponent(username || "");
      Linking.openURL(url).catch(() => setNotice({ title: "Account deletion", message: "Open https://bhumi-social-app-1.onrender.com/delete-account in your browser or email bhumiprabhumeghawal@gmail.com." }));
      return;
    }
    if (key === "profile.usernameChange" || key === "account.multipleAccounts" ||
        key === "account.verification" || key === "account.dataDownload" ||
        key === "account.deactivation") {
      setActive(null);
      onLegacyOpen?.("account");
      return;
    }
    if (key.startsWith("privacy.") || key === "story.hideFrom") {
      setActive(null);
      onLegacyOpen?.("privacy");
      return;
    }
    if (key.startsWith("security.")) {
      setActive(null);
      onLegacyOpen?.("security");
      return;
    }
    if (key === "account.terms" || key === "account.privacyPolicy") {
      setActive(null);
      const url = key === "account.terms"
        ? "https://bhumi-social-app-1.onrender.com/terms"
        : "https://bhumi-social-app-1.onrender.com/privacy";
      Linking.openURL(url).catch(() => setNotice({ title: "Legal information", message: "Open " + url + " in your browser." }));
      return;
    }
    if (key === "account.appUpdates" || key === "account.appVersionInfo" ||
        key === "account.openSource" || key === "account.helpCenter") {
      setActive(null);
      onAbout?.();
      return;
    }
    if (key === "story.highlights") {
      setActive(null);
      onLegacyOpen?.("profile");
      return;
    }
    if (key === "appearance.chat") {
      setActive(null);
      onLegacyOpen?.("messages");
      return;
    }
    if (key === "story.closeFriends") {
      setActive(null);
      onLegacyOpen?.("messages");
      return;
    }
    if (key === "advanced.clearCache") {
      (async () => {
        const cacheDirectory = FileSystem.cacheDirectory;
        if (!cacheDirectory) {
          setNotice({ title: "Cache unavailable", message: "This device does not expose an app cache directory." });
          return;
        }
        try {
          await FileSystem.deleteAsync(cacheDirectory, { idempotent: true });
          await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true });
          setNotice({ title: "Cache cleared", message: "Temporary app cache files were cleared. Your account, posts and messages were not deleted." });
        } catch (error) {
          setNotice({ title: "Could not clear cache", message: error?.message || "Temporary files could not be cleared." });
        }
      })();
      return;
    }
    if (key === "advanced.storage") {
      (async () => {
        setSavingKey(key);
        try {
          const [cacheBytes, documentBytes] = await Promise.all([
            measureDirectoryBytes(FileSystem.cacheDirectory),
            measureDirectoryBytes(FileSystem.documentDirectory),
          ]);
          setNotice({
            title: "Storage Usage",
            message: "Temporary cache: " + formatBytes(cacheBytes) + "\\nApp documents: " + formatBytes(documentBytes) + "\\n\\nClearing cache removes temporary files only. Your account and uploaded content remain safe.",
          });
        } catch (error) {
          setNotice({ title: "Storage Usage", message: error?.message || "Storage information could not be read." });
        } finally { setSavingKey(""); }
      })();
      return;
    }
    if (key === "advanced.reset") {
      (async () => {
        setSavingKey(key);
        try {
          const defaults = {};
          SECTIONS.forEach((section) => section.fields.forEach(([fieldKey, , , defaultValue]) => {
            if (!ACTION_KEYS.has(fieldKey) && !fieldKey.startsWith("notifications.")) defaults[fieldKey] = defaultValue;
          }));
          const saved = await saveSettingsPreferences(defaults);
          setPreferences((current) => ({ ...current, ...defaults, ...saved }));
          setNotice({ title: "Preferences reset", message: "App preference switches were restored to their default values. Account, posts, messages and uploaded media were not deleted." });
        } catch (error) {
          setNotice({ title: "Reset failed", message: error?.message || "Preferences could not be reset." });
        } finally { setSavingKey(""); }
      })();
      return;
    }
    if (key === "account.reportProblem") {
      const subject = encodeURIComponent("Bhumi Social AI - Problem Report");
      const body = encodeURIComponent("Username: " + (username || "Not available") + "\\n\\nPlease describe the problem below:\\n");
      Linking.openURL("mailto:bhumiprabhumeghawal@gmail.com?subject=" + subject + "&body=" + body)
        .catch(() => setNotice({ title: "Report a Problem", message: "Email support at bhumiprabhumeghawal@gmail.com." }));
      return;
    }
    if (key === "advanced.permissions") {
      Linking.openSettings();
      return;
    }
    if (key === "location.history") {
      setNotice({
        title: "Location Sharing History",
        message: "Location sharing is currently off by default. History will appear here after secure location-sharing controls are enabled.",
      });
      return;
    }
    const labels = {
      "creator.monetization":"Creator monetization is not enabled on the server yet.",
      "creator.collaboration":"Brand collaboration tools are not connected yet.",
      "creator.promotions":"Promotion tools are not connected yet.",
      "premium.profileStudio":"Profile Studio is not connected yet.",
      "appearance.chat":"Chat themes and friend-specific personalization are available from the palette button inside each conversation."
    };
    setNotice({ title: "Not available yet", message: labels[key] || "This action is not connected yet. It has not been enabled." });
  };

  const renderField = (field) => {
    const [key, title, subtitle, defaultValue] = field;
    const value = preferences[key] ?? defaultValue;
    const isAction = ACTION_KEYS.has(key);
    return (
      <View key={key} style={{ backgroundColor:BG, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:BORDER, paddingHorizontal:2, paddingVertical:16, marginBottom:0 }}>
        <View style={{ flexDirection:"row", alignItems:"center" }}>
          <View style={{ flex:1, paddingRight:12 }}>
            <Text style={{ color:TEXT, fontSize:14, fontWeight:"800" }}>{title}</Text>
            <Text style={{ color:MUTED, fontSize:11, marginTop:4, lineHeight:16 }}>{subtitle}</Text>
            {savingKey === key ? <Text style={{ color:GOLD, fontSize:10, marginTop:5 }}>Saving…</Text> : null}
          </View>
          {isAction ? (
            <TouchableOpacity
              onPress={() => runSettingAction(key)}
              accessibilityRole="button"
              accessibilityLabel={"Open " + title}
              hitSlop={10}
              style={{ width:34,height:34,alignItems:"center",justifyContent:"center" }}
            >
              <Ionicons name="chevron-forward" size={20} color={MUTED}/>
            </TouchableOpacity>
          ) : (
            <Switch value={!!value} onValueChange={(next) => saveValue(key,next)} disabled={!!savingKey} trackColor={{ false:"#555555",true:"#0095F6" }} thumbColor={value ? GOLD : "#FFFFFF"} />
          )}
        </View>
      </View>
    );
  };

  const renderSection = () => {
    if (!active) return null;
    const section = SECTIONS.find((item) => item.key === active);
    if (!section) return null;
    const sectionMatches = normalizedSearch &&
      (section.title.toLowerCase().includes(normalizedSearch) ||
       section.subtitle.toLowerCase().includes(normalizedSearch));
    const displayedFields = !normalizedSearch || sectionMatches
      ? section.fields
      : section.fields.filter((field) =>
          field[1].toLowerCase().includes(normalizedSearch) ||
          field[2].toLowerCase().includes(normalizedSearch));
    return (
      <Modal visible={!!active && visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setActive(null)}>
        <View style={{ flex:1, backgroundColor:BG, paddingTop:16, paddingBottom: Platform.OS === "android" ? 36 : 0 }}>
          <View style={{ flexDirection:"row", alignItems:"center", paddingHorizontal:18, paddingTop:5, paddingBottom:16, borderBottomWidth:1, borderBottomColor:BORDER, backgroundColor:BG }}>
            <TouchableOpacity onPress={() => setActive(null)} style={{ width:42,height:42,borderRadius:13,backgroundColor:PANEL,alignItems:"center",justifyContent:"center",marginRight:12 }}>
              <Ionicons name="arrow-back" size={22} color={GOLD}/>
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={{ color:TEXT,fontSize:19,fontWeight:"900", letterSpacing:-0.35 }}>{section.title}</Text>
              <Text style={{ color:MUTED,fontSize:11,marginTop:4 }}>{section.subtitle}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding:18,paddingBottom: Platform.OS === "android" ? 64 : 40 }} keyboardShouldPersistTaps="handled">
            {section.key === "location" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderColor:GOLD,borderWidth:1,borderRadius:15,padding:14,marginBottom:14 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>LOCATION SAFETY</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Location sharing is off by default. You must grant foreground permission and choose a mutual follower. Shares expire automatically and can be stopped at any time.</Text>
                <TouchableOpacity onPress={() => Linking.openSettings()} style={{ alignSelf:"flex-start",marginTop:12,backgroundColor:GOLD,borderRadius:10,paddingHorizontal:13,paddingVertical:9 }}>
                  <Text style={{ color:"#FFFFFF",fontWeight:"900",fontSize:12 }}>Open App Permissions</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {section.key === "security" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderRadius:14,padding:13,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"800",fontSize:12 }}>SECURITY NOTE</Text>
                <Text style={{ color:MUTED,fontSize:11,lineHeight:17,marginTop:5 }}>Account security controls are separate from chat privacy preferences.</Text>
              </View>
            ) : null}
            {section.key === "messages" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderWidth:1,borderColor:GOLD,borderRadius:14,padding:14,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>CHAT PRIVACY CONTROLS</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Blocked and Restricted Accounts are managed from the Privacy Settings section. Your existing conversations remain available when you turn off first-time message requests; new unknown senders are refused. Read receipts and typing indicators are enforced by the chat server.</Text>
              </View>
            ) : null}
            {section.key === "messages" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderWidth:1,borderColor:GOLD,borderRadius:14,padding:14,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>CHAT PERSONALIZATION STUDIO</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Open Messages, enter any conversation, then tap the palette icon. Choose a separate chat theme, set a private name for that friend, and add or remove them from Favourite Friends or Close Friends. Favourite and Close Friends filters appear above your chat list.</Text>
              </View>
            ) : null}
            {displayedFields.map(renderField)}
            {section.key === "privacy" ? (
              <View style={{ marginTop:4 }}>
                {["blocked","restricted"].map((legacyKey) => (
                  <TouchableOpacity key={legacyKey} onPress={() => { setActive(null); onLegacyOpen?.(legacyKey); }} style={{ backgroundColor:PANEL,borderWidth:1,borderColor:BORDER,borderRadius:13,padding:14,marginBottom:9 }}>
                    <Text style={{ color:TEXT,fontWeight:"800" }}>{legacyKey === "blocked" ? "Blocked Accounts" : "Restricted Accounts"}</Text>
                    <Text style={{ color:MUTED,fontSize:11,marginTop:4 }}>Manage {legacyKey} people and interactions</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {section.legacy ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.(section.legacy); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>Open Existing {section.title}</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "about" ? (
              <TouchableOpacity onPress={() => { setActive(null); onAbout?.(); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>About & App Updates</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "account" ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.("account"); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>Manage Email & Mobile</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "security" ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.("security"); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>Change Password / Other Sessions</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={{ flex:1,backgroundColor:BG,paddingTop: Platform.OS === "android" ? 28 : 48 }}>
          <View style={{ flexDirection:"row",alignItems:"center",paddingHorizontal:18,paddingBottom:16,borderBottomWidth:1,borderBottomColor:BORDER }}>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" style={{ width:40,height:40,alignItems:"flex-start",justifyContent:"center" }}>
              <Ionicons name="arrow-back" size={25} color={TEXT}/>
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={{ color:TEXT,fontSize:22,fontWeight:"900",letterSpacing:-0.5 }}>Settings and activity</Text>
              <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>Your account, privacy and app preferences</Text>
            </View>
          </View>
          <View style={{ flex:1,paddingHorizontal:17,paddingTop:15,paddingBottom: Platform.OS === "android" ? 20 : 12 }}>
            <View style={{ flexDirection:"row",alignItems:"center",backgroundColor:PANEL,borderRadius:12,paddingHorizontal:12,height:44,marginBottom:14 }}>
              <Ionicons name="search" size={19} color={MUTED}/>
              <TextInput
                value={settingsSearch}
                onChangeText={setSettingsSearch}
                placeholder="Search settings"
                placeholderTextColor="#8E8E8E"
                returnKeyType="search"
                autoCorrect={false}
                style={{ flex:1,color:TEXT,fontSize:14,paddingVertical:0,paddingHorizontal:9 }}
                accessibilityLabel="Search settings"
              />
              {settingsSearch ? <TouchableOpacity onPress={() => setSettingsSearch("")} accessibilityLabel="Clear settings search"><Ionicons name="close-circle" size={18} color={MUTED}/></TouchableOpacity> : null}
            </View>
            <TouchableOpacity onPress={() => { setSettingsSearch(""); setActive("account"); }} activeOpacity={0.85} style={{ flexDirection:"row",alignItems:"center",backgroundColor:BG,borderWidth:1,borderColor:BORDER,borderRadius:13,padding:13,marginBottom:15 }}>
              <View style={{ width:40,height:40,borderRadius:20,backgroundColor:PANEL,alignItems:"center",justifyContent:"center",marginRight:11 }}>
                <Ionicons name="people-circle-outline" size={25} color={GOLD}/>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ color:TEXT,fontSize:14,fontWeight:"800" }}>Accounts Center</Text>
                <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>Personal details, account access and security</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED}/>
            </TouchableOpacity>
            {loading ? <ActivityIndicator color={GOLD} style={{ marginVertical:18 }}/> : null}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? 48 : 12 }}>
              {visibleSections.length ? visibleSections.map((section) => (
                <TouchableOpacity key={section.key} onPress={() => setActive(section.key)} activeOpacity={0.82} style={{ flexDirection:"row",alignItems:"center",backgroundColor:BG,borderBottomWidth:1,borderBottomColor:BORDER,borderRadius:0,paddingHorizontal:2,paddingVertical:12,marginBottom:0 }}>
                  <View style={{ width:42,height:42,borderRadius:21,backgroundColor:"#1C1C1E",alignItems:"center",justifyContent:"center",marginRight:12 }}>
                    <Ionicons name={section.icon} size={22} color={GOLD}/>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:TEXT,fontSize:14,fontWeight:"800" }}>{section.title}</Text>
                    <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{section.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={MUTED}/>
                </TouchableOpacity>
              )) : (
                <View style={{ paddingVertical:28,alignItems:"center" }}>
                  <Ionicons name="search-outline" size={28} color={MUTED}/>
                  <Text style={{ color:TEXT,fontSize:14,fontWeight:"700",marginTop:10 }}>No settings found</Text>
                  <Text style={{ color:MUTED,fontSize:11,marginTop:4 }}>Try another keyword</Text>
                </View>
              )}
              <TouchableOpacity onPress={async()=>{await stopLocationWatcher();onLogout?.();}} style={{ flexDirection:"row",alignItems:"center",justifyContent:"center",backgroundColor:"#35191D",borderWidth:1,borderColor:"#7C3039",borderRadius:14,padding:14,marginTop:5 }}>
                <Ionicons name="log-out-outline" color="#F08080" size={20}/>
                <Text style={{ color:"#F08080",fontWeight:"900",marginLeft:9 }}>Log Out</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ alignItems:"center",padding:14,marginTop:4 }}>
                <Text style={{ color:MUTED,fontWeight:"800" }}>Close Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {renderSection()}
<CreatorBusinessHub visible={hubVisible && visible} username={username} onClose={() => setHubVisible(false)} />
      <Modal visible={securityVisible && visible} transparent animationType="slide" onRequestClose={() => setSecurityVisible(false)}>
        <View style={{ flex:1,backgroundColor:"#000000",paddingTop:Platform.OS==="android"?35:55,paddingHorizontal:18,paddingBottom:20 }}>
          <View style={{ flexDirection:"row",alignItems:"center",marginBottom:16 }}>
            <TouchableOpacity onPress={()=>setSecurityVisible(false)} style={{ width:38 }}><Ionicons name="arrow-back" size={24} color={TEXT}/></TouchableOpacity>
            <Text style={{ color:TEXT,fontSize:20,fontWeight:"900",flex:1 }}>Login & Security</Text>
            <TouchableOpacity onPress={refreshSecurityData}><Ionicons name="refresh" size={21} color={GOLD}/></TouchableOpacity>
          </View>
          {securityLoading ? <ActivityIndicator color={GOLD}/> : null}
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ color:TEXT,fontSize:15,fontWeight:"900",marginBottom:8 }}>Recent Logins</Text>
            {loginHistory.length ? loginHistory.map((item)=>(
              <View key={String(item.id)} style={{ backgroundColor:PANEL,borderRadius:13,padding:13,marginBottom:8 }}>
                <View style={{ flexDirection:"row",alignItems:"center" }}>
                  <Ionicons name="phone-portrait-outline" size={20} color={GOLD}/>
                  <Text style={{ color:TEXT,fontSize:12,fontWeight:"800",flex:1,marginLeft:9 }} numberOfLines={2}>{item.device_label || "Unknown device"}</Text>
                  {item.is_current ? <Text style={{ color:"#65C18C",fontSize:10,fontWeight:"900" }}>THIS DEVICE</Text> : null}
                </View>
                <Text style={{ color:MUTED,fontSize:11,marginTop:7 }}>{new Date(item.created_at).toLocaleString()}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:3 }}>{item.session_active ? "Session active" : "Signed out / expired"}</Text>
              </View>
            )) : <Text style={{ color:MUTED,fontSize:12,marginBottom:15 }}>No login history is available yet. New successful logins will appear here.</Text>}
            <Text style={{ color:TEXT,fontSize:15,fontWeight:"900",marginTop:15,marginBottom:8 }}>Active Devices</Text>
            {activeSessions.length ? activeSessions.map((item)=>(
              <View key={item.id} style={{ backgroundColor:PANEL,borderRadius:13,padding:13,marginBottom:8 }}>
                <View style={{ flexDirection:"row",alignItems:"center" }}>
                  <Ionicons name="laptop-outline" size={20} color={GOLD}/>
                  <Text style={{ color:TEXT,fontSize:12,fontWeight:"800",flex:1,marginLeft:9 }} numberOfLines={2}>{item.device_label || "Unknown device"}</Text>
                  {item.is_current ? <Text style={{ color:"#65C18C",fontSize:10,fontWeight:"900" }}>CURRENT</Text> : null}
                </View>
                <Text style={{ color:MUTED,fontSize:10,marginTop:6 }}>Last active: {item.last_seen_at ? new Date(item.last_seen_at).toLocaleString() : new Date(item.created_at).toLocaleString()}</Text>
                {!item.is_current ? <TouchableOpacity onPress={async()=>{try{await revokeActiveSession(item.id);await refreshSecurityData();}catch(error){setNotice({title:"Could not sign out device",message:error?.message||"Please try again."});}}} style={{ alignSelf:"flex-start",paddingVertical:8,marginTop:4 }}><Text style={{ color:"#F08080",fontSize:11,fontWeight:"900" }}>Sign out this device</Text></TouchableOpacity> : null}
              </View>
            )) : <Text style={{ color:MUTED,fontSize:12 }}>No active sessions found.</Text>}
            <TouchableOpacity onPress={async()=>{try{await logoutOtherSessions();await refreshSecurityData();setNotice({title:"Other devices signed out",message:"All other active sessions have been ended. This device remains signed in."});}catch(error){setNotice({title:"Could not sign out other devices",message:error?.message||"Please try again."});}}} style={{ backgroundColor:"#35191D",borderRadius:12,padding:13,alignItems:"center",marginTop:15 }}>
              <Text style={{ color:"#F08080",fontWeight:"900" }}>Sign Out All Other Devices</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={locationVisible && visible} transparent animationType="slide" onRequestClose={() => setLocationVisible(false)}>
        <View style={{ flex:1,backgroundColor:"#000000",paddingTop:Platform.OS==="android"?35:55,paddingHorizontal:18,paddingBottom:20 }}>
          <View style={{ flexDirection:"row",alignItems:"center",marginBottom:15 }}>
            <TouchableOpacity onPress={()=>setLocationVisible(false)} style={{ width:38 }}><Ionicons name="arrow-back" size={24} color={TEXT}/></TouchableOpacity>
            <Text style={{ color:TEXT,fontSize:20,fontWeight:"900",flex:1 }}>Live Location</Text>
            <TouchableOpacity onPress={refreshLocationShares}><Ionicons name="refresh" size={21} color={GOLD}/></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor:PANEL,borderRadius:15,padding:15,marginBottom:14 }}>
              <Text style={{ color:TEXT,fontSize:15,fontWeight:"900" }}>Share with a friend</Text>
              <Text style={{ color:MUTED,fontSize:11,lineHeight:16,marginTop:5 }}>Only mutual followers can receive your location. Permission is requested only when you start sharing.</Text>
              <TextInput value={locationRecipient} onChangeText={setLocationRecipient} placeholder="Friend's username" placeholderTextColor="#777777" autoCapitalize="none" autoCorrect={false} style={{ color:TEXT,borderWidth:1,borderColor:BORDER,borderRadius:11,padding:12,marginTop:13 }}/>
              <Text style={{ color:MUTED,fontSize:11,fontWeight:"800",marginTop:13,marginBottom:8 }}>SHARE DURATION</Text>
              <View style={{ flexDirection:"row",flexWrap:"wrap",gap:7 }}>
                {[15,60,240,1440].map((minutes)=>(
                  <TouchableOpacity key={minutes} onPress={()=>setLocationDuration(minutes)} style={{ borderWidth:1,borderColor:locationDuration===minutes?GOLD:BORDER,backgroundColor:locationDuration===minutes?"#102A3C":"#1A1A1A",borderRadius:20,paddingVertical:8,paddingHorizontal:12 }}>
                    <Text style={{ color:locationDuration===minutes?GOLD:TEXT,fontSize:11,fontWeight:"800" }}>{minutes===15?"15 min":minutes===60?"1 hour":minutes===240?"4 hours":"24 hours"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity disabled={locationLoading} onPress={startLiveLocationShare} style={{ backgroundColor:GOLD,borderRadius:12,padding:13,alignItems:"center",marginTop:14,opacity:locationLoading?0.6:1 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>{locationLoading?"Please wait…":"Start Live Sharing"}</Text>
              </TouchableOpacity>
              {locationStatus ? <Text style={{ color:"#8CCBFF",fontSize:11,lineHeight:16,marginTop:10 }}>{locationStatus}</Text> : null}
            </View>
            <View style={{ flexDirection:"row",alignItems:"center",marginBottom:8 }}>
              <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",flex:1 }}>Nearby Friends</Text>
              <TouchableOpacity onPress={findNearbyFriends} style={{ backgroundColor:"#102A3C",borderRadius:18,paddingHorizontal:11,paddingVertical:7 }}>
                <Text style={{ color:GOLD,fontSize:10,fontWeight:"900" }}>Find Nearby</Text>
              </TouchableOpacity>
            </View>
            {Object.keys(nearbyDistances).length ? [...(locationShares.incoming || [])].sort((a,b)=>(nearbyDistances[a.share_id]??Infinity)-(nearbyDistances[b.share_id]??Infinity)).map((item)=>(
              <View key={"nearby-"+item.share_id} style={{ flexDirection:"row",alignItems:"center",backgroundColor:PANEL,borderRadius:10,padding:10,marginBottom:6 }}>
                <Ionicons name="location" color={GOLD} size={17}/>
                <Text style={{ color:TEXT,fontSize:11,fontWeight:"800",flex:1,marginLeft:8 }}>@{item.owner_username}</Text>
                <Text style={{ color:MUTED,fontSize:10 }}>{nearbyDistances[item.share_id].toFixed(1)} km</Text>
              </View>
            )) : <Text style={{ color:MUTED,fontSize:10,marginBottom:13 }}>Only friends actively sharing their location with you can appear here.</Text>}
            <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",marginBottom:8 }}>People sharing with you</Text>
            {locationShares.incoming.map((item)=>(
              <View key={item.share_id} style={{ backgroundColor:PANEL,borderRadius:12,padding:12,marginBottom:8 }}>
                <Text style={{ color:TEXT,fontSize:12,fontWeight:"900" }}>@{item.owner_username}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:4 }}>Updated {new Date(item.updated_at).toLocaleString()} · Expires {new Date(item.expires_at).toLocaleString()}</Text>
                <TouchableOpacity onPress={()=>Linking.openURL("https://www.google.com/maps/search/?api=1&query="+item.latitude+","+item.longitude)} style={{ paddingVertical:8 }}><Text style={{ color:GOLD,fontSize:11,fontWeight:"900" }}>Open on Map</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>endLocationShare(item.share_id)}><Text style={{ color:"#F08080",fontSize:11,fontWeight:"800" }}>Stop receiving this share</Text></TouchableOpacity>
              </View>
            ))}
            {!locationShares.incoming.length ? <Text style={{ color:MUTED,fontSize:11,marginBottom:12 }}>No friends are sharing their location with you.</Text> : null}
            <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",marginTop:12,marginBottom:8 }}>Your active shares</Text>
            {locationShares.outgoing.map((item)=>(
              <View key={item.share_id} style={{ backgroundColor:PANEL,borderRadius:12,padding:12,marginBottom:8 }}>
                <Text style={{ color:TEXT,fontSize:12,fontWeight:"900" }}>Shared with @{item.recipient_username}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:4 }}>Updated {new Date(item.updated_at).toLocaleString()} · Expires {new Date(item.expires_at).toLocaleString()}</Text>
                <TouchableOpacity onPress={()=>endLocationShare(item.share_id)} style={{ paddingVertical:8 }}><Text style={{ color:"#F08080",fontSize:11,fontWeight:"900" }}>Stop sharing now</Text></TouchableOpacity>
              </View>
            ))}
            {!locationShares.outgoing.length ? <Text style={{ color:MUTED,fontSize:11 }}>You are not sharing your location with anyone.</Text> : null}
            <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",marginTop:18,marginBottom:8 }}>Recent Location History</Text>
            {(locationShares.history || []).map((item)=>(
              <View key={"history-"+item.share_id} style={{ backgroundColor:PANEL,borderRadius:11,padding:11,marginBottom:7 }}>
                <Text style={{ color:TEXT,fontSize:11,fontWeight:"800" }}>{item.owner_username===username ? "You shared with @"+item.recipient_username : "@"+item.owner_username+" shared with you"}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:4 }}>{new Date(item.created_at).toLocaleString()} · {item.active ? "Active" : "Ended"}</Text>
              </View>
            ))}
            {!(locationShares.history || []).length ? <Text style={{ color:MUTED,fontSize:11 }}>No location sharing history in the last 30 days.</Text> : null}
            <View style={{ backgroundColor:"#1B1B1B",borderRadius:12,padding:12,marginTop:15,marginBottom:20 }}>
              <Text style={{ color:MUTED,fontSize:10,lineHeight:15 }}>Location is shared only after you press Start, only with the selected mutual follower, and expires automatically. Background Location requires the separate switch, Always permission, and an ongoing system notification. You can stop sharing here at any time. Approximate Location rounds coordinates before sending.</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={pinSetupVisible && visible} transparent animationType="fade" onRequestClose={() => setPinSetupVisible(false)}>
        <View style={{ flex:1,backgroundColor:"rgba(0,0,0,0.82)",justifyContent:"center",padding:24 }}>
          <View style={{ backgroundColor:"#121212",borderRadius:20,borderWidth:1,borderColor:"#303030",padding:20 }}>
            <Text style={{ color:TEXT,fontSize:19,fontWeight:"900" }}>{pinAlreadySet ? "Change App PIN" : "Set App PIN"}</Text>
            <Text style={{ color:MUTED,fontSize:12,lineHeight:18,marginTop:7 }}>Choose a 4–6 digit PIN. It will be required when Bhumi Social AI is reopened or returns from the background.</Text>
            <TextInput value={pinValue} onChangeText={(v)=>setPinValue(v.replace(/\D/g,"").slice(0,6))} placeholder="New 4–6 digit PIN" placeholderTextColor="#777777" keyboardType="number-pad" secureTextEntry maxLength={6} style={{ color:TEXT,borderWidth:1,borderColor:BORDER,borderRadius:12,padding:13,marginTop:16,fontSize:18,letterSpacing:5 }} />
            <TextInput value={pinConfirmValue} onChangeText={(v)=>setPinConfirmValue(v.replace(/\D/g,"").slice(0,6))} placeholder="Confirm PIN" placeholderTextColor="#777777" keyboardType="number-pad" secureTextEntry maxLength={6} style={{ color:TEXT,borderWidth:1,borderColor:BORDER,borderRadius:12,padding:13,marginTop:10,fontSize:18,letterSpacing:5 }} />
            <TouchableOpacity onPress={async()=>{
              if(pinValue.length<4||pinValue.length>6){setNotice({title:"Invalid PIN",message:"Enter a PIN containing 4 to 6 digits."});return;}
              if(pinValue!==pinConfirmValue){setNotice({title:"PIN mismatch",message:"The two PIN entries do not match."});return;}
              try{
                await SecureStore.setItemAsync("bhumi_app_lock_pin",pinValue);
                await SecureStore.setItemAsync("bhumi_app_auto_lock","true");
                const saved=await saveSettingsPreferences({"security.appLock":true,"security.pin":true,"security.autoLock":true});
                setPreferences((current)=>({...current,...saved,"security.appLock":true,"security.pin":true}));
                setPinSetupVisible(false);
                setNotice({title:"App Lock enabled",message:"Your PIN is saved securely on this device. The app will ask for it when reopened or resumed."});
              }catch(error){setNotice({title:"Could not save PIN",message:error?.message||"Secure storage is unavailable."});}
            }} style={{ backgroundColor:GOLD,borderRadius:12,padding:14,alignItems:"center",marginTop:15 }}>
              <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>Save App PIN</Text>
            </TouchableOpacity>
            {pinAlreadySet ? <TouchableOpacity onPress={async()=>{
              try{
                await SecureStore.deleteItemAsync("bhumi_app_lock_pin");
                await SecureStore.setItemAsync("bhumi_app_auto_lock","false");
                const saved=await saveSettingsPreferences({"security.appLock":false,"security.pin":false});
                setPreferences((current)=>({...current,...saved,"security.appLock":false,"security.pin":false}));
                setPinSetupVisible(false);
                setNotice({title:"App Lock disabled",message:"The device PIN requirement has been removed."});
              }catch(error){setNotice({title:"Could not disable App Lock",message:error?.message||"Please try again."});}
            }} style={{ padding:13,alignItems:"center",marginTop:4 }}>
              <Text style={{ color:"#F08080",fontWeight:"800" }}>Disable App Lock</Text>
            </TouchableOpacity> : null}
            <TouchableOpacity onPress={()=>setPinSetupVisible(false)} style={{ padding:10,alignItems:"center" }}>
              <Text style={{ color:MUTED,fontWeight:"800" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={qrVisible && visible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.82)", justifyContent:"center", alignItems:"center", padding:24 }}>
          <View style={{ width:"100%", maxWidth:340, backgroundColor:"#FFFFFF", borderRadius:22, padding:22, alignItems:"center" }}>
            <Text style={{ color:"#111111", fontSize:19, fontWeight:"900" }}>Your profile QR code</Text>
            <Text style={{ color:"#666666", fontSize:12, marginTop:5, marginBottom:18 }}>Scan to open this Bhumi Social AI profile</Text>
            <Image source={{ uri:"https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=" + encodeURIComponent("bhumisocial://profile/" + (username || "")) }} style={{ width:250, height:250 }} resizeMode="contain" accessibilityLabel="Profile QR code" />
            <Text style={{ color:"#222222", fontWeight:"800", marginTop:12 }}>@{username || "your-profile"}</Text>
            <TouchableOpacity onPress={() => Share.share({ message:"Find me on Bhumi Social AI: bhumisocial://profile/" + (username || "") + "\nGet Bhumi Social AI: https://bhumi-social-app-1.onrender.com/download" })} style={{ backgroundColor:"#0095F6", borderRadius:13, paddingVertical:13, paddingHorizontal:22, marginTop:18, width:"100%", alignItems:"center" }}>
              <Text style={{ color:"#FFFFFF", fontWeight:"900" }}>Share Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQrVisible(false)} style={{ padding:13, marginTop:3 }}>
              <Text style={{ color:"#555555", fontWeight:"800" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!notice && visible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotice(null)}
      >
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.76)", justifyContent:"center", paddingHorizontal:28 }}>
          <View style={{ backgroundColor:"#121212", borderWidth:1, borderColor:"#363636", borderRadius:20, padding:20 }}>
            <View style={{ width:42, height:42, borderRadius:21, backgroundColor:"#1C1C1E", alignItems:"center", justifyContent:"center", marginBottom:13 }}>
              <Ionicons name="information-circle-outline" size={23} color={GOLD}/>
            </View>
            <Text style={{ color:TEXT, fontSize:17, fontWeight:"900" }}>{notice?.title || "Bhumi Social AI"}</Text>
            <Text style={{ color:MUTED, fontSize:13, lineHeight:19, marginTop:8 }}>{notice?.message || ""}</Text>
            <TouchableOpacity onPress={() => setNotice(null)} style={{ marginTop:18, backgroundColor:GOLD, borderRadius:13, paddingVertical:12, alignItems:"center" }}>
              <Text style={{ color:"#FFFFFF", fontSize:13, fontWeight:"900" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
