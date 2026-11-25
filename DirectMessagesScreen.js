import React from "react";
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal,
  Platform, SafeAreaView, Text, TextInput, TouchableOpacity, View, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  loadMessageConversations, loadDirectMessages, sendDirectMessage, searchUsers, uploadChatAttachment,
} from "./api";

const API_ORIGIN = "https://bhumi-social-app-1.onrender.com";
const avatarUri = (value) => !value ? null : String(value).startsWith("http") ? value : API_ORIGIN + value;

export default function DirectMessagesScreen({
  visible, onClose, authSession, initialUsername = "", onSelectedChatUserChange,
}) {
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
  const listRef = React.useRef(null);

  const refreshInbox = React.useCallback(async () => {
    setBusy(true); setError("");
    try { setConversations(await loadMessageConversations()); }
    catch (e) { setError(e?.message || "Inbox load nahi hua."); }
    finally { setBusy(false); }
  }, []);

  const openChat = React.useCallback(async (username) => {
    const target = String(username || "").trim();
    if (!target) return;
    setPeer(target); onSelectedChatUserChange?.(target);
    setMessages([]); setDraft(""); setAttachment(null); setError(""); setBusy(true);
    try { setMessages(await loadDirectMessages(target)); }
    catch (e) { setError(e?.message || "Messages load nahi hue."); }
    finally { setBusy(false); }
  }, [onSelectedChatUserChange]);

  React.useEffect(() => {
    if (!visible) return;
    if (initialUsername) openChat(initialUsername);
    else { setPeer(""); onSelectedChatUserChange?.(""); refreshInbox(); }
  }, [visible, initialUsername, openChat, refreshInbox, onSelectedChatUserChange]);

  React.useEffect(() => {
    if (!visible || peer || query.trim().length < 2) { setPeople([]); return; }
    let live = true;
    const timer = setTimeout(async () => {
      try { const result = await searchUsers(query.trim()); if (live) setPeople(result || []); }
      catch (e) { if (live) setError(e?.message || "Search failed."); }
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [visible, peer, query]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !peer || sending) return;
    setSending(true); setError("");
    try {
      const sent = await sendDirectMessage(peer, text, attachment);
      setMessages((old) => [...old, sent]);
      setDraft(""); setAttachment(null);
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
    } catch (e) { setError(e?.message || "Message send nahi hua."); }
    finally { setSending(false); }
  };

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      setSending(true); setError("");
      const uploaded = await uploadChatAttachment(result.assets[0]);
      setAttachment(uploaded);
    } catch (e) { setError(e?.message || "Attachment upload nahi hua."); }
    finally { setSending(false); }
  };

  const closeChat = () => {
    setPeer(""); onSelectedChatUserChange?.(""); setMessages([]); setDraft(""); setAttachment(null); setError("");
    refreshInbox();
  };

  const avatar = (item, size = 48) => {
    const uri = avatarUri(item?.avatarUrl || item?.profilePicture || item?.avatar);
    return uri
      ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#252525" }} />
      : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#252525", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFF", fontWeight: "800", fontSize: size * .38 }}>{String(item?.displayName || item?.username || peer || "?").slice(0,1).toUpperCase()}</Text></View>;
  };

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => peer ? closeChat() : onClose?.()}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#000" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={{ height: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#222" }}>
            <TouchableOpacity onPress={() => peer ? closeChat() : onClose?.()} style={{ width: 42, height: 44, justifyContent: "center" }}>
              <Ionicons name={peer ? "arrow-back" : "close"} size={25} color="#FFF" />
            </TouchableOpacity>
            {peer ? <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>{avatar(conversations.find(x => String(x.username).toLowerCase() === peer.toLowerCase()), 38)}<View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: "#FFF", fontSize: 16, fontWeight: "800" }}>{conversations.find(x => String(x.username).toLowerCase() === peer.toLowerCase())?.displayName || peer}</Text><Text style={{ color: "#999", fontSize: 11 }}>@{peer}</Text></View><Ionicons name="call-outline" size={23} color="#FFF" /><Ionicons name="videocam-outline" size={25} color="#FFF" /></View>
              : <><Text style={{ flex: 1, color: "#FFF", fontSize: 21, fontWeight: "900" }}>Messages</Text><TouchableOpacity onPress={() => { setQuery(""); setPeer(""); }}><Ionicons name="create-outline" size={27} color="#FFF" /></TouchableOpacity></>}
          </View>

          {!peer ? <View style={{ flex: 1 }}>
            <View style={{ margin: 14, height: 43, borderRadius: 12, backgroundColor: "#1C1C1E", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
              <Ionicons name="search" size={19} color="#888" /><TextInput value={query} onChangeText={setQuery} placeholder="Search people or chats" placeholderTextColor="#888" autoCapitalize="none" style={{ flex: 1, color: "#FFF", paddingHorizontal: 9 }} />
            </View>
            {query.trim().length >= 2 ? <FlatList data={people} keyExtractor={(x,i) => String(x.username || i)} keyboardShouldPersistTaps="handled" renderItem={({item}) => <TouchableOpacity onPress={() => openChat(item.username)} style={{ flexDirection: "row", alignItems: "center", padding: 13, gap: 12 }}>{avatar(item)}<View><Text style={{ color: "#FFF", fontWeight: "700" }}>{item.displayName || item.username}</Text><Text style={{ color: "#999" }}>@{item.username}</Text></View></TouchableOpacity>} /> :
              <FlatList data={conversations} keyExtractor={(x,i) => String(x.username || i)} refreshing={busy} onRefresh={refreshInbox} renderItem={({item}) => <TouchableOpacity onPress={() => openChat(item.username)} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, gap: 12 }}>{avatar(item, 54)}<View style={{ flex: 1, borderBottomWidth: .5, borderBottomColor: "#222", paddingBottom: 12 }}><Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>{item.displayName || item.username}</Text><Text numberOfLines={1} style={{ color: "#999", marginTop: 4 }}>{item.lastMessage || "Start a conversation"}</Text></View>{Number(item.unreadCount) > 0 ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#3797F0" }} /> : null}</TouchableOpacity>} ListEmptyComponent={<View style={{ padding: 35, alignItems: "center" }}>{busy ? <ActivityIndicator color="#3797F0" /> : <Text style={{ color: "#999", textAlign: "center" }}>Abhi koi chat nahi hai. Naya message shuru karne ke liye upar search karein.</Text>}</View>} />}
          </View> : <>
            <FlatList ref={listRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, flexGrow: 1, justifyContent: "flex-end" }} data={messages} keyExtractor={(m,i) => String(m.id || i)} onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })} renderItem={({item}) => {
              const mine = String(item.sender || item.senderUsername || "").toLowerCase() === String(authSession?.username || "").toLowerCase();
              return <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", backgroundColor: mine ? "#164D7A" : "#242424", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, marginVertical: 4 }}>{item.attachmentUrl ? <TouchableOpacity onPress={() => Linking.openURL(avatarUri(item.attachmentUrl))} style={{ marginBottom: item.text || item.message ? 7 : 0 }}><Ionicons name={String(item.attachmentType).toLowerCase() === "image" ? "image-outline" : "document-outline"} size={23} color="#FFF" /><Text style={{ color: "#FFF", textDecorationLine: "underline" }}>{item.attachmentName || "Open attachment"}</Text></TouchableOpacity> : null}<Text style={{ color: "#FFF", fontSize: 15 }}>{item.text || item.message || ""}</Text><Text style={{ color: "#B8C5D0", fontSize: 9, textAlign: "right", marginTop: 4 }}>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""}</Text></View>;
            }} ListEmptyComponent={<View style={{ padding: 30, alignItems: "center" }}>{busy ? <ActivityIndicator color="#3797F0" /> : <Text style={{ color: "#999" }}>Yeh chat shuru karein.</Text>}</View>} />
            <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#222", gap: 8 }}>
              <TouchableOpacity onPress={pickAttachment} disabled={sending} style={{ width: 38, height: 42, alignItems: "center", justifyContent: "center" }}><Ionicons name="add-circle-outline" size={27} color="#3797F0" /></TouchableOpacity>
              {attachment ? <Text numberOfLines={1} style={{ color: "#9CCBFF", maxWidth: 90 }}>{attachment.attachmentName || "File attached"}</Text> : null}<TextInput value={draft} onChangeText={setDraft} placeholder="Message..." placeholderTextColor="#888" multiline style={{ flex: 1, maxHeight: 110, minHeight: 42, color: "#FFF", backgroundColor: "#1C1C1E", borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10 }} />
              <TouchableOpacity onPress={send} disabled={(!draft.trim() && !attachment) || sending} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}>{sending ? <ActivityIndicator color="#3797F0" /> : <Ionicons name="send" size={23} color={draft.trim() || attachment ? "#3797F0" : "#666"} />}</TouchableOpacity>
            </View>
          </>}
          {!!error && <Text style={{ color: "#FF7777", paddingHorizontal: 14, paddingVertical: 7 }}>{error}</Text>}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
