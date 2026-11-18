import React from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Alert, Linking, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loadSettingsPreferences, saveSettingsPreferences } from "./api";

const GOLD = "#D8B86A";
const BG = "#0B0712";
const PANEL = "#171020";
const BORDER = "#49345F";
const TEXT = "#F4EFFA";
const MUTED = "#B8AACB";

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
    ["privacy.messageRequests","Message Requests","Filter messages from people you do not follow",true],
    ["privacy.storyReplies","Story Replies","Allow replies to your stories",true],
  ]},
  { key:"security", title:"Security Settings", subtitle:"Protect your account and sessions", icon:"lock-closed-outline", legacy:"security", fields:[
    ["security.twoFactor","Two-Factor Authentication","Add an extra sign-in verification step",false],
    ["security.loginAlerts","New Device Login Alerts","Receive alerts for new sign-ins",true],
    ["security.suspiciousAlerts","Suspicious Login Protection","Enable additional sign-in risk alerts",true],
    ["security.loginHistory","Login History","Review recent account sign-ins",false],
    ["security.activeDevices","Active Devices","Review devices currently signed in",false],
  ]},
  { key:"notifications", title:"Notification Settings", subtitle:"Choose alerts, sounds and quiet hours", icon:"notifications-outline", legacy:"notifications", fields:[
    ["notifications.sound","Notification Sound","Play a sound for app notifications",true],
    ["notifications.royalTone","Royal Futuristic Tone","Use the Bhumi Social signature tone",true],
    ["notifications.quietHours","Quiet Hours","Silence non-critical notifications on a schedule",false],
    ["notifications.preview","Notification Preview","Show message previews in notifications",true],
    ["notifications.likes","Like Alerts","Receive notifications for likes",true],
    ["notifications.comments","Comment Alerts","Receive notifications for comments",true],
    ["notifications.follows","Follow Alerts","Receive notifications for follows",true],
    ["notifications.messages","Message Alerts","Receive notifications for messages",true],
  ]},
  { key:"messages", title:"Messages & Chat Settings", subtitle:"Personalize your conversations", icon:"chatbubbles-outline", fields:[
    ["messages.chatLock","Chat Lock","Protect selected chats with a device lock",false],
    ["messages.biometrics","Biometric Chat Lock","Use supported device biometrics",false],
    ["messages.disappearing","Disappearing Messages","Choose a default disappearing message duration",false],
    ["messages.typing","Typing Indicator","Show when you are typing",true],
    ["messages.translation","Message Translation","Enable translation controls in chats",true],
    ["messages.unknownFilter","Unknown Message Filter","Filter messages from unknown accounts",true],
  ]},
  { key:"story", title:"Story Settings", subtitle:"Manage story audience and replies", icon:"images-outline", fields:[
    ["story.closeFriends","Close Friends","Manage your Close Friends membership from each friend’s Chat Studio",true],
    ["story.hideFrom","Hide Story From","Manage people who cannot view your stories",false],
    ["story.replies","Allow Story Replies","Control story reply availability",true],
    ["story.mentions","Allow Story Mentions","Control mentions in stories",true],
    ["story.autoSave","Auto Save Stories","Save your own stories to your archive",false],
  ]},
  { key:"feed", title:"Feed & Reels Settings", subtitle:"Control what and how you watch", icon:"play-circle-outline", fields:[
    ["feed.favorites","Favorites Feed","Prioritize selected accounts in your feed",true],
    ["feed.mutedAccounts","Muted Accounts","Manage accounts muted from your feed",false],
    ["feed.suggested","Suggested Posts","Control suggested content",true],
    ["feed.autoPlay","Video Auto-play","Automatically play feed videos",true],
    ["feed.dataQuality","High Quality on Mobile Data","Use higher media quality on mobile data",false],
  ]},
  { key:"blocked", title:"Blocked Accounts", subtitle:"Review and unblock accounts", icon:"person-remove-outline", legacy:"blocked", fields:[] },
  { key:"restricted", title:"Restricted Accounts", subtitle:"Manage limited interactions", icon:"eye-off-outline", legacy:"restricted", fields:[] },
  { key:"appearance", title:"Appearance Settings", subtitle:"Make the app feel like yours", icon:"color-palette-outline", fields:[
    ["appearance.theme","App Theme","Choose your preferred appearance",true],
    ["appearance.royalTheme","Royal Purple + Gold","Use the Bhumi premium theme",true],
    ["appearance.language","App Language","Choose your display language",true],
    ["appearance.largeText","Larger Text","Increase text size across the app",false],
    ["appearance.animations","App Animations","Enable interface animations",true],
  ]},
  { key:"advanced", title:"Advanced Settings", subtitle:"Data, storage and app permissions", icon:"options-outline", fields:[
    ["advanced.dataSaver","Data Saver","Reduce media data usage",false],
    ["advanced.cache","Cache Management","Allow the app to manage cached media",true],
    ["advanced.backgroundData","Background Data","Allow background network activity",true],
    ["advanced.permissions","App Permissions Manager","Review permissions granted to this app",false],
    ["advanced.reset","Reset Preferences","Restore app preferences to defaults",false],
  ]},
  { key:"help", title:"Help & About", subtitle:"Support, reports and app information", icon:"help-circle-outline", fields:[
    ["account.reportProblem","Report a Problem","Send a problem report to the support team",false],
    ["account.helpCenter","Help Center","Find help with Bhumi Social AI",false],
    ["account.appUpdates","Check App Updates","Check whether a newer app version is available",false],
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
      loadSettingsPreferences().then((data) => {
        if (alive) setPreferences(data || {});
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
      const saved = await saveSettingsPreferences({ [key]: value });
      setPreferences(saved);
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      Alert.alert("Save failed", error.message || "Could not save this setting.");
    } finally { setSavingKey(""); }
  };

  const renderField = (field) => {
    const [key, title, subtitle, defaultValue] = field;
    const value = preferences[key] ?? defaultValue;
    return (
      <View key={key} style={{ backgroundColor:PANEL, borderWidth:1, borderColor:BORDER, borderRadius:15, padding:14, marginBottom:10 }}>
        <View style={{ flexDirection:"row", alignItems:"center" }}>
          <View style={{ flex:1, paddingRight:12 }}>
            <Text style={{ color:TEXT, fontSize:14, fontWeight:"800" }}>{title}</Text>
            <Text style={{ color:MUTED, fontSize:11, marginTop:4, lineHeight:16 }}>{subtitle}</Text>
            {savingKey === key ? <Text style={{ color:GOLD, fontSize:10, marginTop:5 }}>Saving…</Text> : null}
          </View>
          <Switch value={!!value} onValueChange={(next) => saveValue(key,next)} disabled={!!savingKey} trackColor={{ false:"#51465E", true:"#7651B5" }} thumbColor={value ? GOLD : "#E8E2EF"} />
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
          <View style={{ flexDirection:"row", alignItems:"center", paddingHorizontal:18, paddingBottom:16, borderBottomWidth:1, borderBottomColor:BORDER }}>
            <TouchableOpacity onPress={() => setActive(null)} style={{ width:42,height:42,borderRadius:13,backgroundColor:PANEL,alignItems:"center",justifyContent:"center",marginRight:12 }}>
              <Ionicons name="arrow-back" size={22} color={GOLD}/>
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={{ color:TEXT,fontSize:19,fontWeight:"900" }}>{section.title}</Text>
              <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{section.subtitle}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding:18,paddingBottom: Platform.OS === "android" ? 64 : 40 }} keyboardShouldPersistTaps="handled">
            {section.key === "location" ? (
              <View style={{ backgroundColor:"#21162F",borderColor:GOLD,borderWidth:1,borderRadius:15,padding:14,marginBottom:14 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>LOCATION SAFETY</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Location sharing is off by default. Only share with people you choose. Live location and nearby discovery require device permission and server-side sharing controls before they can become active.</Text>
                <TouchableOpacity onPress={() => Linking.openSettings()} style={{ alignSelf:"flex-start",marginTop:12,backgroundColor:GOLD,borderRadius:10,paddingHorizontal:13,paddingVertical:9 }}>
                  <Text style={{ color:"#170F20",fontWeight:"900",fontSize:12 }}>Open App Permissions</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {section.key === "security" || section.key === "messages" ? (
              <View style={{ backgroundColor:"#21162F",borderRadius:14,padding:13,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"800",fontSize:12 }}>SECURITY NOTE</Text>
                <Text style={{ color:MUTED,fontSize:11,lineHeight:17,marginTop:5 }}>These saved preferences do not replace server-side verification or device-level biometric protection. Those workflows require their dedicated secure implementation.</Text>
              </View>
            ) : null}
            {section.key === "messages" ? (
              <View style={{ backgroundColor:"#21162F",borderWidth:1,borderColor:GOLD,borderRadius:14,padding:14,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>CHAT PERSONALIZATION STUDIO</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Open Messages, enter any conversation, then tap the palette icon. Choose a separate chat theme, set a private name for that friend, and add or remove them from Favourite Friends or Close Friends. Favourite and Close Friends filters appear above your chat list.</Text>
              </View>
            ) : null}
            {section.fields.map(renderField)}
            {section.legacy ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.(section.legacy); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#170F20",fontWeight:"900" }}>Open Existing {section.title}</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "help" ? (
              <TouchableOpacity onPress={() => { setActive(null); onAbout?.(); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#170F20",fontWeight:"900" }}>About & App Updates</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "account" ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.("account"); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#170F20",fontWeight:"900" }}>Manage Email & Mobile</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "security" ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.("security"); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#170F20",fontWeight:"900" }}>Change Password / Other Sessions</Text>
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
        <View style={{ flex:1,backgroundColor:"rgba(5,2,12,0.86)",justifyContent:"flex-end",paddingBottom: Platform.OS === "android" ? 38 : 0 }}>
          <View style={{ backgroundColor:BG,borderTopLeftRadius:25,borderTopRightRadius:25,borderWidth:1,borderColor:BORDER,paddingTop:18,paddingHorizontal:17,paddingBottom: Platform.OS === "android" ? 22 : 25,maxHeight:"94%" }}>
            <View style={{ alignSelf:"center",width:42,height:5,borderRadius:5,backgroundColor:"#7651B5",marginBottom:17 }}/>
            <View style={{ backgroundColor:"#1A1028",borderWidth:1,borderColor:BORDER,borderRadius:20,padding:18,marginBottom:15 }}>
              <Text style={{ color:GOLD,fontSize:11,fontWeight:"900",letterSpacing:2 }}>BHUMI SOCIAL AI</Text>
              <Text style={{ color:TEXT,fontSize:25,fontWeight:"900",marginTop:6 }}>Settings</Text>
              <Text style={{ color:MUTED,fontSize:12,marginTop:4 }}>Your account, privacy and app controls</Text>
            </View>
            {loading ? <ActivityIndicator color={GOLD} style={{ marginVertical:18 }}/> : null}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? 48 : 12 }}>
              {SECTIONS.map((section) => (
                <TouchableOpacity key={section.key} onPress={() => setActive(section.key)} activeOpacity={0.82} style={{ flexDirection:"row",alignItems:"center",backgroundColor:PANEL,borderWidth:1,borderColor:BORDER,borderRadius:15,padding:13,marginBottom:9 }}>
                  <View style={{ width:43,height:43,borderRadius:13,backgroundColor:"#281A39",alignItems:"center",justifyContent:"center",marginRight:12 }}>
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
