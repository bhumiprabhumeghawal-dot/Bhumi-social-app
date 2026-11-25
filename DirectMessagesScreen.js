import React from "react";
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, ScrollView,
  Platform, SafeAreaView, Text, TextInput, TouchableOpacity, View, Linking,
  Keyboard, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import VoiceVideoCallControls from "./VoiceVideoCallControls";
import {
  loadMessageConversations, loadDirectMessages, sendDirectMessage, searchUsers, uploadChatAttachment,
} from "./api";

const API_ORIGIN = "https://bhumi-social-app-1.onrender.com";
const C = {
  bg: "#000000", panel: "#0B0B0B", field: "#262626", line: "#242424",
  text: "#FFFFFF", muted: "#A8A8A8", blue: "#3797F0", mine: "#3797F0",
  other: "#262626", danger: "#FF7777",
};
const avatarUri = (value) => {
  if (!value) return null;
  const uri = String(value);
  return uri.startsWith("http") ? uri : API_ORIGIN + (uri.startsWith("/") ? "" : "/") + uri;
};
const getUsername = (item) => String(item?.username || item?.peerUsername || item?.otherUsername || "").trim();
const getMessageText = (item) => String(item?.text || item?.message || "");
const getSender = (item) => String(item?.sender || item?.senderUsername || item?.fromUsername || item?.username || "").toLowerCase();

export default function DirectMessagesScreen({
  visible, onClose, authSession, initialUsername = "", onSelectedChatUserChange,
}) {
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  // Logical dp dimensions adapt to rotation, split-screen and different phones.
  const compactScreen = windowWidth < 360;
  const shortScreen = windowHeight < 680;
  const narrowScreen = windowWidth < 340;
  const horizontalInset = narrowScreen ? 10 : compactScreen ? 12 : 16;
  const rowAvatarSize = narrowScreen ? 46 : compactScreen ? 50 : 56;
  const storyAvatarSize = narrowScreen ? 54 : compactScreen ? 58 : 62;
  const storyRowGap = narrowScreen ? 9 : compactScreen ? 12 : 17;
  const composerIconSize = narrowScreen ? 20 : compactScreen ? 21 : 23;
  const textScale = Math.min(Math.max(fontScale || 1, 0.9), 1.25);
  const [conversations, setConversations] = React.useState([]);
  const [peer, setPeer] = React.useState("");
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [people, setPeople] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [attachment, setAttachment] = React.useState(null);
  const [error, setError] = React.useState("");
  const [profileInfoOpen, setProfileInfoOpen] = React.useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [inboxTab, setInboxTab] = React.useState("Primary");
  const listRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const peerRef = React.useRef("");
  const requestRef = React.useRef(0);

  const refreshInbox = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const rows = await loadMessageConversations();
      setConversations(Array.isArray(rows) ? rows : []);
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
      setInboxTab("Primary");
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
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#303039", alignItems: "center", justifyContent: "center" }}>
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ minHeight: shortScreen ? 54 : 58, paddingHorizontal: horizontalInset, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: C.line }}>
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
                    <Ionicons name="information-circle-outline" size={24} color={C.text} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.4 }}>{authSession?.username || "Messages"}</Text>
                    <Ionicons name="chevron-down" size={16} color={C.text} />
                  </View>
                </View>
                <TouchableOpacity onPress={() => {
                  setQuery("");
                  setPeople([]);
                  requestAnimationFrame(() => searchInputRef.current?.focus?.());
                }} style={{ width: 46, height: 48, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="New message">
                  <Ionicons name="create-outline" size={27} color={C.text} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {!peer ? (
            <View style={{ flex: 1, minHeight: 0 }}>
              {!query.trim() ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: horizontalInset, paddingTop: shortScreen ? 8 : 13, paddingBottom: shortScreen ? 8 : 12, gap: storyRowGap }}>
                    <View style={{ width: storyAvatarSize + 4, alignItems: "center" }}>
                      <View style={{ width: storyAvatarSize, height: storyAvatarSize, borderRadius: storyAvatarSize / 2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
                        {avatar({ username: authSession?.username || "You" }, 56)}
                        <View style={{ position: "absolute", right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, backgroundColor: C.field, borderWidth: 2, borderColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="add" size={15} color={C.text} />
                        </View>
                      </View>
                      <Text numberOfLines={1} style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Your note</Text>
                    </View>
                    {conversations.slice(0, 12).map((item, index) => (
                      <TouchableOpacity key={String(getUsername(item) || index)} onPress={() => openChat(getUsername(item))} style={{ width: 66, alignItems: "center" }}>
                        <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.muted, alignItems: "center", justifyContent: "center" }}>
                          {avatar(item, rowAvatarSize)}
                        </View>
                        <Text numberOfLines={1} style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>{getUsername(item)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={{ paddingHorizontal: 16, paddingTop: 5, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: "800" }}>Messages</Text>
                    <TouchableOpacity onPress={() => setInboxTab("Requests")} accessibilityRole="button">
                      <Text style={{ color: C.blue, fontSize: 13, fontWeight: "700" }}>Requests</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
              <View style={{ marginHorizontal: horizontalInset, marginTop: query.trim() ? 13 : 0, marginBottom: 10, height: 42, borderRadius: 11, backgroundColor: C.field, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 }}>
                <Ionicons name="search" size={19} color={C.muted} />
                <TextInput
                  ref={searchInputRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={{ flex: 1, color: C.text, paddingHorizontal: 10, height: 46 }}
                />
                {!!query && <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={C.muted} /></TouchableOpacity>}
              </View>
              {!query.trim() ? (
                <View style={{ paddingHorizontal: horizontalInset, paddingBottom: 9, flexDirection: "row", alignItems: "center", gap: compactScreen ? 17 : 23, borderBottomWidth: 0.5, borderBottomColor: C.line }}>
                  {["All", "Primary", "General"].map((tab) => (
                    <TouchableOpacity key={tab} onPress={() => setInboxTab(tab)} accessibilityRole="button" accessibilityLabel={tab + " messages"} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: inboxTab === tab ? "#FFFFFF" : C.field, minHeight: 38, justifyContent: "center" }}>
                      <Text style={{ color: inboxTab === tab ? "#111111" : C.text, fontSize: 13 * textScale, fontWeight: "700" }}>{tab}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ flex: 1 }} />
                </View>
              ) : null}
              {query.trim().length >= 2 ? (
                <FlatList
                  data={people}
                  keyExtractor={(x, i) => String(x.username || i)}
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
                  ListEmptyComponent={<View style={{ padding: 30, alignItems: "center" }}>{busy ? <ActivityIndicator color={C.blue} /> : <Text style={{ color: C.muted }}>Koi user nahi mila.</Text>}</View>}
                />
              ) : (
                <FlatList
                  data={inboxTab === "All"
                    ? conversations.filter((x) => !(x.isRequest || x.is_request || x.requestStatus === "pending" || x.request_status === "pending" || x.requestStatus === "requested" || x.request_status === "requested"))
                    : inboxTab === "Requests"
                      ? conversations.filter((x) => x.isRequest || x.is_request || x.requestStatus === "pending" || x.request_status === "pending" || x.requestStatus === "requested" || x.request_status === "requested")
                      : conversations.filter((x) => inboxTab === "Primary" ? ["", "primary"].includes(String(x.folder || x.category || x.inboxType || x.inbox_type || "primary").toLowerCase()) : String(x.folder || x.category || x.inboxType || x.inbox_type || "").toLowerCase() === inboxTab.toLowerCase())}
                  keyExtractor={(x, i) => String(getUsername(x) || i)}
                  refreshing={busy}
                  onRefresh={refreshInbox}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => openChat(getUsername(item))} activeOpacity={0.75} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: horizontalInset, paddingVertical: 8, gap: compactScreen ? 9 : 12, minHeight: compactScreen ? 66 : 72 }}>
                      {avatar(item, rowAvatarSize)}
                      <View style={{ flex: 1, minHeight: 56, justifyContent: "center", borderBottomWidth: 0.5, borderBottomColor: C.line }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: Number(item.unreadCount || item.unread_count) > 0 ? "800" : "600", fontSize: 14 }}>{item.displayName || getUsername(item)}</Text>
                          <Text numberOfLines={1} style={{ color: C.muted, fontSize: 10 }}>{item.lastMessageAt || item.updatedAt || ""}</Text>
                        </View>
                        <Text numberOfLines={1} style={{ color: C.muted, marginTop: 5, fontSize: 12, fontWeight: Number(item.unreadCount || item.unread_count) > 0 ? "700" : "400" }}>{item.lastMessage || item.last_message || "Tap to chat"}</Text>
                      </View>
                      {Number(item.unreadCount || item.unread_count) > 0 ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue, marginLeft: 1 }} /> : null}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<View style={{ flex: 1, padding: 34, alignItems: "center", justifyContent: "center" }}>{busy ? <ActivityIndicator color={C.blue} /> : <><Ionicons name={inboxTab === "Requests" ? "mail-open-outline" : "chatbubbles-outline"} size={42} color="#555" /><Text style={{ color: C.muted, textAlign: "center", marginTop: 12 }}>{inboxTab === "Requests" ? "No message requests yet." : inboxTab === "Primary" ? "Abhi koi chat nahi hai. Search karke naya message shuru karein." : "Is tab mein abhi koi chat nahi hai."}</Text></>}</View>}
                />
              )}
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
                  return (
                    <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", minWidth: body || attachmentUrl ? 0 : 90, backgroundColor: mine ? C.mine : C.other, borderTopLeftRadius: 19, borderTopRightRadius: 19, borderBottomLeftRadius: mine ? 19 : 5, borderBottomRightRadius: mine ? 5 : 19, paddingHorizontal: 14, paddingVertical: 9, marginVertical: 3 }}>
                      {attachmentUrl ? (
                        <TouchableOpacity onPress={() => Linking.openURL(avatarUri(attachmentUrl))} style={{ marginBottom: body ? 7 : 0, flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <Ionicons name={String(attachmentType).toLowerCase() === "image" ? "image-outline" : "document-outline"} size={22} color={C.text} />
                          <Text numberOfLines={2} style={{ color: C.text, textDecorationLine: "underline", flexShrink: 1 }}>{attachmentName}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {!!body && <Text style={{ color: C.text, fontSize: 15 * textScale, lineHeight: 21 * textScale }}>{body}</Text>}
                      <Text style={{ color: "#C1CED8", fontSize: 9, textAlign: "right", marginTop: 4 }}>
                        {item.createdAt || item.created_at ? new Date(item.createdAt || item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={<View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 25 }}>{busy ? <ActivityIndicator color={C.blue} /> : <><Ionicons name="chatbubble-ellipses-outline" size={38} color="#555" /><Text style={{ color: C.muted, marginTop: 10 }}>Yeh chat shuru karein.</Text></>}</View>}
              />

              <View style={{ flexShrink: 0, borderTopWidth: 0.5, borderTopColor: C.line, paddingHorizontal: compactScreen ? 7 : 10, paddingTop: 8, paddingBottom: Platform.OS === "android" ? 9 : 7, backgroundColor: C.bg }}>
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
                    <Text numberOfLines={1} style={{ flex: 1, color: "#9CCBFF", marginLeft: 7 }}>{attachment.attachmentName || attachment.name || "File attached"}</Text>
                    <TouchableOpacity onPress={() => setAttachment(null)}><Ionicons name="close-circle" size={20} color={C.muted} /></TouchableOpacity>
                  </View>
                ) : null}
                <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: compactScreen ? 4 : 7 }}>
                  <TouchableOpacity onPress={takePhoto} disabled={sending} style={{ width: compactScreen ? 34 : 38, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: "center", justifyContent: "center", opacity: sending ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel="Take photo">
                    <Ionicons name="camera" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Message..."
                    placeholderTextColor={C.muted}
                    multiline
                    blurOnSubmit={false}
                    textAlignVertical="center"
                    style={{ flex: 1, minHeight: 44, maxHeight: 112, color: C.text, backgroundColor: C.field, borderRadius: 24, paddingHorizontal: compactScreen ? 12 : 17, paddingTop: 11, paddingBottom: 10, fontSize: (compactScreen ? 14 : 15) * textScale }}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 3 }}>
                    <TouchableOpacity onPress={pickPhoto} disabled={sending} accessibilityRole="button" accessibilityLabel="Choose photo from gallery" style={{ padding: 2 }}><Ionicons name="image-outline" size={composerIconSize} color={C.text} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => setEmojiPickerOpen((value) => !value)} accessibilityRole="button" accessibilityLabel="Open emoji picker" style={{ padding: 2 }}><Ionicons name="happy-outline" size={compactScreen ? 21 : 23} color={emojiPickerOpen ? C.blue : C.text} /></TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={pickAttachment} disabled={sending} style={{ width: 34, height: 44, alignItems: "center", justifyContent: "center" }} accessibilityRole="button" accessibilityLabel="Add attachment">
                    <Ionicons name="add-circle-outline" size={27} color={C.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={send}
                    disabled={(!draft.trim() && !attachment) || sending}
                    style={{ width: compactScreen ? 36 : 43, height: 44, alignItems: "center", justifyContent: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                  >
                    {sending ? <ActivityIndicator color={C.blue} /> : <Ionicons name="arrow-up-circle" size={30} color={draft.trim() || attachment ? C.blue : "#555"} />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <Modal visible={profileInfoOpen && !!peer} transparent animationType="fade" onRequestClose={() => setProfileInfoOpen(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => setProfileInfoOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.68)", justifyContent: "flex-end" }}>
              <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: "#171717", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 34, alignItems: "center", borderTopWidth: 1, borderColor: C.line }}>
                {avatar(peerDetails, 82)}
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginTop: 12 }}>{peerDetails?.displayName || peer}</Text>
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>@{peer}</Text>
                <View style={{ width: "100%", height: 1, backgroundColor: C.line, marginVertical: 20 }} />
                <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-around" }}>
                  <View style={{ alignItems: "center", gap: 7 }}><Ionicons name="person-circle-outline" size={25} color={C.text} /><Text style={{ color: C.text, fontSize: 12 }}>Profile</Text></View>
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
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#251313", borderTopWidth: 1, borderTopColor: "#492222" }}>
              <Text style={{ color: C.danger, fontSize: 12 }}>{error}</Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
