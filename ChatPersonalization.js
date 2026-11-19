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
  { key: "rose", name: "Royal Rose", icon: "heart", bg: "#1B0B16", mine: "#63304A", other: "#321A29", accent: "#F0A0C0" },
  { key: "emerald", name: "Emerald", icon: "leaf", bg: "#071710", mine: "#1D513A", other: "#153324", accent: "#7AD6A4" },
  { key: "sunset", name: "Sunset", icon: "sunny", bg: "#1C100A", mine: "#75402B", other: "#382319", accent: "#FFB078" },
  { key: "sapphire", name: "Sapphire Crown", icon: "diamond", bg: "#07122B", mine: "#173B78", other: "#10264D", accent: "#75A7FF" },
  { key: "ruby", name: "Ruby Velvet", icon: "heart", bg: "#250914", mine: "#7D1F42", other: "#4A142B", accent: "#FF719D" },
  { key: "amethyst", name: "Amethyst", icon: "diamond", bg: "#170D2C", mine: "#54358B", other: "#30204D", accent: "#C6A1FF" },
  { key: "silver", name: "Silver Mist", icon: "cloud", bg: "#171A22", mine: "#414958", other: "#292F3B", accent: "#D7E0EE" },
  { key: "pearl", name: "Pearl White", icon: "sunny", bg: "#29252A", mine: "#665B61", other: "#413A40", accent: "#FFE4C7" },
  { key: "lavender", name: "Lavender Dream", icon: "flower", bg: "#1B1230", mine: "#59427D", other: "#34254D", accent: "#D7B8FF" },
  { key: "cotton", name: "Cotton Candy", icon: "ice-cream", bg: "#24102C", mine: "#7D3D76", other: "#4B2850", accent: "#FFA9E7" },
  { key: "coral", name: "Coral Reef", icon: "fish", bg: "#21100D", mine: "#874536", other: "#4D2A23", accent: "#FFAA91" },
  { key: "mint", name: "Mint Fresh", icon: "leaf", bg: "#071E1A", mine: "#1E6655", other: "#164437", accent: "#8CE6C5" },
  { key: "forest", name: "Forest Night", icon: "leaf", bg: "#07170E", mine: "#205234", other: "#153A25", accent: "#8BD69A" },
  { key: "sakura", name: "Sakura Blossom", icon: "flower", bg: "#260F20", mine: "#77365F", other: "#4A2540", accent: "#FFB8DB" },
  { key: "cherry", name: "Cherry Pop", icon: "heart", bg: "#250A12", mine: "#8E1D3D", other: "#53152A", accent: "#FF7898" },
  { key: "lavaglow", name: "Lava Glow", icon: "flame", bg: "#210B07", mine: "#8E321A", other: "#542113", accent: "#FF9B5D" },
  { key: "arctic", name: "Arctic Ice", icon: "snow", bg: "#081B29", mine: "#24536D", other: "#17394D", accent: "#8EE5FF" },
  { key: "galaxy", name: "Galaxy Nebula", icon: "planet", bg: "#100A28", mine: "#45317F", other: "#291D50", accent: "#B9A3FF" },
  { key: "cosmic", name: "Cosmic Purple", icon: "sparkles", bg: "#180A2B", mine: "#6A2685", other: "#401C56", accent: "#E2A4FF" },
  { key: "aurora", name: "Aurora Lights", icon: "moon", bg: "#071C22", mine: "#17636A", other: "#12434C", accent: "#80F0DE" },
  { key: "desert", name: "Desert Dune", icon: "sunny", bg: "#21170D", mine: "#75502B", other: "#49351F", accent: "#EBC58B" },
  { key: "saffron", name: "Saffron Glow", icon: "sunny", bg: "#251505", mine: "#8B5416", other: "#54350F", accent: "#FFD078" },
  { key: "lotus", name: "Lotus Temple", icon: "flower", bg: "#200F20", mine: "#75406D", other: "#482B46", accent: "#F5B8E8" },
  { key: "diya", name: "Diwali Diya", icon: "flame", bg: "#241004", mine: "#9B4D12", other: "#5A2D0B", accent: "#FFC46B" },
  { key: "vrindavan", name: "Vrindavan", icon: "flower", bg: "#17102A", mine: "#563C85", other: "#342650", accent: "#D6B7FF" },
  { key: "shiva", name: "Shiv Shakti", icon: "moon", bg: "#081B2D", mine: "#245C83", other: "#173B56", accent: "#91D8FF" },
  { key: "ganesha", name: "Ganesh Blessing", icon: "sparkles", bg: "#24140A", mine: "#8B4E1D", other: "#553315", accent: "#FFD18A" },
  { key: "hanuman", name: "Kesari", icon: "flame", bg: "#260D06", mine: "#9A3218", other: "#5B2111", accent: "#FF9A62" },
  { key: "krishna", name: "Peacock Feather", icon: "leaf", bg: "#071E24", mine: "#14616A", other: "#10444C", accent: "#83E9D8" },
  { key: "ram", name: "Ayodhya Gold", icon: "sunny", bg: "#201405", mine: "#85601A", other: "#4F3A12", accent: "#FFDA85" },
  { key: "islamic", name: "Crescent Night", icon: "moon", bg: "#08182A", mine: "#1B416B", other: "#122D4C", accent: "#A9D4FF" },
  { key: "christian", name: "Heavenly Light", icon: "star", bg: "#17152A", mine: "#49477A", other: "#2F3057", accent: "#E5D7FF" },
  { key: "buddha", name: "Zen Serenity", icon: "flower", bg: "#10201C", mine: "#416B55", other: "#2A493A", accent: "#B8E6C5" },
  { key: "jain", name: "Ahimsa Peace", icon: "leaf", bg: "#1E1A0D", mine: "#75652D", other: "#4A411F", accent: "#E7D99B" },
  { key: "rainbow", name: "Rainbow Pop", icon: "color-palette", bg: "#1D1026", mine: "#754C8C", other: "#4A315B", accent: "#F4B8FF" },
  { key: "neon", name: "Neon Pulse", icon: "flash", bg: "#080F1E", mine: "#124C65", other: "#0D3046", accent: "#5CF0FF" },
  { key: "cyber", name: "Cyberpunk", icon: "hardware-chip", bg: "#16091D", mine: "#67245F", other: "#3E1940", accent: "#FF83D8" },
  { key: "comic", name: "Comic Pop", icon: "happy", bg: "#21100B", mine: "#8A3C20", other: "#512819", accent: "#FFB47E" },
  { key: "cartoon", name: "Cartoon Party", icon: "happy", bg: "#1A1030", mine: "#6447A0", other: "#3B2B62", accent: "#FFE27A" },
  { key: "anime", name: "Anime Sky", icon: "star", bg: "#0B1830", mine: "#285B94", other: "#1B3C64", accent: "#A8D7FF" },
  { key: "unicorn", name: "Unicorn Magic", icon: "sparkles", bg: "#21112D", mine: "#754B91", other: "#4C315F", accent: "#F8C6FF" },
  { key: "teddy", name: "Teddy Bear", icon: "paw", bg: "#25170F", mine: "#77523A", other: "#4B3829", accent: "#E7BE91" },
  { key: "oceanwave", name: "Ocean Wave", icon: "water", bg: "#061C2A", mine: "#17617B", other: "#104255", accent: "#7EDCFF" },
  { key: "monsoon", name: "Monsoon Rain", icon: "cloud-rain", bg: "#101A2B", mine: "#354C70", other: "#253650", accent: "#A9C8F5" },
  { key: "autumn", name: "Autumn Leaves", icon: "leaf", bg: "#211006", mine: "#81451C", other: "#4D2C16", accent: "#F5B16B" },
  { key: "winter", name: "Winter Frost", icon: "snow", bg: "#101D2A", mine: "#45647C", other: "#2B4559", accent: "#C7E8FF" },
  { key: "coffee", name: "Coffee House", icon: "cafe", bg: "#1B120D", mine: "#65432E", other: "#3E2C20", accent: "#D9B18A" },
  { key: "marble", name: "Royal Marble", icon: "diamond", bg: "#17171C", mine: "#55515A", other: "#34323A", accent: "#E5D9C9" },
  { key: "velvet", name: "Velvet Noir", icon: "moon", bg: "#100C14", mine: "#45304D", other: "#2B2032", accent: "#D6A7E8" },
  { key: "floral", name: "Floral Garden", icon: "flower", bg: "#102016", mine: "#3E704B", other: "#284B33", accent: "#B3E6A8" },
  { key: "candy", name: "Candy Land", icon: "ice-cream", bg: "#241029", mine: "#7A3D83", other: "#4B2B55", accent: "#FFA8EA" },
  { key: "sports", name: "Stadium Lights", icon: "trophy", bg: "#101820", mine: "#34566D", other: "#223D50", accent: "#A5E1FF" },
  { key: "minimal", name: "Minimal Graphite", icon: "ellipse", bg: "#12151A", mine: "#3A424D", other: "#252C35", accent: "#D1D8E0" },
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
      const loaded = {
        name: String(prefs[keyFor("chatName", username)] || ""),
        theme: String(prefs[keyFor("chatTheme", username)] || "royal"),
        favorite: !!prefs[keyFor("favorite", username)],
        closeFriend: !!prefs[keyFor("closeFriend", username)],
      };
      setName(loaded.name);
      setTheme(loaded.theme);
      setFavorite(loaded.favorite);
      setCloseFriend(loaded.closeFriend);
      onSaved?.(loaded);
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
