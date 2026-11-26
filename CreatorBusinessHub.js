import React from "react";
import {
  ActivityIndicator, Modal, ScrollView, Text, TextInput,
  TouchableOpacity, View, Linking, Share, useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { translateAppText } from "./localization";
import {
  loadPrivacySettings, savePrivacySettings, loadProfilePosts,
  loadBusinessProfile, saveBusinessProfile, loadBusinessCatalog, loadProfileConnections,
  createBusinessCatalogItem, deleteBusinessCatalogItem
} from "./api";

const GOLD = "#0095F6";
const BG = "#000000";
const PANEL = "#121212";
const BORDER = "#262626";
const TEXT = "#F5F5F5";
const MUTED = "#A8A8A8";
const inputStyle = {
  color: TEXT, backgroundColor: "#0A0A0A", borderColor: BORDER,
  borderWidth: 1, borderRadius: 11, paddingHorizontal: 12,
  paddingVertical: 10, marginTop: 7, fontSize: 13
};

export default function CreatorBusinessHub({ visible, username, onClose, appLanguage = "en", lightAppearance = false }) {
  const BG = lightAppearance ? "#FFFFFF" : "#000000";
  const PANEL = lightAppearance ? "#F5F5F5" : "#121212";
  const BORDER = lightAppearance ? "#E2E2E2" : "#262626";
  const TEXT = lightAppearance ? "#111111" : "#F5F5F5";
  const MUTED = lightAppearance ? "#737373" : "#A8A8A8";
  const hubInputStyle = { ...inputStyle, color: TEXT, backgroundColor: lightAppearance ? "#FFFFFF" : "#0A0A0A", borderColor: BORDER };
  const { width: hubWidth, height: hubHeight, fontScale: hubFontScale } = useWindowDimensions();
  const compact = hubWidth < 360;
  const short = hubHeight < 680;
  const inset = hubWidth < 340 ? 12 : compact ? 14 : Math.min(20, hubWidth * 0.045);
  const textScale = Math.max(0.9, Math.min(1.2, hubFontScale || 1));
  const t = React.useCallback((key) => translateAppText(appLanguage, key), [appLanguage]);
  const [accountType, setAccountType] = React.useState("personal");
  const [tab, setTab] = React.useState("overview");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [posts, setPosts] = React.useState([]);
  const [followerCount, setFollowerCount] = React.useState(0);
  const [followingCount, setFollowingCount] = React.useState(0);
  const [business, setBusiness] = React.useState({});
  const [items, setItems] = React.useState([]);
  const [form, setForm] = React.useState({ title: "", price: "", description: "", category: "product" });
  const [feedback, setFeedback] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);

  const refresh = React.useCallback(async () => {
    if (!visible || !username) return;
    setLoading(true);
    try {
      const settings = await loadPrivacySettings(username);
      setAccountType(settings?.accountType || "personal");
      if (settings?.accountType === "business") {
        const [profile, catalog] = await Promise.all([loadBusinessProfile(), loadBusinessCatalog()]);
        setBusiness(profile || {});
        setItems(Array.isArray(catalog) ? catalog : []);
      } else {
        const [creatorPosts, followers, following] = await Promise.all([
          loadProfilePosts(username, username, 100),
          loadProfileConnections(username, "followers"),
          loadProfileConnections(username, "following"),
        ]);
        setPosts(Array.isArray(creatorPosts) ? creatorPosts : []);
        setFollowerCount(Array.isArray(followers?.users) ? followers.users.length : 0);
        setFollowingCount(Array.isArray(following?.users) ? following.users.length : 0);
      }
    } catch (error) {
      setFeedback(t("alertLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [visible, username]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const changeAccountType = async (next) => {
    setSaving(true);
    try {
      const result = await savePrivacySettings({ accountType: next }, username);
      setAccountType(result?.accountType || next);
      setTab("overview");
      await refresh();
    } catch (error) {
      setFeedback(t("alertSaveFailed"));
    } finally { setSaving(false); }
  };

  const contactCreatorTeam = async (topic) => {
    const subject = encodeURIComponent('Bhumi Social AI - ' + topic);
    const body = encodeURIComponent('Username: ' + (username || 'Not available') + String.fromCharCode(10) + 'Account type: ' + accountType + String.fromCharCode(10,10) + 'Please share the next steps for ' + topic.toLowerCase() + '.');
    try { await Linking.openURL('mailto:bhumiprabhumeghawal@gmail.com?subject=' + subject + '&body=' + body); }
    catch (_) { setFeedback(t("alertCheckConnection")); }
  };

  const createPromotionBrief = async () => {
    try { await Share.share({ title: 'Promotion brief', message: 'Bhumi Social AI promotion brief' + String.fromCharCode(10) + 'Creator: @' + (username || '') + String.fromCharCode(10) + 'Campaign goal: [add goal]' + String.fromCharCode(10) + 'Target audience: [add audience]' + String.fromCharCode(10) + 'Content format: [post / reel / story]' + String.fromCharCode(10) + 'Budget: [add budget]' + String.fromCharCode(10) + 'Contact: bhumiprabhumeghawal@gmail.com' }); }
    catch (error) { setFeedback(t("alertSaveFailed")); }
  };
  const saveBusiness = async () => {
    setSaving(true);
    try {
      const saved = await saveBusinessProfile(business);
      setBusiness(saved || business);
      setFeedback(t("alertSaved"));
    } catch (error) {
      setFeedback(t("alertSaveFailed"));
    } finally { setSaving(false); }
  };

  const addItem = async () => {
    if (!form.title.trim()) {
      setFeedback(t("alertDetailsRequired"));
      return;
    }
    setSaving(true);
    try {
      const item = await createBusinessCatalogItem({
        title: form.title.trim(), price: form.price.trim(),
        description: form.description.trim(), item_type: form.category
      });
      setItems(current => [item, ...current]);
      setFeedback(t("alertSaved"));
      setForm({ title: "", price: "", description: "", category: "product" });
    } catch (error) {
      setFeedback(t("alertSaveFailed"));
    } finally { setSaving(false); }
  };

  const removeItem = async () => {
    const id = confirmDeleteId;
    if (id == null) return;
    setSaving(true);
    try {
      await deleteBusinessCatalogItem(id);
      setItems(current => current.filter(item => String(item.id) !== String(id)));
      setFeedback(t("alertDelete"));
    } catch (error) {
      setFeedback(t("alertSaveFailed"));
    } finally {
      setSaving(false);
      setConfirmDeleteId(null);
    }
  };

  const field = (label, key, multiline = false) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: MUTED, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <TextInput
        value={String(business[key] || "")}
        onChangeText={value => setBusiness(current => ({ ...current, [key]: value }))}
        placeholder={label}
        placeholderTextColor="#8E8E8E"
        multiline={multiline}
        style={[inputStyle, multiline ? { minHeight: 76, textAlignVertical: "top" } : null]}
      />
    </View>
  );

  const card = (title, subtitle, icon) => (
    <View style={{ backgroundColor: PANEL, borderColor: BORDER, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
      <Ionicons name={icon} size={22} color={GOLD} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: TEXT, fontWeight: "900", fontSize: 13 }}>{title}</Text>
        <Text style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>{subtitle}</Text>
      </View>
    </View>
  );

  const actionButton = (label, onPress, disabled = false) => (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={{ backgroundColor: GOLD, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", opacity: disabled ? 0.6 : 1, marginTop: 8 }}>
      <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: BG, paddingTop: short ? 8 : 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: inset, paddingBottom: short ? 9 : 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: PANEL, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <Ionicons name="close" size={22} color={GOLD} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: GOLD, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>BHUMI SOCIAL AI</Text>
            <Text style={{ color: TEXT, fontSize: Math.round(19 * textScale), fontWeight: "900", marginTop: 3 }}>{t("creatorBusinessHub")}</Text>
          </View>
          <TouchableOpacity onPress={refresh}><Ionicons name="refresh" size={21} color={GOLD}/></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: inset, paddingBottom: short ? 28 : 50 }} keyboardShouldPersistTaps="handled">
          {feedback ? (
            <View style={{ backgroundColor: "#121212", borderColor: BORDER, borderWidth: 1, borderRadius: 11, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: TEXT, fontSize: 12, flex: 1 }}>{feedback}</Text>
              <TouchableOpacity onPress={() => setFeedback("")} style={{ paddingLeft: 12 }}>
                <Ionicons name="close" size={18} color={MUTED} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={{ backgroundColor: "#121212", borderColor: GOLD, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 }}>
            <Text style={{ color: GOLD, fontWeight: "900", fontSize: 12 }}>{t("account").toUpperCase()}</Text>
            <Text style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{t("creatorHubIntro")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
              {[
                ["personal", t("personalAccount")], ["creator", t("creatorAccountType")],
                ["business", t("businessAccountType")]
              ].map(([value, label]) => (
                <TouchableOpacity key={value} disabled={saving} onPress={() => changeAccountType(value)} style={{ backgroundColor: accountType === value ? GOLD : PANEL, borderColor: BORDER, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginRight: compact ? 4 : 7, marginBottom: 7, flexGrow: compact ? 1 : 0 }}>
                  <Text style={{ color: accountType === value ? "#FFFFFF" : TEXT, fontSize: 10, fontWeight: "900" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{t("creatorAccountSaved")}</Text>
          </View>

          {loading ? <ActivityIndicator color={GOLD} style={{ marginVertical: 20 }} /> : null}
          {!loading && accountType === "business" ? (
            <>
              <View style={{ flexDirection: "row", marginBottom: 12 }}>
                {["overview", "profile", "catalog"].map(value => (
                  <TouchableOpacity key={value} onPress={() => setTab(value)} style={{ flex: 1, padding: 10, marginRight: 5, borderRadius: 9, backgroundColor: tab === value ? "#102A3C" : PANEL, borderWidth: 1, borderColor: tab === value ? GOLD : BORDER, alignItems: "center" }}>
                    <Text style={{ color: tab === value ? GOLD : MUTED, fontSize: 11, fontWeight: "800" }}>{t(value === "overview" ? "overviewTab" : value === "profile" ? "profileTab" : "catalogTab").toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {tab === "overview" ? (
                <>
                  {card(t("businessDashboardTitle"), t("businessDashboardDescription"), "storefront-outline")}
                  {card(t("catalogItemsTitle"), t("catalogItemsDescription").replace("{count}", String(items.length)), "pricetags-outline")}
                  {card(t("ordersPaymentsTitle"), t("ordersPaymentsDescription"), "receipt-outline")}
                  {card(t("promotionsDealsTitle"), t("promotionsDealsDescription"), "megaphone-outline")}
                  {actionButton(t("requestBrandCollabAction").toUpperCase(), () => contactCreatorTeam("Business Brand Collaboration Request"))}
                  {actionButton(t("createPromotionBriefAction").toUpperCase(), createPromotionBrief)}
                  {actionButton(t("editBusinessProfileAction").toUpperCase(), () => setTab("profile"))}
                  {actionButton(t("manageProductCatalogAction").toUpperCase(), () => setTab("catalog"))}
                </>
              ) : null}
              {tab === "profile" ? (
                <>
                  {field(t("businessNameField"), "businessName")}
                  {field(t("categoryField"), "category")}
                  {field(t("descriptionField"), "description", true)}
                  {field(t("phoneField"), "phone")}
                  {field(t("whatsappField"), "whatsapp")}
                  {field(t("emailField"), "email")}
                  {field(t("websiteField"), "website")}
                  {field(t("addressField"), "address", true)}
                  {field(t("cityField"), "city")}
                  {field(t("stateField"), "state")}
                  {field(t("pincodeField"), "pincode")}
                  {actionButton(saving ? t("savingAction").toUpperCase() : t("saveBusinessProfileAction").toUpperCase(), saveBusiness, saving)}
                </>
              ) : null}
              {tab === "catalog" ? (
                <>
                  <Text style={{ color: TEXT, fontWeight: "900", fontSize: 15, marginBottom: 10 }}>{t("productsServices")}</Text>
                  <TextInput value={form.title} onChangeText={title => setForm(current => ({ ...current, title }))} placeholder={t("productNamePlaceholder")} placeholderTextColor="#8E8E8E" style={hubInputStyle}/>
                  <TextInput value={form.price} onChangeText={price => setForm(current => ({ ...current, price }))} placeholder={t("pricePlaceholder")} placeholderTextColor="#8E8E8E" keyboardType="decimal-pad" style={hubInputStyle}/>
                  <TextInput value={form.description} onChangeText={description => setForm(current => ({ ...current, description }))} placeholder={t("descriptionPlaceholder")} placeholderTextColor="#8E8E8E" multiline style={[inputStyle, { minHeight: 70, textAlignVertical: "top" }]}/>
                  {actionButton(saving ? t("addingAction").toUpperCase() : t("addToCatalogAction").toUpperCase(), addItem, saving)}
                  <Text style={{ color: GOLD, fontWeight: "900", fontSize: 14, marginTop: 22, marginBottom: 10 }}>{t("productsServices").toUpperCase()} ({items.length})</Text>
                  {items.map(item => (
                    <View key={String(item.id)} style={{ backgroundColor: PANEL, borderColor: BORDER, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: TEXT, fontWeight: "800" }}>{item.title}</Text>
                        <Text style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>{item.price ? "₹" + item.price : t("priceNotSet")} · {item.description || t("noDescription")}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setConfirmDeleteId(item.id)}><Ionicons name="trash-outline" color="#F08080" size={19}/></TouchableOpacity>
                    </View>
                  ))}
                  {!items.length ? <Text style={{ color: MUTED, fontSize: 12 }}>{t("emptyBusinessCatalog")}</Text> : null}
                </>
              ) : null}
            </>
          ) : null}
          {!loading && accountType !== "business" ? (
            <>
              {card(t("creatorStudioTitle"), t("creatorStudioDescription"), "sparkles-outline")}
              <View style={{ flexDirection: "row", marginBottom: 12 }}>
                {[[ "POSTS", posts.length ], [ "FOLLOWERS", followerCount ], [ "FOLLOWING", followingCount ]].map(([label, value]) => (
                  <View key={label} style={{ flex: 1, backgroundColor: PANEL, borderColor: BORDER, borderWidth: 1, borderRadius: 13, padding: 11, marginRight: 6 }}>
                    <Text style={{ color: MUTED, fontSize: 9 }}>{label}</Text>
                    <Text style={{ color: GOLD, fontSize: 22, fontWeight: "900", marginTop: 5 }}>{value}</Text>
                  </View>
                ))}
              </View>
              {card(t("contentAnalyticsTitle"), t("contentAnalyticsDescription"), "analytics-outline")}
              {card(t("brandCollaborationTitle"), t("brandCollaborationDescription"), "handshake-outline")}
              {card(t("monetizationTitle"), t("monetizationDescription"), "wallet-outline")}
              {card(t("promotionsTitle"), t("promotionsDescription"), "megaphone-outline")}
              {actionButton("REQUEST BRAND COLLABORATION", () => contactCreatorTeam("Brand Collaboration Request"))}
              {actionButton(t("askMonetizationAction").toUpperCase(), () => contactCreatorTeam("Creator Monetization Eligibility"))}
              {actionButton("CREATE PROMOTION BRIEF", createPromotionBrief)}
              {actionButton(t("refreshCreatorDataAction").toUpperCase(), refresh, loading)}
            </>
          ) : null}
        </ScrollView>
      </View>
      <Modal visible={confirmDeleteId != null} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 28 }}>
          <View style={{ backgroundColor: PANEL, borderColor: BORDER, borderWidth: 1, borderRadius: 16, padding: 18 }}>
            <Text style={{ color: TEXT, fontSize: 16, fontWeight: "900" }}>{t("deleteCatalogItemTitle")}</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>{t("deleteCatalogItemBody")}</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }}>
              <TouchableOpacity onPress={() => setConfirmDeleteId(null)} disabled={saving} style={{ padding: 11, marginRight: 8 }}>
                <Text style={{ color: TEXT, fontWeight: "700" }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={removeItem} disabled={saving} style={{ backgroundColor: "#ED4956", borderRadius: 9, paddingHorizontal: 15, paddingVertical: 11 }}>
                <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{saving ? t("deletingAction") : t("deleteAction")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
