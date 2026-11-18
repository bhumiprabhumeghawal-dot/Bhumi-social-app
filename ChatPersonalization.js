import React from "react";
import {
  Modal, View, Text, TextInput, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loadSettingsPreferences, saveSettingsPreferences } from "./api";

const GOLD = "#D8B86A";
const THEMES = [
  { key: "royal", name: "Royal Gold", icon: "diamond", bg: "#100B19", mine: "#49345F", other: "#21162F", accent: "#D8B86A" },
  { key: "midnight", name: "Midnight Black", icon: "moon", bg: "#080B12", mine: "#253044", other: "#151B27", accent: "#8FA8D8" },
  { key: "ocean", name: "Ocean Blue", icon: "water", bg: "#071521", mine: "#12415A", other: "#102A3A", accent: "#61C5E8" },
  { key: "rose", name: "Royal Rose", icon: "rose", bg: "#1B0B16", mine: "#63304A", other: "#321A29", accent: "#F0A0C0" },
  { key: "emerald", name: "Emerald", icon: "leaf", bg: "#071710", mine: "#1D513A", other: "#153324", accent: "#7AD6A4" },
  { key: "sunset", name: "Sunset", icon: "sunny", bg: "#1C100A", mine: "#75402B", other: "#382319", accent: "#FFB078" },
];

const keyFor = (kind, username) => `messages.${kind}.${String(username || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")}`;

export default function ChatPersonalization({ visible, username, onClose, onSaved }) {
  const [name, setName] = React.useState("");
  const [theme, setTheme] = React.useState("royal");
  const [favorite, setFavorite] = React.useState(false);
  const [closeFriend, setCloseFriend] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    if (!visible || !username) return () => { alive = false; };
    setBusy(true);
    setError("");
    loadSettingsPreferences().then((prefs) => {
      if (!alive) return;
      setName(String(prefs[keyFor("chatName", username)] || ""));
      setTheme(String(prefs[keyFor("chatTheme", username)] || "royal"));
      setFavorite(!!prefs[keyFor("favorite", username)]);
      setCloseFriend(!!prefs[keyFor("closeFriend", username)]);
    }).catch((e) => {
      if (alive) setError(e?.message || "Chat preferences load नहीं हो सके।");
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [visible, username]);

  const save = async () => {
    if (!username || busy) return;
    setBusy(true);
    setError("");
    try {
      const prefs = await saveSettingsPreferences({
        [keyFor("chatName", username)]: name.trim(),
        [keyFor("chatTheme", username)]: theme,
        [keyFor("favorite", username)]: favorite,
        [keyFor("closeFriend", username)]: closeFriend,
      });
      onSaved?.({
        name: String(prefs[keyFor("chatName", username)] || ""),
        theme: String(prefs[keyFor("chatTheme", username)] || "royal"),
        favorite: !!prefs[keyFor("favorite", username)],
        closeFriend: !!prefs[keyFor("closeFriend", username)],
      });
      onClose?.();
    } catch (e) {
      setError(e?.message || "Changes save नहीं हुए।");
    } finally { setBusy(false); }
  };

  const selected = THEMES.find((item) => item.key === theme) || THEMES[0];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0B0712", paddingTop: 18, paddingBottom: Platform.OS === "android" ? 28 : 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#49345F" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: GOLD, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>BHUMI CHAT STUDIO</Text>
            <Text style={{ color: "#F4EFFA", fontSize: 21, fontWeight: "900", marginTop: 4 }}>Personalize Chat</Text>
            <Text style={{ color: "#B8AACB", fontSize: 12, marginTop: 3 }}>@{username}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#21162F", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={22} color={GOLD} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: "#F4EFFA", fontSize: 14, fontWeight: "800", marginBottom: 9 }}>Your private chat name</Text>
          <TextInput value={name} onChangeText={setName} placeholder={username} placeholderTextColor="#8F829F" maxLength={40}
            style={{ color: "#F4EFFA", backgroundColor: "#171020", borderWidth: 1, borderColor: "#49345F", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 }} />
          <Text style={{ color: "#9E91AC", fontSize: 11, marginTop: 6, marginBottom: 20 }}>यह नाम सिर्फ आपको दिखेगा; दूसरे व्यक्ति का प्रोफाइल नाम नहीं बदलेगा।</Text>

          <Text style={{ color: "#F4EFFA", fontSize: 14, fontWeight: "800", marginBottom: 10 }}>Chat themes</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {THEMES.map((item) => (
              <TouchableOpacity key={item.key} onPress={() => setTheme(item.key)} activeOpacity={0.85}
                style={{ width: "48%", minHeight: 86, borderRadius: 15, padding: 12, backgroundColor: item.bg, borderWidth: theme === item.key ? 2 : 1, borderColor: theme === item.key ? GOLD : "#49345F" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Ionicons name={item.icon} size={20} color={item.accent} />
                  {theme === item.key ? <Ionicons name="checkmark-circle" size={18} color={GOLD} /> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 5, marginTop: 9 }}>
                  <View style={{ height: 7, flex: 1, borderRadius: 5, backgroundColor: item.mine }} />
                  <View style={{ height: 7, flex: 1, borderRadius: 5, backgroundColor: item.other }} />
                </View>
                <Text style={{ color: "#F4EFFA", fontSize: 12, fontWeight: "800", marginTop: 7 }}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ backgroundColor: selected.bg, borderWidth: 1, borderColor: selected.accent, borderRadius: 17, padding: 13, marginBottom: 20 }}>
            <Text style={{ color: selected.accent, fontSize: 10, fontWeight: "900", marginBottom: 9 }}>LIVE THEME PREVIEW</Text>
            <View style={{ alignSelf: "flex-start", backgroundColor: selected.other, borderRadius: 13, padding: 10, marginBottom: 7 }}>
              <Text style={{ color: "#F4EFFA", fontSize: 12 }}>Hey! कैसी हो? ✨</Text>
            </View>
            <View style={{ alignSelf: "flex-end", backgroundColor: selected.mine, borderRadius: 13, padding: 10 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 12 }}>सब बढ़िया! 💜</Text>
            </View>
          </View>

          <View style={{ backgroundColor: "#171020", borderWidth: 1, borderColor: "#49345F", borderRadius: 15, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: "#F4EFFA", fontSize: 14, fontWeight: "900" }}>Favourite Friend</Text>
              <Text style={{ color: "#B8AACB", fontSize: 11, marginTop: 4 }}>इस दोस्त को Favourite में रखें और चैट सूची में प्राथमिकता दें।</Text>
            </View>
            <Switch value={favorite} onValueChange={setFavorite} trackColor={{ false: "#51465E", true: "#7651B5" }} thumbColor={favorite ? GOLD : "#E8E2EF"} />
          </View>
          <View style={{ backgroundColor: "#171020", borderWidth: 1, borderColor: "#49345F", borderRadius: 15, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: "#F4EFFA", fontSize: 14, fontWeight: "900" }}>Close Friend</Text>
              <Text style={{ color: "#B8AACB", fontSize: 11, marginTop: 4 }}>इस दोस्त को अपनी Close Friends सूची में जोड़ें।</Text>
            </View>
            <Switch value={closeFriend} onValueChange={setCloseFriend} trackColor={{ false: "#51465E", true: "#7651B5" }} thumbColor={closeFriend ? GOLD : "#E8E2EF"} />
          </View>
          {error ? <Text style={{ color: "#FF8585", fontSize: 12, marginBottom: 12 }}>{error}</Text> : null}
          <TouchableOpacity disabled={busy} onPress={save} style={{ backgroundColor: GOLD, borderRadius: 14, padding: 15, alignItems: "center", justifyContent: "center", opacity: busy ? 0.65 : 1 }}>
            {busy ? <ActivityIndicator color="#170F20" /> : <Text style={{ color: "#170F20", fontSize: 14, fontWeight: "900" }}>Save Chat Preferences</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
