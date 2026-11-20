import React from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Alert, Linking, Platform, StyleSheet
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loadSettingsPreferences, saveSettingsPreferences, loadNotificationPreference, saveNotificationPreference, loadNotificationDetails, saveNotificationDetails } from "./api";

const GOLD = "#0095F6";
const BG = "#000000";
const PANEL = "#121212";
const BORDER = "#262626";
const TEXT = "#FFFFFF";
const MUTED = "#A8A8A8";

const ACTION_KEYS = new Set([
  "profile.usernameChange","account.profileQr","account.multipleAccounts","account.verification",
  "account.dataDownload","account.deactivation","account.deletion",
  "security.twoFactor","security.loginHistory","security.activeDevices","security.appLock",
  "security.fingerprint","security.faceUnlock","security.pin","security.checkup",
  "privacy.profileVisitors","privacy.hiddenWords",
  "story.hideFrom","story.highlights","feed.mutedAccounts","feed.favorites","feed.notInterested",
  "appearance.appIcon","appearance.display","appearance.chat",
  "advanced.permissions","advanced.reset","advanced.storage","advanced.clearCache",
  "creator.monetization","creator.collaboration","creator.promotions","premium.profileStudio",
  "account.reportProblem","account.helpCenter","account.appUpdates",
  "account.appVersionInfo","account.terms","account.privacyPolicy","account.openSource",
  "location.history"
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
    ["location.background","Background Location","Allow location updates while the app is in use in the background",false],
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
    ["messages.voiceCalls","Incoming Voice Calls","Allow voice call invitations",true],
    ["messages.videoCalls","Incoming Video Calls","Allow video call invitations",true],
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
["data.saver","Data Saver","Reduce mobile data usage",false],
    ["data.storage","Storage Usage","Review app storage usage",true],
    ["data.autoDownload","Media Auto Download","Automatically download supported media",true],
    ["data.wifiOnly","Wi-Fi Only Downloads","Download media only on Wi-Fi",false],
    ["data.background","Background Data","Allow background network activity",true],
    ["data.highQuality","High Quality Uploads","Prefer high quality uploads",true],
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
  const [preferences, setPreferences] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    if (visible) {
      setLoading(true);
      Promise.all([
        loadSettingsPreferences(),
        loadNotificationPreference(),
        loadNotificationDetails(),
      ]).then(([data, notificationsEnabled, notificationDetails]) => {
        if (!alive) return;
        const merged = { ...(data || {}) };
        merged["notifications.enabled"] = notificationsEnabled;
        Object.entries(notificationDetails || {}).forEach(([name, enabled]) => {
          const key = ({ likes:"notifications.likes", comments:"notifications.comments", follows:"notifications.follows", messages:"notifications.messages" })[name];
          if (key) merged[key] = enabled;
        });
        setPreferences(merged);
      }).catch((error) => {
        if (alive) Alert.alert("Settings", error.message || "Could not load preferences.");
      }).finally(() => { if (alive) setLoading(false); });
    } else {
      setActive(null);
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
          setPreferences(saved);
        }
      }
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      Alert.alert("Save failed", error.message || "Could not save this setting.");
    } finally { setSavingKey(""); }
  };

  const runSettingAction = (key) => {
    if (key === "profile.usernameChange" || key === "account.multipleAccounts" ||
        key === "account.verification" || key === "account.dataDownload" ||
        key === "account.deactivation" || key === "account.deletion") {
      setActive(null);
      onLegacyOpen?.("account");
      return;
    }
    if (key.startsWith("security.")) {
      setActive(null);
      onLegacyOpen?.("security");
      return;
    }
    if (key === "account.appUpdates" || key === "account.appVersionInfo" ||
        key === "account.terms" || key === "account.privacyPolicy" ||
        key === "account.openSource" || key === "account.helpCenter") {
      setActive(null);
      onAbout?.();
      return;
    }
    if (key === "advanced.permissions" || key === "location.history") {
      Linking.openSettings();
      return;
    }
    const labels = {
      "account.profileQr":"Profile QR generation is not connected yet.",
      "account.reportProblem":"The in-app support submission form is not connected yet.",
      "advanced.clearCache":"Cache clearing needs the app storage service to be connected.",
      "advanced.reset":"Preference reset needs a confirmation and reset endpoint.",
      "advanced.storage":"Detailed storage reporting is not connected yet.",
      "creator.monetization":"Creator monetization is not enabled on the server yet.",
      "creator.collaboration":"Brand collaboration tools are not connected yet.",
      "creator.promotions":"Promotion tools are not connected yet.",
      "premium.profileStudio":"Profile Studio is not connected yet."
    };
    Alert.alert("Not available yet", labels[key] || "This action is not connected yet. It has not been enabled.");
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
            <TouchableOpacity onPress={() => runSettingAction(key)} style={{ backgroundColor:"#1C1C1E",borderColor:"#303030",borderWidth:1,borderRadius:18,paddingHorizontal:15,paddingVertical:9 }}>
              <Text style={{ color:GOLD,fontSize:11,fontWeight:"900" }}>Open</Text>
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
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Location sharing is off by default. Only share with people you choose. Live location and nearby discovery require device permission and server-side sharing controls before they can become active.</Text>
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
            {section.fields.map(renderField)}
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
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={{ flex:1,backgroundColor:"rgba(0,0,0,0.72)",justifyContent:"flex-end",paddingBottom: Platform.OS === "android" ? 38 : 0 }}>
          <View style={{ backgroundColor:BG,borderTopLeftRadius:22,borderTopRightRadius:22,borderWidth:1,borderColor:BORDER,paddingTop:18,paddingHorizontal:17,paddingBottom: Platform.OS === "android" ? 22 : 25,maxHeight:"94%" }}>
            <View style={{ alignSelf:"center",width:42,height:5,borderRadius:5,backgroundColor:"#0095F6",marginBottom:17 }}/>
            <View style={{ backgroundColor:"#121212",borderWidth:1,borderColor:BORDER,borderRadius:16,padding:18,marginBottom:15 }}>
              <Text style={{ color:GOLD,fontSize:11,fontWeight:"900",letterSpacing:2 }}>BHUMI SOCIAL AI</Text>
              <Text style={{ color:TEXT,fontSize:25,fontWeight:"900",marginTop:6 }}>Settings</Text>
              <Text style={{ color:MUTED,fontSize:12,marginTop:4 }}>Your account, privacy and app controls</Text>
            </View>
            {loading ? <ActivityIndicator color={GOLD} style={{ marginVertical:18 }}/> : null}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? 48 : 12 }}>
              {SECTIONS.map((section) => (
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
              ))}
              <TouchableOpacity onPress={onLogout} style={{ flexDirection:"row",alignItems:"center",justifyContent:"center",backgroundColor:"#35191D",borderWidth:1,borderColor:"#7C3039",borderRadius:14,padding:14,marginTop:5 }}>
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
    </>
  );
}
