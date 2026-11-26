import React from "react";
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, ScrollView,
  Platform, SafeAreaView, Text, TextInput, TouchableOpacity, View, Linking,
  Keyboard, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import VoiceVideoCallControls from "./VoiceVideoCallControls";
import {
  loadMessageConversations, loadDirectMessages, loadUserNotes, saveUserNote, sendDirectMessage, searchUsers, uploadChatAttachment,
} from "./api";

const API_ORIGIN = "https://bhumi-social-app-1.onrender.com";
const avatarUri = (value) => {
  if (!value) return null;
  const uri = String(value);
  return uri.startsWith("http") ? uri : API_ORIGIN + (uri.startsWith("/") ? "" : "/") + uri;
};
const getUsername = (item) => String(item?.username || item?.peerUsername || item?.otherUsername || "").trim();
const getMessageText = (item) => String(item?.text || item?.message || "");
const getSender = (item) => String(item?.sender || item?.senderUsername || item?.fromUsername || item?.username || "").toLowerCase();

export default function DirectMessagesScreen({
  visible, onClose, authSession, ownAvatarUrl, initialUsername = "", onSelectedChatUserChange, onOpenProfile, onNavigateTab, lightAppearance = false,
}) {
  const C = lightAppearance ? {
    bg: "#FFFFFF", panel: "#FFFFFF", field: "#F2F2F2", line: "#DBDBDB",
    text: "#111111", muted: "#737373", blue: "#0095F6", mine: "#3797F0",
    other: "#EFEFEF", danger: "#D93025",
  } : {
    bg: "#000000", panel: "#121212", field: "#1C1C1E", line: "#303030",
    text: "#F5F5F5", muted: "#A8A8A8", blue: "#0095F6", mine: "#245A91",
    other: "#222222", danger: "#FF6B6B",
  };
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  // Logical dp dimensions adapt to rotation, split-screen and different phones.
  const compactScreen = windowWidth < 360;
  const shortScreen = windowHeight < 680;
  const narrowScreen = windowWidth < 340;
  const horizontalInset = narrowScreen ? 10 : compactScreen ? 12 : 16;
  const rowAvatarSize = narrowScreen ? 46 : compactScreen ? 50 : 56;
  const storyAvatarSize = narrowScreen ? 48 : compactScreen ? 50 : 54;
  const storyRowGap = narrowScreen ? 9 : compactScreen ? 12 : 17;
  const composerIconSize = narrowScreen ? 20 : compactScreen ? 21 : 23;
  const textScale = Math.min(Math.max(fontScale || 1, 0.9), 1.25);
  const [conversations, setConversations] = React.useState([]);
  const [friendsNotes, setFriendsNotes] = React.useState([]);
  const [ownNote, setOwnNote] = React.useState(null);
  const [noteComposerOpen, setNoteComposerOpen] = React.useState(false);
  const [noteViewer, setNoteViewer] = React.useState(null);
  const [noteText, setNoteText] = React.useState("");
  const [songUrl, setSongUrl] = React.useState("");
  const [songTitle, setSongTitle] = React.useState("");
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [peer, setPeer] = React.useState("");
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [people, setPeople] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [attachment, setAttachment] = React.useState(null);
  const [isVoiceRecording, setIsVoiceRecording] = React.useState(false);
  const voiceRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [error, setError] = React.useState("");
  const [profileInfoOpen, setProfileInfoOpen] = React.useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [inboxTab, setInboxTab] = React.useState("All");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const listRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const peerRef = React.useRef("");
  const requestRef = React.useRef(0);

  const refreshInbox = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [rows, notes] = await Promise.all([
        loadMessageConversations(),
        loadUserNotes().catch(() => ({ friendsNotes: [] })),
      ]);
      setConversations(Array.isArray(rows) ? rows : []);
      setFriendsNotes(Array.isArray(notes?.friendsNotes) ? notes.friendsNotes : []);
      setOwnNote(notes?.ownNote || null);
    } catch (e) {
      setError(e?.message || "Inbox load nahi hua.");
    } finally {
      setBusy(false);
    }
  }, []);

  const openChat = React.useCallback(async (username) => {
    const target = String(username || "").trim().replace(/^@/, "");
    if (!target) return;
    const requestId = ++requestRef.current;
    peerRef.current = target;
    setPeer(target);
    onSelectedChatUserChange?.(target);
    setMessages([]);
    setDraft("");
    setAttachment(null);
    setError("");
    setBusy(true);
    try {
      const rows = await loadDirectMessages(target);
      if (requestRef.current === requestId && peerRef.current === target) {
        setMessages(Array.isArray(rows) ? rows : []);
      }
    } catch (e) {
      if (requestRef.current === requestId) setError(e?.message || "Messages load nahi hue.");
    } finally {
      if (requestRef.current === requestId) setBusy(false);
    }
  }, [onSelectedChatUserChange]);

  React.useEffect(() => {
    if (!visible) {
      requestRef.current += 1;
      peerRef.current = "";
      setPeer("");
      setMessages([]);
      setDraft("");
      setAttachment(null);
      setQuery("");
      setPeople([]);
      setInboxTab("All");
      setFilterOpen(false);
      setProfileInfoOpen(false);
      setEmojiPickerOpen(false);
      setError("");
      return;
    }
    const requested = String(initialUsername || "").trim();
    if (requested && requested.toLowerCase() !== peerRef.current.toLowerCase()) {
      openChat(requested);
    } else if (!requested && !peerRef.current) {
      refreshInbox();
    }
  }, [visible, initialUsername, openChat, refreshInbox]);

  React.useEffect(() => {
    if (!visible || peer || query.trim().length < 2) {
      setPeople([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const result = await searchUsers(query.trim());
        if (live) setPeople(Array.isArray(result) ? result : []);
      } catch (e) {
        if (live) setError(e?.message || "Search failed.");
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [visible, peer, query]);

  const send = async () => {
    const text = draft.trim();
    if ((!text && !attachment) || !peer || sending) return;
    setSending(true);
    setError("");
    try {
      const sent = await sendDirectMessage(peer, text, attachment);
      if (sent) setMessages((old) => [...old, sent]);
      setDraft("");
      setAttachment(null);
      Keyboard.dismiss();
      requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
    } catch (e) {
      setError(e?.message || "Message send nahi hua.");
    } finally {
      setSending(false);
    }
  };


  const startVoiceRecording = async () => {
    if (isVoiceRecording || sending || !peer) return;
    setError("");
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Voice message record karne ke liye Microphone permission allow karein.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await voiceRecorder.prepareToRecordAsync();
      voiceRecorder.record();
      setIsVoiceRecording(true);
    } catch (e) {
      setError(e?.message || "Voice recording shuru nahi ho saki.");
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  const stopAndSendVoiceRecording = async () => {
    if (!isVoiceRecording || sending) return;
    setIsVoiceRecording(false);
    setSending(true);
    setError("");
    try {
      await voiceRecorder.stop();
      const uri = voiceRecorder.uri;
      if (!uri) throw new Error("Recorded voice file nahi mila.");
      const uploaded = await uploadChatAttachment({
        uri,
        name: "Voice message.m4a",
        mimeType: "audio/mp4",
        type: "audio/mp4",
      });
      const sent = await sendDirectMessage(peer, "", uploaded);
      if (sent) setMessages((old) => [...old, sent]);
      Keyboard.dismiss();
      requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
    } catch (e) {
      setError(e?.message || "Voice message send nahi hua.");
    } finally {
      setSending(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  const uploadPickedAsset = async (asset) => {
    if (!asset) return;
    setSending(true);
    setError("");
    try {
      const uploaded = await uploadChatAttachment(asset);
      setAttachment(uploaded);
    } catch (e) {
      setError(e?.message || "Photo upload nahi hua.");
    } finally {
      setSending(false);
    }
  };

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Gallery permission allow karein.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: false, quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]) await uploadPickedAsset(result.assets[0]);
    } catch (e) {
      setError(e?.message || "Gallery open nahi hui.");
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera permission allow karein.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"], allowsEditing: false, quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]) await uploadPickedAsset(result.assets[0]);
    } catch (e) {
      setError(e?.message || "Camera open nahi hua.");
    }
  };

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setSending(true);
      setError("");
      const uploaded = await uploadChatAttachment(result.assets[0]);
      setAttachment(uploaded);
    } catch (e) {
      setError(e?.message || "Attachment upload nahi hua.");
    } finally {
      setSending(false);
    }
  };

  const closeChat = () => {
    requestRef.current += 1;
    peerRef.current = "";
    setPeer("");
    onSelectedChatUserChange?.("");
    setMessages([]);
    setDraft("");
    setAttachment(null);
    setEmojiPickerOpen(false);
    setError("");
    Keyboard.dismiss();
    refreshInbox();
  };

  const closeScreen = () => {
    Keyboard.dismiss();
    onClose?.();
  };

  const avatar = (item, size = 50) => {
    const uri = avatarUri(item?.avatarUrl || item?.profilePicture || item?.avatar);
    const letter = String(item?.displayName || item?.username || peer || "?").slice(0, 1).toUpperCase();
    return uri ? (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.field }} />
    ) : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E5E5E5", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.text, fontWeight: "800", fontSize: size * 0.38 }}>{letter}</Text>
      </View>
    );
  };

  const peerDetails = conversations.find((x) => getUsername(x).toLowerCase() === peer.toLowerCase());

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => peer ? closeChat() : closeScreen()}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ minHeight: shortScreen ? 94 : 98, paddingTop: 40, paddingHorizontal: horizontalInset, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: C.line }}>
            <TouchableOpacity
              onPress={() => peer ? closeChat() : closeScreen()}
              accessibilityRole="button"
              accessibilityLabel={peer ? "Back to messages" : "Close messages"}
              style={{ width: 34, height: 48, justifyContent: "center" }}
            >
              <Ionicons name={peer ? "arrow-back" : "close"} size={25} color={C.text} />
            </TouchableOpacity>
            {peer ? (
              <>
                <TouchableOpacity onPress={() => setProfileInfoOpen(true)} style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: compactScreen ? 7 : 10 }}>
                  {avatar(peerDetails, 38)}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 15, fontWeight: "800" }}>{peerDetails?.displayName || peer}</Text>
                    <Text numberOfLines={1} style={{ color: C.muted, fontSize: 11 }}>@{peer}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={C.muted} />
                </TouchableOpacity>
                <View style={{ flexDirection: "row", alignItems: "center", gap: compactScreen ? 9 : 15, paddingLeft: 5 }}>
                  <VoiceVideoCallControls username={peer} currentUsername={authSession?.username || ""} enableIncoming={false} enableOutgoing={true} showButtons={true} />
                  <TouchableOpacity onPress={() => setProfileInfoOpen(true)} accessibilityRole="button" accessibilityLabel="Conversation information">
                    <Ionicons name="pricetag-outline" size={24} color={C.text} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={{ color: C.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 }}>{authSession?.username || "Messages"}</Text>
                  <Ionicons name="chevron-down" size={17} color={C.text} />
                </View>
                <TouchableOpacity onPress={() => {
                  setQuery("");
                  setPeople([]);
                  requestAnimationFrame(() => searchInputRef.current?.focus?.());
                }} style={{ width: 42, height: 46, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="New message">
                  <Ionicons name="create-outline" size={27} color={C.text} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {!peer ? (
            <View style={{ flex: 1, minHeight: 0 }}>
              <View style={{ marginHorizontal: horizontalInset, marginTop: query.trim() ? 13 : 0, marginBottom: 5 }}>
                <View style={{ width: "100%", height: 42, borderRadius: 11, backgroundColor: C.field, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
                  <Ionicons name="search" size={18} color={C.muted} />
                  <TextInput
                    ref={searchInputRef}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search"
                    placeholderTextColor={C.muted}
                    autoCapitalize="none"
                    returnKeyType="search"
                    style={{ flex: 1, color: C.text, paddingHorizontal: 9, height: 40 }}
                  />
                  {!!query && <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={C.muted} /></TouchableOpacity>}
                </View>
              </View>
              {!query.trim() ? (
                <>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: storyAvatarSize + 48, maxHeight: storyAvatarSize + 62, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: horizontalInset, paddingTop: 3, paddingBottom: 5, gap: storyRowGap, alignItems: "flex-end" }}>
                    <TouchableOpacity onPress={() => { setNoteText(ownNote?.text || ""); setSongUrl(ownNote?.audioUrl || ""); setSongTitle(ownNote?.audioTitle || ""); setNoteComposerOpen(true); }} activeOpacity={0.8} style={{ width: storyAvatarSize + 24, alignItems: "center" }}>
                      {(ownNote?.text || ownNote?.audioTitle) ? (
                        <View style={{ maxWidth: storyAvatarSize + 30, minHeight: 27, borderRadius: 13, backgroundColor: C.field, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5, borderWidth: 0.5, borderColor: C.line }}>
                          <Text numberOfLines={2} style={{ color: C.text, fontSize: 10, textAlign: "center" }}>{ownNote.text || ("♫ " + ownNote.audioTitle)}</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: C.field, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 }}>
                          <Text style={{ color: C.muted, fontSize: 10 }}>Write a note…</Text>
                        </View>
                      )}
                      <View style={{ width: storyAvatarSize, height: storyAvatarSize, borderRadius: storyAvatarSize / 2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
                        {avatar({ username: authSession?.username || "You", avatarUrl: ownAvatarUrl }, storyAvatarSize)}
                        <View style={{ position: "absolute", right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, borderWidth: 2, borderColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="add" size={15} color="#FFFFFF" />
                        </View>
                      </View>
                      <Text numberOfLines={1} style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>Your note</Text>
                    </TouchableOpacity>
                    {friendsNotes.map((note) => (
                      <TouchableOpacity key={String(note.username)} onPress={() => setNoteViewer(note)} activeOpacity={0.8} style={{ width: storyAvatarSize + 24, alignItems: "center" }}>
                        <View style={{ maxWidth: storyAvatarSize + 30, minHeight: 27, borderRadius: 13, backgroundColor: C.field, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5, borderWidth: 0.5, borderColor: C.line }}>
                          <Text numberOfLines={2} style={{ color: C.text, fontSize: 10, textAlign: "center" }}>{note.text || (note.audioTitle ? "♫ " + note.audioTitle : "")}</Text>
                        </View>
                        {avatar({ username: note.username, displayName: note.displayName, avatarUrl: note.avatarUrl }, storyAvatarSize)}
                        <Text numberOfLines={1} style={{ color: C.text, fontSize: 10, fontWeight: "600", marginTop: 2, maxWidth: storyAvatarSize + 24 }}>{note.displayName || note.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {!query.trim() ? (
                <>
                  <View style={{ paddingHorizontal: horizontalInset, paddingTop: 0, paddingBottom: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: "800" }}>Messages</Text>
                    <TouchableOpacity onPress={() => setInboxTab("Requests")} accessibilityRole="button" accessibilityLabel="Message requests">
                      <Text style={{ color: C.blue, fontSize: 13, fontWeight: "600" }}>Requests</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ paddingHorizontal: horizontalInset, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 0.5, borderBottomColor: C.line }}>
                    {["All", "Primary", "General"].map((tab) => (
                      <TouchableOpacity key={tab} onPress={() => setInboxTab(tab)} accessibilityRole="button" accessibilityLabel={tab + " messages"} style={{ flex: 1, minHeight: 30, alignItems: "center", justifyContent: "center", borderBottomWidth: inboxTab === tab ? 2 : 0, borderBottomColor: C.text }}>
                        <Text style={{ color: inboxTab === tab ? C.text : C.muted, fontSize: 13 * textScale, fontWeight: inboxTab === tab ? "800" : "600" }}>{tab}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
              {query.trim().length >= 2 ? (
                <FlatList
                  data={people}
                  keyExtractor={(x, i) => String(x.username || i)}
                  ListHeaderComponent={() => {
                    const needle = query.trim().toLowerCase();
                    const matches = conversations.filter((item) => {
                      const searchable = [getUsername(item), item.displayName, item.lastMessage, item.last_message]
                        .filter(Boolean).join(" ").toLowerCase();
                      return searchable.includes(needle);
                    });
                    return matches.length ? (
                      <View>
                        <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>Chats</Text>
                        {matches.map((item, index) => (
                          <TouchableOpacity key={String(getUsername(item) || index)} onPress={() => openChat(getUsername(item))} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 10, gap: 12 }}>
                            {avatar(item)}
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "700" }}>{item.displayName || getUsername(item)}</Text>
                              <Text numberOfLines={1} style={{ color: C.muted, marginTop: 3 }}>{item.lastMessage || item.last_message || "Tap to chat"}</Text>
                            </View>
                            <Ionicons name="chatbubble-outline" size={21} color={C.blue} />
                          </TouchableOpacity>
                        ))}
                        <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>People</Text>
                      </View>
                    ) : null;
                  }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 24 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => openChat(item.username)} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, gap: 12 }}>
                      {avatar(item)}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: "700" }}>{item.displayName || item.username}</Text>
                        <Text style={{ color: C.muted, marginTop: 3 }}>@{item.username}</Text>
                      </View>
                      <Ionicons name="chatbubble-outline" size={21} color={C.blue} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<View style={{ padding: 30, alignItems: "center" }}>{busy ? <ActivityIndicator color={C.blue} /> : <Text style={{ color: C.muted }}>{conversations.some((item) => [getUsername(item), item.displayName, item.lastMessage, item.last_message].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())) ? "Aur koi user nahi mila." : "Koi chat ya user nahi mila."}</Text>}</View>}
                />
              ) : (
                <FlatList
                  data={inboxTab === "All"
                    ? conversations
                    : inboxTab === "Requests"
                      ? conversations.filter((x) => x.isRequest || x.is_request || x.requestStatus === "pending" || x.request_status === "pending" || x.requestStatus === "requested" || x.request_status === "requested")
                      : conversations.filter((x) => inboxTab === "Primary" ? ["", "primary"].includes(String(x.folder || x.category || x.inboxType || x.inbox_type || "primary").toLowerCase()) : String(x.folder || x.category || x.inboxType || x.inbox_type || "").toLowerCase() === inboxTab.toLowerCase())}
                  keyExtractor={(x, i) => String(getUsername(x) || i)}
                  refreshing={busy}
                  onRefresh={refreshInbox}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
                  renderItem={({ item }) => (
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: horizontalInset, paddingVertical: 8, gap: compactScreen ? 9 : 12, minHeight: compactScreen ? 66 : 72 }}>
                      <TouchableOpacity onPress={() => openChat(getUsername(item))} activeOpacity={0.75} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: compactScreen ? 9 : 12 }}>
                        {avatar(item, rowAvatarSize)}
                        <View style={{ flex: 1, minHeight: 56, justifyContent: "center", borderBottomWidth: 0.5, borderBottomColor: C.line }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: Number(item.unreadCount || item.unread_count) > 0 ? "800" : "600", fontSize: 14 }}>{item.displayName || getUsername(item)}</Text>
                            <Text numberOfLines={1} style={{ color: C.muted, fontSize: 10 }}>{item.lastMessageAt || item.updatedAt || ""}</Text>
                          </View>
                          <Text numberOfLines={1} style={{ color: C.muted, marginTop: 5, fontSize: 12, fontWeight: Number(item.unreadCount || item.unread_count) > 0 ? "700" : "400" }}>{item.lastMessage || item.last_message || "Tap to chat"}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={async () => { await openChat(getUsername(item)); await takePhoto(); }} accessibilityRole="button" accessibilityLabel={"Send a camera photo to " + getUsername(item)} style={{ width: 38, height: 48, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="camera-outline" size={25} color={C.text} />
                      </TouchableOpacity>
                      {Number(item.unreadCount || item.unread_count) > 0 ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue, marginLeft: 1 }} /> : null}
                    </View>
                  )}
                  ListEmptyComponent={<View style={{ flex: 1, padding: 34, alignItems: "center", justifyContent: "center" }}>{busy ? <ActivityIndicator color={C.blue} /> : <><Ionicons name={inboxTab === "Requests" ? "mail-open-outline" : "chatbubbles-outline"} size={42} color="#8E8E8E" /><Text style={{ color: C.muted, textAlign: "center", marginTop: 12 }}>{inboxTab === "Requests" ? "No message requests yet." : inboxTab === "Primary" ? "Abhi koi chat nahi hai. Search karke naya message shuru karein." : "Is tab mein abhi koi chat nahi hai."}</Text></>}</View>}
                />
              )}
              <View style={{ height: 64, paddingBottom: 4, borderTopWidth: 0.5, borderTopColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: C.bg }}>
                {[
                  { tab: "Home", icon: "home-outline" },
                  { tab: "Reels", icon: "play-circle-outline" },
                  { tab: "Chat", icon: "paper-plane" },
                  { tab: "Search", icon: "search-outline" },
                  { tab: "Profile", icon: "person-circle-outline" },
                ].map((item) => (
                  <TouchableOpacity key={item.tab} onPress={() => onNavigateTab?.(item.tab)} accessibilityRole="button" accessibilityLabel={item.tab} style={{ width: 52, height: 48, alignItems: "center", justifyContent: "center", transform: [{ translateY: -30 }] }}>
                    {item.tab === "Profile" && ownAvatarUrl ? (
                      <Image source={{ uri: avatarUri(ownAvatarUrl) }} style={{ width: 27, height: 27, borderRadius: 14 }} />
                    ) : (
                      <Ionicons name={item.icon} size={27} color={C.text} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, minHeight: 0 }}>
              <FlatList
                ref={listRef}
                style={{ flex: 1 }}
                data={messages}
                keyExtractor={(m, i) => String(m.id || m.messageId || i)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 18, flexGrow: 1, justifyContent: "flex-end" }}
                onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
                renderItem={({ item }) => {
                  const mine = getSender(item) === String(authSession?.username || "").toLowerCase();
                  const body = getMessageText(item);
                  const attachmentUrl = item.attachmentUrl || item.attachment_url || item.imageUrl || item.image_url;
                  const attachmentName = item.attachmentName || item.attachment_name || "Open attachment";
                  const attachmentType = item.attachmentType || item.attachment_type;
                  const messageAvatar = mine
                    ? { username: authSession?.username || "You", avatarUrl: ownAvatarUrl }
                    : { username: item.sender || peer, avatarUrl: item.senderAvatarUrl || item.sender_avatar_url || peerDetails?.avatarUrl };
                  return (
                    <View style={{ width: "100%", flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end", justifyContent: mine ? "flex-start" : "flex-start", gap: 7, marginVertical: 3 }}>
                      {avatar(messageAvatar, 27)}
                      <View style={{ maxWidth: "82%", minWidth: body || attachmentUrl ? 0 : 90, backgroundColor: mine ? C.mine : C.other, borderTopLeftRadius: 19, borderTopRightRadius: 19, borderBottomLeftRadius: mine ? 19 : 5, borderBottomRightRadius: mine ? 5 : 19, paddingHorizontal: 14, paddingVertical: 9 }}>
                      {attachmentUrl ? (
                        <TouchableOpacity onPress={() => Linking.openURL(avatarUri(attachmentUrl))} style={{ marginBottom: body ? 7 : 0, flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <Ionicons name={String(attachmentType).toLowerCase() === "image" ? "image-outline" : "document-outline"} size={22} color={C.text} />
                          <Text numberOfLines={2} style={{ color: C.text, textDecorationLine: "underline", flexShrink: 1 }}>{attachmentName}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {!!body && <Text style={{ color: C.text, fontSize: 15 * textScale, lineHeight: 21 * textScale }}>{body}</Text>}
                      <Text style={{ color: "#737373", fontSize: 9, textAlign: "right", marginTop: 4 }}>
                        {item.createdAt || item.created_at ? new Date(item.createdAt || item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={<View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 25 }}>{busy ? <ActivityIndicator color={C.blue} /> : <><Ionicons name="chatbubble-ellipses-outline" size={38} color="#555" /><Text style={{ color: C.muted, marginTop: 10 }}>Yeh chat shuru karein.</Text></>}</View>}
              />

              <View style={{ flexShrink: 0, borderTopWidth: 0.5, borderTopColor: C.line, paddingHorizontal: compactScreen ? 7 : 10, paddingTop: 8, paddingBottom: Platform.OS === "android" ? 22 : 12, minHeight: 68, backgroundColor: C.bg }}>
                {emojiPickerOpen ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 9, marginBottom: 7, borderRadius: 14, backgroundColor: C.panel }}>
                    {["😀","😂","🥰","😍","😭","🔥","❤️","👍"].map((emoji) => (
                      <TouchableOpacity key={emoji} onPress={() => setDraft((value) => value + emoji)} accessibilityRole="button" accessibilityLabel={"Add " + emoji}>
                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {attachment ? (
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 7 }}>
                    <Ionicons name="document-attach-outline" size={18} color={C.blue} />
                    <Text numberOfLines={1} style={{ flex: 1, color: "#1877F2", marginLeft: 7 }}>{attachment.attachmentName || attachment.name || "File attached"}</Text>
                    <TouchableOpacity onPress={() => setAttachment(null)}><Ionicons name="close-circle" size={20} color={C.muted} /></TouchableOpacity>
                  </View>
                ) : null}
                <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: compactScreen ? 6 : 9 }}>
                  <TouchableOpacity onPress={takePhoto} disabled={sending} style={{ width: compactScreen ? 40 : 44, height: compactScreen ? 40 : 44, borderRadius: 24, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", opacity: sending ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel="Take photo">
                    <Ionicons name="camera" size={23} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", alignItems: "center", backgroundColor: C.field, borderRadius: 26, paddingLeft: compactScreen ? 10 : 13, paddingRight: 7 }}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Message..."
                      placeholderTextColor={C.muted}
                      multiline
                      blurOnSubmit={false}
                      textAlignVertical="center"
                      style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: 108, color: C.text, backgroundColor: "transparent", paddingVertical: 9, paddingRight: 5, fontSize: (compactScreen ? 14 : 15) * textScale }}
                    />
                    <TouchableOpacity onPress={() => setEmojiPickerOpen((value) => !value)} accessibilityRole="button" accessibilityLabel="Open emoji picker" style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
                      <Ionicons name="happy-outline" size={compactScreen ? 21 : 23} color={emojiPickerOpen ? C.blue : C.text} />
                    </TouchableOpacity>
                    {(draft.trim() || attachment) ? (
                      <TouchableOpacity onPress={send} disabled={(!draft.trim() && !attachment) || sending} style={{ paddingHorizontal: 3, paddingVertical: 7 }} accessibilityRole="button" accessibilityLabel="Send message">
                        {sending ? <ActivityIndicator color={C.blue} /> : <Ionicons name="arrow-up-circle" size={29} color={C.blue} />}
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity onPress={pickPhoto} disabled={sending} accessibilityRole="button" accessibilityLabel="Choose photo from gallery" style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
                          <Ionicons name="image-outline" size={composerIconSize} color={C.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={pickAttachment} disabled={sending} accessibilityRole="button" accessibilityLabel="Add attachment" style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
                          <Ionicons name="add-circle-outline" size={25} color={C.text} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  <TouchableOpacity onPress={isVoiceRecording ? stopAndSendVoiceRecording : startVoiceRecording} disabled={sending} accessibilityRole="button" accessibilityLabel={isVoiceRecording ? "Stop and send voice message" : "Record voice message"} style={{ width: 38, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: isVoiceRecording ? C.danger : "transparent", opacity: sending ? 0.5 : 1 }}>
                    {isVoiceRecording ? <Ionicons name="stop" size={composerIconSize + 1} color="#FFFFFF" /> : <Ionicons name="mic-outline" size={composerIconSize + 1} color={C.blue} />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <Modal visible={noteComposerOpen} transparent animationType="fade" onRequestClose={() => setNoteComposerOpen(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center", paddingHorizontal: 22 }}>
              <View style={{ backgroundColor: C.panel, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>Your note</Text>
                  <TouchableOpacity onPress={() => setNoteComposerOpen(false)}><Ionicons name="close" size={23} color={C.text} /></TouchableOpacity>
                </View>
                <TextInput value={noteText} onChangeText={setNoteText} placeholder="Share a thought…" placeholderTextColor={C.muted} maxLength={60} multiline style={{ minHeight: 76, maxHeight: 110, color: C.text, backgroundColor: C.field, borderRadius: 12, padding: 12, textAlignVertical: "top" }} />
                <Text style={{ color: C.muted, fontSize: 10, textAlign: "right", marginTop: 4 }}>{noteText.length}/60</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, marginBottom: 7 }}>
                  <Ionicons name="musical-notes-outline" size={19} color={C.blue} />
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>Add a song</Text>
                </View>
                <TextInput value={songTitle} onChangeText={setSongTitle} placeholder="Song title" placeholderTextColor={C.muted} style={{ color: C.text, backgroundColor: C.field, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }} />
                <TextInput value={songUrl} onChangeText={setSongUrl} placeholder="Paste song link (https://…)" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="url" style={{ color: C.text, backgroundColor: C.field, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }} />
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 6 }}>Notes 24 ghante baad status ki tarah expire ho jayega.</Text>
                <TouchableOpacity disabled={noteSaving || (!noteText.trim() && !songUrl.trim())} onPress={async () => {
                  setNoteSaving(true);
                  try {
                    const saved = await saveUserNote(noteText.trim(), songUrl.trim() ? { url: songUrl.trim(), title: songTitle.trim() || "Song", artist: "" } : null);
                    setOwnNote(saved.note || { text: noteText.trim(), audioUrl: songUrl.trim() || null, audioTitle: songTitle.trim() || null, username: authSession?.username });
                    setNoteComposerOpen(false);
                  } catch (e) { setError(e?.message || "Note save nahi hua."); }
                  finally { setNoteSaving(false); }
                }} style={{ marginTop: 15, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, alignItems: "center", opacity: noteSaving || (!noteText.trim() && !songUrl.trim()) ? 0.5 : 1 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{noteSaving ? "Saving…" : "Share note"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
          <Modal visible={!!noteViewer} transparent animationType="fade" onRequestClose={() => setNoteViewer(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => setNoteViewer(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center", paddingHorizontal: 24 }}>
              <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: "100%", maxWidth: 330, alignSelf: "center", backgroundColor: C.panel, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 }}>
                  {avatar({ username: noteViewer?.username, displayName: noteViewer?.displayName, avatarUrl: noteViewer?.avatarUrl }, 46)}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{noteViewer?.displayName || noteViewer?.username || "Note"}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Note · expires after 24 hours</Text>
                  </View>
                  <TouchableOpacity onPress={() => setNoteViewer(null)} accessibilityRole="button" accessibilityLabel="Close note">
                    <Ionicons name="close" size={22} color={C.text} />
                  </TouchableOpacity>
                </View>
                {!!noteViewer?.text && <Text style={{ color: C.text, fontSize: 17, lineHeight: 25 }}>{noteViewer.text}</Text>}
                {noteViewer?.audioUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(noteViewer.audioUrl).catch(() => setError("Song link could not be opened."))} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: C.field }}>
                    <Ionicons name="play-circle" size={28} color={C.blue} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: C.text, fontWeight: "700" }}>{noteViewer.audioTitle || "Play song"}</Text>
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Tap to open song</Text>
                    </View>
                    <Ionicons name="open-outline" size={17} color={C.muted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
          <Modal visible={profileInfoOpen && !!peer} transparent animationType="fade" onRequestClose={() => setProfileInfoOpen(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => setProfileInfoOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.38)", justifyContent: "flex-end" }}>
              <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 34, alignItems: "center", borderTopWidth: 1, borderColor: C.line }}>
                {avatar(peerDetails, 82)}
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginTop: 12 }}>{peerDetails?.displayName || peer}</Text>
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>@{peer}</Text>
                <View style={{ width: "100%", height: 1, backgroundColor: C.line, marginVertical: 20 }} />
                <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-around" }}>
                  <TouchableOpacity onPress={() => { setProfileInfoOpen(false); onOpenProfile?.(peer); }} accessibilityRole="button" accessibilityLabel={"Open profile for " + peer} style={{ alignItems: "center", gap: 7 }}><Ionicons name="person-circle-outline" size={25} color={C.text} /><Text style={{ color: C.text, fontSize: 12 }}>Profile</Text></TouchableOpacity>
                  <View style={{ alignItems: "center", gap: 7 }}><Ionicons name="notifications-outline" size={25} color={C.text} /><Text style={{ color: C.text, fontSize: 12 }}>Mute</Text></View>
                  <View style={{ alignItems: "center", gap: 7 }}><Ionicons name="ban-outline" size={25} color={C.text} /><Text style={{ color: C.text, fontSize: 12 }}>Block</Text></View>
                </View>
                <TouchableOpacity onPress={() => setProfileInfoOpen(false)} style={{ marginTop: 24, paddingVertical: 12, width: "100%", borderRadius: 12, backgroundColor: C.field, alignItems: "center" }}>
                  <Text style={{ color: C.text, fontWeight: "700" }}>Close</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
          {!!error && (
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#FFF1F0", borderTopWidth: 1, borderTopColor: "#F4C7C3" }}>
              <Text style={{ color: C.danger, fontSize: 12 }}>{error}</Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
