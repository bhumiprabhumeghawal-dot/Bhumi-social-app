import React from "react";
import {
  Modal, View, Text, TextInput, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Linking, Platform, StyleSheet, Image, Share
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { translateAppText } from "./localization";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import CreatorBusinessHub from "./CreatorBusinessHub";
import { loadSettingsPreferences, saveSettingsPreferences, loadNotificationPreference, saveNotificationPreference, loadNotificationDetails, saveNotificationDetails, loadLoginHistory, loadActiveSessions, revokeActiveSession, logoutOtherSessions, loadLocationShares, createOrUpdateLocationShare, stopLocationShare, loadFeedUserLists, addFeedUserList, removeFeedUserList, loadPrivacySettings, savePrivacySettings } from "./api";

const APP_LANGUAGES = [
  { code:"en", name:"English", native:"English", region:"International" },
  { code:"hi", name:"Hindi", native:"हिन्दी", region:"India" },
  { code:"bn", name:"Bengali", native:"বাংলা", region:"India / Bangladesh" },
  { code:"gu", name:"Gujarati", native:"ગુજરાતી", region:"India" },
  { code:"mr", name:"Marathi", native:"मराठी", region:"India" },
  { code:"ta", name:"Tamil", native:"தமிழ்", region:"India / Sri Lanka" },
  { code:"te", name:"Telugu", native:"తెలుగు", region:"India" },
  { code:"pa", name:"Punjabi", native:"ਪੰਜਾਬੀ", region:"India" },
  { code:"kn", name:"Kannada", native:"ಕನ್ನಡ", region:"India" },
  { code:"ml", name:"Malayalam", native:"മലയാളം", region:"India" },
  { code:"ur", name:"Urdu", native:"اردو", region:"India / Pakistan" },
  { code:"es", name:"Spanish", native:"Español", region:"International" },
  { code:"fr", name:"French", native:"Français", region:"International" },
  { code:"ar", name:"Arabic", native:"العربية", region:"International" },
  { code:"pt", name:"Portuguese", native:"Português", region:"International" },
  { code:"de", name:"German", native:"Deutsch", region:"International" },
  { code:"ja", name:"Japanese", native:"日本語", region:"International" },
  { code:"ko", name:"Korean", native:"한국어", region:"International" },
  { code:"id", name:"Indonesian", native:"Bahasa Indonesia", region:"International" },
  { code:"ru", name:"Russian", native:"Русский", region:"International" },
  { code:"zh", name:"Chinese (Simplified)", native:"简体中文", region:"International" },
  { code:"tr", name:"Turkish", native:"Türkçe", region:"International" },
  { code:"th", name:"Thai", native:"ไทย", region:"International" },
  { code:"vi", name:"Vietnamese", native:"Tiếng Việt", region:"International" },
];
const SECTION_SUBTITLES = {
  hi: {
    account:"व्यक्तिगत जानकारी और खाते के नियंत्रण",
    location:"लाइव लोकेशन साझा करना और आसपास के लोगों को खोजना",
    privacy:"कौन आपकी जानकारी देख और आपसे संपर्क कर सकता है",
    security:"अपने खाते और लॉगिन सत्रों की सुरक्षा करें",
    notifications:"अलर्ट, आवाज़ और शांत समय चुनें",
    messages:"संदेशों और कॉल की गोपनीयता नियंत्रित करें",
    story:"स्टोरी की गोपनीयता और साझाकरण नियंत्रित करें",
    feed:"फ़ीड और रील्स की प्राथमिकताएँ चुनें",
    appearance:"ऐप की दिखावट और भाषा बदलें",
    advanced:"डेटा, डाउनलोड और स्टोरेज प्रबंधित करें",
    creator:"क्रिएटर और प्रोफेशनल टूल प्रबंधित करें",
    appLock:"ऐप और निजी सामग्री की सुरक्षा करें",
    premium:"प्रीमियम सुविधाएँ और सदस्यताएँ प्रबंधित करें",
  },
  ur: {
    account:"ذاتی معلومات اور اکاؤنٹ کے اختیارات",
    location:"لائیو مقام شیئر کریں اور قریبی لوگوں کو تلاش کریں",
    privacy:"کون آپ کی معلومات دیکھ سکتا ہے اور رابطہ کر سکتا ہے",
    security:"اپنے اکاؤنٹ اور سائن اِن سیشنز کو محفوظ رکھیں",
    notifications:"الرٹس، آواز اور خاموش اوقات منتخب کریں",
    messages:"پیغامات اور کالز کی رازداری کنٹرول کریں",
    story:"اسٹوری کی رازداری اور شیئرنگ کنٹرول کریں",
    feed:"فیڈ اور ریلز کی ترجیحات منتخب کریں",
    appearance:"ایپ کی شکل اور زبان تبدیل کریں",
    advanced:"ڈیٹا، ڈاؤن لوڈز اور اسٹوریج منظم کریں",
    creator:"کریئیٹر اور پروفیشنل ٹولز منظم کریں",
    appLock:"ایپ اور نجی مواد کو محفوظ بنائیں",
    premium:"پریمیم خصوصیات اور سبسکرپشنز منظم کریں",
  },
};
function getSectionSubtitle(language, key, fallback) {
  if (language === "en") return fallback;
  return SECTION_SUBTITLES[language]?.[key] || "";
}
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
      // Keep the task registered after transient network/server errors so the
      // next location event can retry. Clear it only when the share/session is
      // no longer authorized or the share no longer exists.
      if ([401, 403, 404, 410].includes(Number(taskError?.status))) {
        await Promise.all([
          SecureStore.deleteItemAsync("bhumi_live_share_id"),
          SecureStore.deleteItemAsync("bhumi_live_share_recipient"),
          SecureStore.deleteItemAsync("bhumi_live_share_duration"),
          SecureStore.deleteItemAsync("bhumi_live_share_approximate"),
        ]).catch(() => {});
        try { await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); } catch (_) {}
      }
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

const LOCATION_FIELD_LABELS = {
  en: ["Live Location Sharing","Nearby Friends","Approximate Location","Location Tags","Background Location","Location Sharing History"],
  hi: ["लाइव लोकेशन शेयरिंग","आस-पास के दोस्त","अनुमानित लोकेशन","लोकेशन टैग","बैकग्राउंड लोकेशन","लोकेशन शेयरिंग इतिहास"],
  gu: ["લાઇવ લોકેશન શેરિંગ","નજીકના મિત્રો","અંદાજિત લોકેશન","લોકેશન ટૅગ્સ","બૅકગ્રાઉન્ડ લોકેશન","લોકેશન શેરિંગ ઇતિહાસ"],
  bn: ["লাইভ লোকেশন শেয়ারিং","কাছাকাছি বন্ধুরা","আনুমানিক লোকেশন","লোকেশন ট্যাগ","ব্যাকগ্রাউন্ড লোকেশন","লোকেশন শেয়ারিংয়ের ইতিহাস"],
  mr: ["थेट लोकेशन शेअरिंग","जवळचे मित्र","अंदाजे लोकेशन","लोकेशन टॅग","बॅकग्राउंड लोकेशन","लोकेशन शेअरिंग इतिहास"],
  ta: ["நேரடி இருப்பிடப் பகிர்வு","அருகிலுள்ள நண்பர்கள்","தோராயமான இருப்பிடம்","இருப்பிடக் குறிச்சொற்கள்","பின்னணி இருப்பிடம்","இருப்பிடப் பகிர்வு வரலாறு"],
  te: ["లైవ్ లొకేషన్ షేరింగ్","దగ్గరలోని స్నేహితులు","సుమారు లొకేషన్","లొకేషన్ ట్యాగ్‌లు","బ్యాక్‌గ్రౌండ్ లొకేషన్","లొకేషన్ షేరింగ్ చరిత్ర"],
  pa: ["ਲਾਈਵ ਟਿਕਾਣਾ ਸਾਂਝਾ ਕਰਨਾ","ਨੇੜਲੇ ਦੋਸਤ","ਅੰਦਾਜ਼ਨ ਟਿਕਾਣਾ","ਟਿਕਾਣਾ ਟੈਗ","ਬੈਕਗ੍ਰਾਊਂਡ ਟਿਕਾਣਾ","ਟਿਕਾਣਾ ਸਾਂਝਾ ਕਰਨ ਦਾ ਇਤਿਹਾਸ"],
  kn: ["ಲೈವ್ ಸ್ಥಳ ಹಂಚಿಕೆ","ಹತ್ತಿರದ ಸ್ನೇಹಿತರು","ಅಂದಾಜು ಸ್ಥಳ","ಸ್ಥಳ ಟ್ಯಾಗ್‌ಗಳು","ಹಿನ್ನೆಲೆ ಸ್ಥಳ","ಸ್ಥಳ ಹಂಚಿಕೆ ಇತಿಹಾಸ"],
  ml: ["തത്സമയ ലൊക്കേഷൻ പങ്കിടൽ","സമീപത്തുള്ള സുഹൃത്തുകൾ","ഏകദേശ ലൊക്കേഷൻ","ലൊക്കേഷൻ ടാഗുകൾ","പശ്ചാത്തല ലൊക്കേഷൻ","ലൊക്കേഷൻ പങ്കിടൽ ചരിത്രം"],
  ur: ["لائیو مقام کا اشتراک","قریبی دوست","تخمینی مقام","مقام کے ٹیگز","پس منظر میں مقام","مقام کے اشتراک کی تاریخ"],
  es: ["Compartir ubicación en vivo","Amigos cercanos","Ubicación aproximada","Etiquetas de ubicación","Ubicación en segundo plano","Historial de ubicación compartida"],
  fr: ["Partage de position en direct","Amis à proximité","Position approximative","Tags de position","Position en arrière-plan","Historique du partage de position"],
  ar: ["مشاركة الموقع المباشر","الأصدقاء القريبون","الموقع التقريبي","وسوم الموقع","الموقع في الخلفية","سجل مشاركة الموقع"],
  pt: ["Compartilhamento de localização ao vivo","Amigos próximos","Localização aproximada","Tags de localização","Localização em segundo plano","Histórico de compartilhamento de localização"],
  de: ["Live-Standortfreigabe","Freunde in der Nähe","Ungefährer Standort","Standort-Tags","Standort im Hintergrund","Verlauf der Standortfreigabe"],
  ja: ["ライブ位置情報の共有","近くの友達","おおよその位置情報","位置情報タグ","バックグラウンド位置情報","位置情報共有履歴"],
  ko: ["실시간 위치 공유","주변 친구","대략적인 위치","위치 태그","백그라운드 위치","위치 공유 기록"],
  id: ["Berbagi lokasi langsung","Teman di sekitar","Lokasi perkiraan","Tag lokasi","Lokasi latar belakang","Riwayat berbagi lokasi"],
  ru: ["Передача геопозиции в реальном времени","Друзья поблизости","Примерное местоположение","Метки местоположения","Фоновое местоположение","История передачи геопозиции"],
  zh: ["实时位置共享","附近的好友","大致位置","位置标签","后台位置","位置共享记录"],
  tr: ["Canlı konum paylaşımı","Yakındaki arkadaşlar","Yaklaşık konum","Konum etiketleri","Arka plan konumu","Konum paylaşım geçmişi"],
  th: ["แชร์ตำแหน่งแบบเรียลไทม์","เพื่อนที่อยู่ใกล้เคียง","ตำแหน่งโดยประมาณ","แท็กตำแหน่ง","ตำแหน่งเบื้องหลัง","ประวัติการแชร์ตำแหน่ง"],
  vi: ["Chia sẻ vị trí trực tiếp","Bạn bè gần đây","Vị trí gần đúng","Thẻ vị trí","Vị trí nền","Lịch sử chia sẻ vị trí"]
};
const LOCATION_FIELD_KEYS = ["location.liveSharing","location.nearbyFriends","location.approximate","location.locationTag","location.background","location.history"];

const ACCOUNT_FIELD_LABELS = {
  en: ["Change Username","Profile QR Code","Multiple Account Management","Profile Verification Request","Download Your Data","Deactivate Account","Delete Account Request"],
  hi: ["यूज़रनेम बदलें","प्रोफ़ाइल QR कोड","एकाधिक अकाउंट प्रबंधन","प्रोफ़ाइल सत्यापन अनुरोध","अपना डेटा डाउनलोड करें","अकाउंट निष्क्रिय करें","अकाउंट हटाने का अनुरोध"],
  gu: ["યુઝરનેમ બદલો","પ્રોફાઇલ QR કોડ","એકથી વધુ એકાઉન્ટનું સંચાલન","પ્રોફાઇલ ચકાસણી વિનંતી","તમારો ડેટા ડાઉનલોડ કરો","એકાઉન્ટ નિષ્ક્રિય કરો","એકાઉન્ટ કાઢી નાખવાની વિનંતી"],
  bn: ["ব্যবহারকারীর নাম পরিবর্তন","প্রোফাইল QR কোড","একাধিক অ্যাকাউন্ট পরিচালনা","প্রোফাইল যাচাইকরণের অনুরোধ","আপনার ডেটা ডাউনলোড করুন","অ্যাকাউন্ট নিষ্ক্রিয় করুন","অ্যাকাউন্ট মুছে ফেলার অনুরোধ"],
  mr: ["वापरकर्तानाव बदला","प्रोफाइल QR कोड","एकाधिक अॅकाउंट व्यवस्थापन","प्रोफाइल पडताळणी विनंती","तुमचा डेटा डाउनलोड करा","अॅकाउंट निष्क्रिय करा","अॅकाउंट हटवण्याची विनंती"],
  ta: ["பயனர்பெயரை மாற்று","சுயவிவர QR குறியீடு","பல கணக்கு மேலாண்மை","சுயவிவரச் சரிபார்ப்பு கோரிக்கை","உங்கள் தரவைப் பதிவிறக்கு","கணக்கைச் செயலிழக்கச் செய்","கணக்கை நீக்கக் கோரு"],
  te: ["వినియోగదారు పేరును మార్చండి","ప్రొఫైల్ QR కోడ్","బహుళ ఖాతాల నిర్వహణ","ప్రొఫైల్ ధృవీకరణ అభ్యర్థన","మీ డేటాను డౌన్‌లోడ్ చేయండి","ఖాతాను నిష్క్రియం చేయండి","ఖాతా తొలగింపు అభ్యర్థన"],
  pa: ["ਵਰਤੋਂਕਾਰ ਨਾਮ ਬਦਲੋ","ਪ੍ਰੋਫ਼ਾਈਲ QR ਕੋਡ","ਕਈ ਖਾਤਿਆਂ ਦਾ ਪ੍ਰਬੰਧਨ","ਪ੍ਰੋਫ਼ਾਈਲ ਤਸਦੀਕ ਬੇਨਤੀ","ਆਪਣਾ ਡਾਟਾ ਡਾਊਨਲੋਡ ਕਰੋ","ਖਾਤਾ ਅਕਿਰਿਆਸ਼ੀਲ ਕਰੋ","ਖਾਤਾ ਮਿਟਾਉਣ ਦੀ ਬੇਨਤੀ"],
  kn: ["ಬಳಕೆದಾರ ಹೆಸರನ್ನು ಬದಲಾಯಿಸಿ","ಪ್ರೊಫೈಲ್ QR ಕೋಡ್","ಬಹು ಖಾತೆಗಳ ನಿರ್ವಹಣೆ","ಪ್ರೊಫೈಲ್ ಪರಿಶೀಲನೆ ವಿನಂತಿ","ನಿಮ್ಮ ಡೇಟಾ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ","ಖಾತೆಯನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಿ","ಖಾತೆ ಅಳಿಸುವ ವಿನಂತಿ"],
  ml: ["ഉപയോക്തൃനാമം മാറ്റുക","പ്രൊഫൈൽ QR കോഡ്","ഒന്നിലധികം അക്കൗണ്ടുകളുടെ നിയന്ത്രണം","പ്രൊഫൈൽ സ്ഥിരീകരണ അഭ്യർത്ഥന","നിങ്ങളുടെ ഡാറ്റ ഡൗൺലോഡ് ചെയ്യുക","അക്കൗണ്ട് നിർജ്ജീവമാക്കുക","അക്കൗണ്ട് ഇല്ലാതാക്കാനുള്ള അഭ്യർത്ഥന"],
  ur: ["صارف نام تبدیل کریں","پروفائل QR کوڈ","متعدد اکاؤنٹس کا انتظام","پروفائل کی تصدیق کی درخواست","اپنا ڈیٹا ڈاؤن لوڈ کریں","اکاؤنٹ غیر فعال کریں","اکاؤنٹ حذف کرنے کی درخواست"],
  es: ["Cambiar nombre de usuario","Código QR del perfil","Gestión de varias cuentas","Solicitud de verificación del perfil","Descargar tus datos","Desactivar cuenta","Solicitar eliminación de cuenta"],
  fr: ["Modifier le nom d’utilisateur","Code QR du profil","Gestion de plusieurs comptes","Demande de vérification du profil","Télécharger vos données","Désactiver le compte","Demande de suppression du compte"],
  ar: ["تغيير اسم المستخدم","رمز QR للملف الشخصي","إدارة حسابات متعددة","طلب توثيق الملف الشخصي","تنزيل بياناتك","تعطيل الحساب","طلب حذف الحساب"],
  pt: ["Alterar nome de usuário","Código QR do perfil","Gerenciamento de várias contas","Solicitação de verificação do perfil","Baixar seus dados","Desativar conta","Solicitar exclusão da conta"],
  de: ["Benutzernamen ändern","Profil-QR-Code","Verwaltung mehrerer Konten","Antrag auf Profilverifizierung","Deine Daten herunterladen","Konto deaktivieren","Kontolöschung beantragen"],
  ja: ["ユーザー名を変更","プロフィールQRコード","複数アカウントの管理","プロフィール認証リクエスト","データをダウンロード","アカウントを無効化","アカウント削除を申請"],
  ko: ["사용자 이름 변경","프로필 QR 코드","여러 계정 관리","프로필 인증 요청","내 데이터 다운로드","계정 비활성화","계정 삭제 요청"],
  id: ["Ubah nama pengguna","Kode QR profil","Pengelolaan beberapa akun","Permintaan verifikasi profil","Unduh data Anda","Nonaktifkan akun","Ajukan penghapusan akun"],
  ru: ["Изменить имя пользователя","QR-код профиля","Управление несколькими аккаунтами","Запрос на подтверждение профиля","Скачать ваши данные","Деактивировать аккаунт","Запросить удаление аккаунта"],
  zh: ["更改用户名","个人资料二维码","多账户管理","个人资料认证申请","下载你的数据","停用账户","申请删除账户"],
  tr: ["Kullanıcı adını değiştir","Profil QR kodu","Birden fazla hesap yönetimi","Profil doğrulama isteği","Verilerini indir","Hesabı devre dışı bırak","Hesap silme talebi"],
  th: ["เปลี่ยนชื่อผู้ใช้","คิวอาร์โค้ดโปรไฟล์","จัดการหลายบัญชี","คำขอยืนยันโปรไฟล์","ดาวน์โหลดข้อมูลของคุณ","ปิดใช้งานบัญชี","คำขอลบบัญชี"],
  vi: ["Đổi tên người dùng","Mã QR hồ sơ","Quản lý nhiều tài khoản","Yêu cầu xác minh hồ sơ","Tải dữ liệu của bạn","Vô hiệu hóa tài khoản","Yêu cầu xóa tài khoản"]
};
const ACCOUNT_FIELD_KEYS = ["profile.usernameChange","account.profileQr","account.multipleAccounts","account.verification","account.dataDownload","account.deactivation","account.deletion"];

const APPEARANCE_FIELD_LABELS = {
  en: ["Light Appearance","Bhumi Blue Theme","App Language","Larger Text","App Animations","App Icon","Display Settings","Chat Appearance"],
  hi: ["लाइट थीम","भूमि ब्लू थीम","ऐप की भाषा","बड़ा टेक्स्ट","ऐप एनिमेशन","ऐप आइकन","डिस्प्ले सेटिंग्स","चैट का रूप"],
  gu: ["લાઇટ થીમ","ભૂમિ બ્લૂ થીમ","એપની ભાષા","મોટું લખાણ","એપ એનિમેશન","એપ આઇકન","ડિસ્પ્લે સેટિંગ્સ","ચેટનો દેખાવ"],
  bn: ["লাইট থিম","ভূমি ব্লু থিম","অ্যাপের ভাষা","বড় লেখা","অ্যাপ অ্যানিমেশন","অ্যাপ আইকন","ডিসপ্লে সেটিংস","চ্যাটের চেহারা"],
  mr: ["लाइट थीम","भूमि ब्लू थीम","अॅपची भाषा","मोठा मजकूर","अॅप अॅनिमेशन","अॅप आयकॉन","डिस्प्ले सेटिंग्ज","चॅटचे स्वरूप"],
  ta: ["ஒளி தோற்றம்","பூமி நீலத் தீம்","செயலி மொழி","பெரிய உரை","செயலி அசைவுகள்","செயலி ஐகான்","காட்சி அமைப்புகள்","அரட்டை தோற்றம்"],
  te: ["లైట్ థీమ్","భూమి బ్లూ థీమ్","యాప్ భాష","పెద్ద అక్షరాలు","యాప్ యానిమేషన్లు","యాప్ ఐకాన్","డిస్‌ప్లే సెట్టింగ్‌లు","చాట్ రూపం"],
  pa: ["ਲਾਈਟ ਥੀਮ","ਭੂਮੀ ਬਲੂ ਥੀਮ","ਐਪ ਦੀ ਭਾਸ਼ਾ","ਵੱਡਾ ਲਿਖਤ","ਐਪ ਐਨੀਮੇਸ਼ਨ","ਐਪ ਆਈਕਨ","ਡਿਸਪਲੇ ਸੈਟਿੰਗਾਂ","ਚੈਟ ਦੀ ਦਿੱਖ"],
  kn: ["ಲೈಟ್ ಥೀಮ್","ಭೂಮಿ ಬ್ಲೂ ಥೀಮ್","ಆ್ಯಪ್ ಭಾಷೆ","ದೊಡ್ಡ ಪಠ್ಯ","ಆ್ಯಪ್ ಅನಿಮೇಷನ್‌ಗಳು","ಆ್ಯಪ್ ಐಕಾನ್","ಡಿಸ್ಪ್ಲೇ ಸೆಟ್ಟಿಂಗ್‌ಗಳು","ಚಾಟ್ ನೋಟ"],
  ml: ["ലൈറ്റ് തീം","ഭൂമി ബ്ലൂ തീം","ആപ്പ് ഭാഷ","വലിയ ടെക്സ്റ്റ്","ആപ്പ് ആനിമേഷനുകൾ","ആപ്പ് ഐക്കൺ","ഡിസ്‌പ്ലേ ക്രമീകരണങ്ങൾ","ചാറ്റിന്റെ രൂപം"],
  ur: ["لائٹ تھیم","بھومی بلیو تھیم","ایپ کی زبان","بڑا متن","ایپ اینیمیشنز","ایپ آئیکن","ڈسپلے کی ترتیبات","چیٹ کی شکل"],
  es: ["Tema claro","Tema azul Bhumi","Idioma de la app","Texto más grande","Animaciones de la app","Icono de la app","Ajustes de pantalla","Apariencia del chat"],
  fr: ["Thème clair","Thème bleu Bhumi","Langue de l’application","Texte plus grand","Animations de l’application","Icône de l’application","Paramètres d’affichage","Apparence du chat"],
  ar: ["المظهر الفاتح","سمة بهومي الزرقاء","لغة التطبيق","نص أكبر","حركات التطبيق","أيقونة التطبيق","إعدادات العرض","مظهر الدردشة"],
  pt: ["Tema claro","Tema azul Bhumi","Idioma do app","Texto maior","Animações do app","Ícone do app","Configurações de exibição","Aparência do chat"],
  de: ["Helles Design","Bhumi-Blau-Design","App-Sprache","Größerer Text","App-Animationen","App-Symbol","Anzeigeeinstellungen","Chat-Design"],
  ja: ["ライトテーマ","Bhumiブルーテーマ","アプリの言語","大きな文字","アプリのアニメーション","アプリアイコン","表示設定","チャットの外観"],
  ko: ["라이트 테마","Bhumi 블루 테마","앱 언어","큰 글자","앱 애니메이션","앱 아이콘","화면 설정","채팅 모양"],
  id: ["Tema terang","Tema Biru Bhumi","Bahasa aplikasi","Teks lebih besar","Animasi aplikasi","Ikon aplikasi","Pengaturan tampilan","Tampilan chat"],
  ru: ["Светлая тема","Синяя тема Bhumi","Язык приложения","Крупный текст","Анимация приложения","Значок приложения","Настройки экрана","Оформление чата"],
  zh: ["浅色外观","Bhumi 蓝色主题","应用语言","较大文字","应用动画","应用图标","显示设置","聊天外观"],
  tr: ["Açık tema","Bhumi Mavi Tema","Uygulama dili","Daha büyük metin","Uygulama animasyonları","Uygulama simgesi","Görüntü ayarları","Sohbet görünümü"],
  th: ["ธีมสว่าง","ธีมสีน้ำเงิน Bhumi","ภาษาของแอป","ข้อความขนาดใหญ่","ภาพเคลื่อนไหวของแอป","ไอคอนแอป","การตั้งค่าการแสดงผล","รูปลักษณ์แชต"],
  vi: ["Giao diện sáng","Chủ đề xanh Bhumi","Ngôn ngữ ứng dụng","Văn bản lớn hơn","Hoạt ảnh ứng dụng","Biểu tượng ứng dụng","Cài đặt hiển thị","Giao diện trò chuyện"]
};
const APPEARANCE_FIELD_KEYS = ["appearance.theme","appearance.royalTheme","appearance.language","appearance.largeText","appearance.animations","appearance.appIcon","appearance.display","appearance.chat"];

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
    ["location.liveSharing","Live Location Sharing","Share your live location with a mutual follower you choose",false],
    ["location.nearbyFriends","Nearby Friends","See approximate distance to friends who shared their location with you",false],
    ["location.approximate","Approximate Location","Share an approximate area instead of exact coordinates",true],
    ["location.locationTag","Location Tags","Allow adding a location to posts and stories",true],
    ["location.background","Background Location","Continue sharing while the app is backgrounded; requires Always permission and a visible system notification",true],
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
    ["security.autoLock","Automatic Lock","Require App PIN or biometrics whenever the app leaves the foreground",true],
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
    ["appearance.theme","Light Appearance","Switch the app canvas and status bar to a bright theme",false],
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

export default function SettingsDashboard({ visible, username, onClose, onLogout, onAbout, onLegacyOpen, onPreferencesChange, appLanguage = "en", onLanguageChange }) {
  const t = React.useCallback((key) => translateAppText(appLanguage, key), [appLanguage]);
  const [active, setActive] = React.useState(null);
  const [languageVisible, setLanguageVisible] = React.useState(false);
  const [selectedLanguage, setSelectedLanguage] = React.useState(appLanguage);
  React.useEffect(() => { setSelectedLanguage(appLanguage || "en"); }, [appLanguage]);
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
  const [feedListsVisible, setFeedListsVisible] = React.useState(false);
  const [feedListsLoading, setFeedListsLoading] = React.useState(false);
  const [feedLists, setFeedLists] = React.useState({ favorites:[], muted:[] });
  const [feedListUsername, setFeedListUsername] = React.useState("");
  const [feedListType, setFeedListType] = React.useState("favorite");
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationShares, setLocationShares] = React.useState({ outgoing:[], incoming:[] });
  const [locationRecipient, setLocationRecipient] = React.useState("");
  const [locationDuration, setLocationDuration] = React.useState(60);
  const previousUsernameRef = React.useRef(username);
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
        loadPrivacySettings(username || "you").catch(() => null),
        SecureStore.getItemAsync("bhumi_app_lock_pin"),
        SecureStore.getItemAsync("bhumi_app_auto_lock"),
        SecureStore.getItemAsync("bhumi_app_biometric_fingerprint"),
        SecureStore.getItemAsync("bhumi_app_biometric_face"),
      ]).then(([data, notificationsEnabled, notificationDetails, privacySettings, storedAppPin, storedAutoLock, storedFingerprint, storedFace]) => {
        if (!alive) return;
        const merged = { ...(data || {}) };
        merged["security.appLock"] = !!storedAppPin;
        merged["security.pin"] = !!storedAppPin;
        if (storedAppPin) merged["security.autoLock"] = storedAutoLock !== "false";
        merged["security.fingerprint"] = !!storedFingerprint;
        merged["security.faceUnlock"] = !!storedFace;
        merged["notifications.enabled"] = notificationsEnabled;
        if (privacySettings) {
          merged["privacy.onlineStatus"] = !!privacySettings.showActivity;
          merged["privacy.lastSeen"] = !!privacySettings.showActivity;
          merged["privacy.messageAccess"] = !!privacySettings.allowMessages;
          merged["messages.allowMessages"] = !!privacySettings.allowMessages;
        }
        if (typeof merged["messages.readReceipts"] === "boolean") {
          merged["privacy.readReceipts"] = merged["messages.readReceipts"];
        }
        Object.entries(notificationDetails || {}).forEach(([name, enabled]) => {
          const key = ({ likes:"notifications.likes", comments:"notifications.comments", follows:"notifications.follows", requests:"notifications.requests", messages:"notifications.messages", reels:"notifications.reels" })[name];
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
      } else if (["privacy.onlineStatus", "privacy.lastSeen", "privacy.messageAccess", "messages.allowMessages"].includes(key)) {
        const field = key === "privacy.onlineStatus" || key === "privacy.lastSeen"
          ? "showActivity"
          : "allowMessages";
        await savePrivacySettings({ [field]: value }, username || "you");
        if (field === "allowMessages") {
          await saveSettingsPreferences({ "messages.allowMessages": value });
        }
        setPreferences((current) => ({
          ...current,
          [key]: value,
          ...(field === "showActivity" ? {
            "privacy.onlineStatus": value,
            "privacy.lastSeen": value,
          } : {
            "privacy.messageAccess": value,
            "messages.allowMessages": value,
          }),
        }));
      } else if (key === "privacy.readReceipts") {
        await saveSettingsPreferences({ "messages.readReceipts": value });
        setPreferences((current) => ({
          ...current,
          "privacy.readReceipts": value,
          "messages.readReceipts": value,
        }));
      } else {
        const detailKey = ({ "notifications.likes":"likes", "notifications.comments":"comments", "notifications.follows":"follows", "notifications.messages":"messages", "notifications.requests":"requests", "notifications.reels":"reels" })[key];
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
      const updates = { [key]: value };
      if (key === "privacy.onlineStatus" || key === "privacy.lastSeen") {
        updates["privacy.onlineStatus"] = value;
        updates["privacy.lastSeen"] = value;
      }
      if (key === "privacy.messageAccess" || key === "messages.allowMessages") {
        updates["privacy.messageAccess"] = value;
        updates["messages.allowMessages"] = value;
      }
      if (key === "privacy.readReceipts" || key === "messages.readReceipts") {
        updates["privacy.readReceipts"] = value;
        updates["messages.readReceipts"] = value;
      }
      onPreferencesChange?.((current) => ({ ...current, ...updates }));
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      setNotice({ title: "Save failed", message: error.message || "Could not save this setting." });
    } finally { setSavingKey(""); }
  };

  const refreshFeedLists = async () => {
    setFeedListsLoading(true);
    try {
      setFeedLists(await loadFeedUserLists());
    } catch (error) {
      setNotice({ title:"{t("section_feed")}", message:error?.message || "Could not load account lists." });
    } finally {
      setFeedListsLoading(false);
    }
  };

  const openFeedLists = (type = "favorite") => {
    setFeedListType(type);
    setFeedListUsername("");
    setActive(null);
    setFeedListsVisible(true);
    void refreshFeedLists();
  };

  const saveFeedListAccount = async () => {
    const target = feedListUsername.trim().replace(/^@/, "");
    if (!target) {
      setNotice({ title:"Username required", message:"Enter the username of the account you want to add." });
      return;
    }
    setFeedListsLoading(true);
    try {
      await addFeedUserList(feedListType, target);
      setFeedListUsername("");
      setFeedLists(await loadFeedUserLists());
      setNotice({
        title:feedListType === "favorite" ? "Added to Favorites" : "Account Muted",
        message:feedListType === "favorite"
          ? "This account will be prioritized near the top of your Posts and Reels feed."
          : "Posts, Reels and Stories from this account will be hidden from your feed. You can unmute it here.",
      });
    } catch (error) {
      setNotice({ title:"Could not update list", message:error?.message || "Please check the username and try again." });
    } finally {
      setFeedListsLoading(false);
    }
  };

  const deleteFeedListAccount = async (type, target) => {
    setFeedListsLoading(true);
    try {
      await removeFeedUserList(type, target);
      setFeedLists(await loadFeedUserLists());
    } catch (error) {
      setNotice({ title:"Could not update list", message:error?.message || "Please try again." });
    } finally {
      setFeedListsLoading(false);
    }
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
      if (permission.status !== "granted") throw new Error("Grant foreground location permission to see nearby friends.");
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
      setLocationStatus(error?.message || "Nearby friends could not be loaded.");
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
    if (!recipient) { setLocationStatus("Enter the username of the friend you want to share your location with."); return; }
    setLocationLoading(true);
    setLocationStatus("Requesting location permission…");
    let createdShareId = null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("While Using the App location permission is required for live location sharing.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const approximate = !!preferences["location.approximate"];
      const latitude = approximate ? Math.round(position.coords.latitude * 100) / 100 : position.coords.latitude;
      const longitude = approximate ? Math.round(position.coords.longitude * 100) / 100 : position.coords.longitude;
      const previousShareId = activeLocationShareRef.current?.shareId || await SecureStore.getItemAsync("bhumi_live_share_id");
      if (previousShareId) await stopLocationShare(previousShareId).catch(() => {});
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
          throw new Error("Background location permission was not granted. Location sharing was not started. Choose Allow all the time in Android Settings, or turn off Background Location and use foreground sharing.");
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
            setLocationStatus(error?.message || "The location could not be updated.");
          }
        });
      }
      setLocationStatus("Your live location is shared with @" + created.recipient_username + "." + (preferences["location.background"] ? "Background location service is active." : "Updates will run while the app is in the foreground."));
      await refreshLocationShares();
    } catch (error) {
      if (createdShareId) {
        try { await stopLocationShare(createdShareId); } catch (_) {}
        await stopLocationWatcher();
      }
      setLocationStatus(error?.message || "Live location could not be started.");
    } finally { setLocationLoading(false); }
  };

  const endLocationShare = async (shareId) => {
    try {
      await stopLocationShare(shareId);
      const storedShareId = await SecureStore.getItemAsync("bhumi_live_share_id");
      if (activeLocationShareRef.current?.shareId === shareId || storedShareId === shareId) await stopLocationWatcher();
      setLocationStatus("Location sharing has been stopped.");
      await refreshLocationShares();
    } catch (error) { setLocationStatus(error?.message || "Location sharing could not be stopped."); }
  };

  React.useEffect(() => {
    const previousUsername = previousUsernameRef.current;
    previousUsernameRef.current = username;
    if (previousUsername && !username) {
      (async () => {
        const shareId = activeLocationShareRef.current?.shareId || await SecureStore.getItemAsync("bhumi_live_share_id");
        if (shareId) await stopLocationShare(shareId).catch(() => {});
        await stopLocationWatcher();
      })();
    }
  }, [username]);

  React.useEffect(() => () => { void stopLocationWatcher(); }, []);
  const toggleBiometricUnlock = async (key) => {
    const isFingerprint = key === "security.fingerprint";
    const secureKey = isFingerprint ? "bhumi_app_biometric_fingerprint" : "bhumi_app_biometric_face";
    const label = isFingerprint ? "Fingerprint Unlock" : "Face Unlock";
    try {
      const enabled = await SecureStore.getItemAsync(secureKey);
      if (enabled === "true") {
        await SecureStore.deleteItemAsync(secureKey);
        const saved = await saveSettingsPreferences({ [key]:false });
        setPreferences((current)=>({...current,...saved,[key]:false}));
        setNotice({ title:label+" disabled", message:label+" has been turned off on this device." });
        return;
      }
      const pin = await SecureStore.getItemAsync("bhumi_app_lock_pin");
      if (!pin) {
        setActive(null);
        setPinAlreadySet(false);
        setPinValue("");
        setPinConfirmValue("");
        setPinSetupVisible(true);
        setNotice({ title:"Set App PIN first", message:"Create an App PIN first. Fingerprint or Face Unlock will then work as a secure alternative to that PIN." });
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const requiredType = isFingerprint ? LocalAuthentication.AuthenticationType.FINGERPRINT : LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION;
      if (!hasHardware || !enrolled || !supported.includes(requiredType)) {
        throw new Error(isFingerprint ? "No enrolled fingerprint is available on this device." : "No enrolled face unlock is available on this device.");
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage:"Enable "+label, cancelLabel:"Cancel", disableDeviceFallback:true });
      if (!result.success) return;
      await SecureStore.setItemAsync(secureKey,"true");
      const saved = await saveSettingsPreferences({ [key]:true });
      setPreferences((current)=>({...current,...saved,[key]:true}));
      setNotice({ title:label+" enabled", message:"You can now use "+label+" on the App Lock screen. Your App PIN will remain available as a backup." });
    } catch (error) {
      setNotice({ title:label, message:error?.message || "Biometric authentication could not be enabled." });
    }
  };

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
      void toggleBiometricUnlock(key);
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
      setNotice({ title:"Display Settings", message:"Use the Light Appearance switch in Appearance Settings to change the app background and status bar. Language switching is managed separately." });
      return;
    }
    if (key === "feed.favorites" || key === "feed.mutedAccounts") {
      openFeedLists(key === "feed.favorites" ? "favorite" : "muted");
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
    const [key, originalTitle, subtitle, defaultValue] = field;
    const appearanceIndex = APPEARANCE_FIELD_KEYS.indexOf(key);
    const accountIndex = ACCOUNT_FIELD_KEYS.indexOf(key);
    const locationIndex = LOCATION_FIELD_KEYS.indexOf(key);
    const appearanceLabels = APPEARANCE_FIELD_LABELS[appLanguage] || APPEARANCE_FIELD_LABELS.en;
    const accountLabels = ACCOUNT_FIELD_LABELS[appLanguage] || ACCOUNT_FIELD_LABELS.en;
    const locationLabels = LOCATION_FIELD_LABELS[appLanguage] || LOCATION_FIELD_LABELS.en;
    const sectionKey = key.startsWith("profile.") ? "account" : key.startsWith("protection.") ? "appLock" : key.split(".")[0];
    const localizedSectionTitle = appLanguage === "en" ? originalTitle : t("section_" + sectionKey);
    const title = appearanceIndex >= 0 ? appearanceLabels[appearanceIndex] : accountIndex >= 0 ? accountLabels[accountIndex] : locationIndex >= 0 ? locationLabels[locationIndex] : appLanguage === "en" ? originalTitle : (localizedSectionTitle || t("settings"));
    const fieldSubtitle = appLanguage === "en" ? subtitle : "";
    const value = preferences[key] ?? defaultValue;
    const isAction = ACTION_KEYS.has(key);
    return (
      <View key={key} style={{ backgroundColor:BG, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:BORDER, paddingHorizontal:2, paddingVertical:16, marginBottom:0 }}>
        <View style={{ flexDirection:"row", alignItems:"center" }}>
          <View style={{ flex:1, paddingRight:12 }}>
            <Text style={{ color:TEXT, fontSize:14, fontWeight:"800" }}>{title}</Text>
            <Text style={{ color:MUTED, fontSize:11, marginTop:4, lineHeight:16 }}>{fieldSubtitle}</Text>
            {((key === "security.fingerprint" || key === "security.faceUnlock") && value) ? <Text style={{ color:"#65C18C",fontSize:10,fontWeight:"800",marginTop:5 }}>{t("enabledDevice")}</Text> : null}
            {savingKey === key ? <Text style={{ color:GOLD, fontSize:10, marginTop:5 }}>{t("saving")}</Text> : null}
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
              <Text style={{ color:TEXT,fontSize:19,fontWeight:"900", letterSpacing:-0.35 }}>{t("section_" + section.key) || section.title}</Text>
              <Text style={{ color:MUTED,fontSize:11,marginTop:4 }}>{getSectionSubtitle(appLanguage, section.key, section.subtitle)}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding:18,paddingBottom: Platform.OS === "android" ? 64 : 40 }} keyboardShouldPersistTaps="handled">
            {section.key === "location" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderColor:GOLD,borderWidth:1,borderRadius:15,padding:14,marginBottom:14 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>{t("locationSafety")}</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>{t("locationSharingOff")}</Text>
                <TouchableOpacity onPress={() => Linking.openSettings()} style={{ alignSelf:"flex-start",marginTop:12,backgroundColor:GOLD,borderRadius:10,paddingHorizontal:13,paddingVertical:9 }}>
                  <Text style={{ color:"#FFFFFF",fontWeight:"900",fontSize:12 }}>{t("openPermissions")}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {section.key === "security" && appLanguage === "en" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderRadius:14,padding:13,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"800",fontSize:12 }}>{t("securityNote")}</Text>
                <Text style={{ color:MUTED,fontSize:11,lineHeight:17,marginTop:5 }}>Account security controls are separate from chat privacy preferences.</Text>
              </View>
            ) : null}
            {section.key === "messages" && appLanguage === "en" ? (
              <View style={{ backgroundColor:"#1C1C1E",borderWidth:1,borderColor:GOLD,borderRadius:14,padding:14,marginBottom:13 }}>
                <Text style={{ color:GOLD,fontWeight:"900",fontSize:13 }}>CHAT PRIVACY CONTROLS</Text>
                <Text style={{ color:TEXT,fontSize:12,lineHeight:18,marginTop:6 }}>Blocked and Restricted Accounts are managed from the Privacy Settings section. Your existing conversations remain available when you turn off first-time message requests; new unknown senders are refused. Read receipts and typing indicators are enforced by the chat server.</Text>
              </View>
            ) : null}
            {section.key === "messages" && appLanguage === "en" ? (
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
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>{t("section_about")}</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "account" ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.("account"); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>{t("section_account")}</Text>
              </TouchableOpacity>
            ) : null}
            {section.key === "security" ? (
              <TouchableOpacity onPress={() => { setActive(null); onLegacyOpen?.("security"); }} style={{ backgroundColor:GOLD,borderRadius:13,padding:15,alignItems:"center",marginTop:8 }}>
                <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>{t("section_security")}</Text>
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
              <Text style={{ color:TEXT,fontSize:22,fontWeight:"900",letterSpacing:-0.5 }}>{t("settings")}</Text>
              <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{t("accountsDescription")}</Text>
            </View>
          </View>
          <View style={{ flex:1,paddingHorizontal:17,paddingTop:15,paddingBottom: Platform.OS === "android" ? 20 : 12 }}>
            <View style={{ flexDirection:"row",alignItems:"center",backgroundColor:PANEL,borderRadius:12,paddingHorizontal:12,height:44,marginBottom:14 }}>
              <Ionicons name="search" size={19} color={MUTED}/>
              <TextInput
                value={settingsSearch}
                onChangeText={setSettingsSearch}
                placeholder={t("search")}
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
                <Text style={{ color:TEXT,fontSize:14,fontWeight:"800" }}>{t("accountsCenter")}</Text>
                <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{t("accountsDescription")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED}/>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLanguageVisible(true)} activeOpacity={0.85} style={{ flexDirection:"row",alignItems:"center",backgroundColor:BG,borderWidth:1,borderColor:BORDER,borderRadius:13,padding:13,marginBottom:15 }}>
              <View style={{ width:40,height:40,borderRadius:20,backgroundColor:PANEL,alignItems:"center",justifyContent:"center",marginRight:11 }}><Ionicons name="language-outline" size={23} color={GOLD}/></View>
              <View style={{ flex:1 }}><Text style={{ color:TEXT,fontSize:14,fontWeight:"800" }}>{t("language")}</Text><Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{t("choose")} · {APP_LANGUAGES.find((item) => item.code === selectedLanguage)?.name || "English"}</Text></View>
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
                    <Text style={{ color:TEXT,fontSize:14,fontWeight:"800" }}>{t("section_" + section.key) || section.title}</Text>
                    <Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{getSectionSubtitle(appLanguage, section.key, section.subtitle)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={MUTED}/>
                </TouchableOpacity>
              )) : (
                <View style={{ paddingVertical:28,alignItems:"center" }}>
                  <Ionicons name="search-outline" size={28} color={MUTED}/>
                  <Text style={{ color:TEXT,fontSize:14,fontWeight:"700",marginTop:10 }}>{t("noSettings")}</Text>
                  <Text style={{ color:MUTED,fontSize:11,marginTop:4 }}>{t("tryKeyword")}</Text>
                </View>
              )}
              <TouchableOpacity onPress={async()=>{const shareId=activeLocationShareRef.current?.shareId||await SecureStore.getItemAsync("bhumi_live_share_id");if(shareId)await stopLocationShare(shareId).catch(()=>{});await stopLocationWatcher();onLogout?.();}} style={{ flexDirection:"row",alignItems:"center",justifyContent:"center",backgroundColor:"#35191D",borderWidth:1,borderColor:"#7C3039",borderRadius:14,padding:14,marginTop:5 }}>
                <Ionicons name="log-out-outline" color="#F08080" size={20}/>
                <Text style={{ color:"#F08080",fontWeight:"900",marginLeft:9 }}>{t("logOut")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ alignItems:"center",padding:14,marginTop:4 }}>
                <Text style={{ color:MUTED,fontWeight:"800" }}>{t("closeSettings")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {renderSection()}
<CreatorBusinessHub visible={hubVisible && visible} username={username} appLanguage={appLanguage} onClose={() => setHubVisible(false)} />
      <Modal visible={securityVisible && visible} transparent animationType="slide" onRequestClose={() => setSecurityVisible(false)}>
        <View style={{ flex:1,backgroundColor:"#000000",paddingTop:Platform.OS==="android"?35:55,paddingHorizontal:18,paddingBottom:20 }}>
          <View style={{ flexDirection:"row",alignItems:"center",marginBottom:16 }}>
            <TouchableOpacity onPress={()=>setSecurityVisible(false)} style={{ width:38 }}><Ionicons name="arrow-back" size={24} color={TEXT}/></TouchableOpacity>
            <Text style={{ color:TEXT,fontSize:20,fontWeight:"900",flex:1 }}>Login & Security</Text>
            <TouchableOpacity onPress={refreshSecurityData}><Ionicons name="refresh" size={21} color={GOLD}/></TouchableOpacity>
          </View>
          {securityLoading ? <ActivityIndicator color={GOLD}/> : null}
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ color:TEXT,fontSize:15,fontWeight:"900",marginBottom:8 }}>{t("section_security")}</Text>
            {loginHistory.length ? loginHistory.map((item)=>(
              <View key={String(item.id)} style={{ backgroundColor:PANEL,borderRadius:13,padding:13,marginBottom:8 }}>
                <View style={{ flexDirection:"row",alignItems:"center" }}>
                  <Ionicons name="phone-portrait-outline" size={20} color={GOLD}/>
                  <Text style={{ color:TEXT,fontSize:12,fontWeight:"800",flex:1,marginLeft:9 }} numberOfLines={2}>{item.device_label || "Unknown device"}</Text>
                  {item.is_current ? <Text style={{ color:"#65C18C",fontSize:10,fontWeight:"900" }}>{t("enabledDevice")}</Text> : null}
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
                {!item.is_current ? <TouchableOpacity onPress={async()=>{try{await revokeActiveSession(item.id);await refreshSecurityData();}catch(error){setNotice({title:"Could not sign out device",message:error?.message||"Please try again."});}}} style={{ alignSelf:"flex-start",paddingVertical:8,marginTop:4 }}><Text style={{ color:"#F08080",fontSize:11,fontWeight:"900" }}>{t("logOut")}</Text></TouchableOpacity> : null}
              </View>
            )) : <Text style={{ color:MUTED,fontSize:12 }}>{t("noNotificationsYet")}</Text>}
            <TouchableOpacity onPress={async()=>{try{await logoutOtherSessions();await refreshSecurityData();setNotice({title:"Other devices signed out",message:"All other active sessions have been ended. This device remains signed in."});}catch(error){setNotice({title:"Could not sign out other devices",message:error?.message||"Please try again."});}}} style={{ backgroundColor:"#35191D",borderRadius:12,padding:13,alignItems:"center",marginTop:15 }}>
              <Text style={{ color:"#F08080",fontWeight:"900" }}>{t("logOut")}</Text>
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
              <Text style={{ color:TEXT,fontSize:15,fontWeight:"900" }}>{t("shareProfileAction")}</Text>
              <Text style={{ color:MUTED,fontSize:11,lineHeight:16,marginTop:5 }}>{t("locationSafety")}</Text>
              <TextInput value={locationRecipient} onChangeText={setLocationRecipient} placeholder="Friend's username" placeholderTextColor="#777777" autoCapitalize="none" autoCorrect={false} style={{ color:TEXT,borderWidth:1,borderColor:BORDER,borderRadius:11,padding:12,marginTop:13 }}/>
              <Text style={{ color:MUTED,fontSize:11,fontWeight:"800",marginTop:13,marginBottom:8 }}>{t("choose")}</Text>
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
              <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",flex:1 }}>{t("section_location")}</Text>
              <TouchableOpacity onPress={findNearbyFriends} style={{ backgroundColor:"#102A3C",borderRadius:18,paddingHorizontal:11,paddingVertical:7 }}>
                <Text style={{ color:GOLD,fontSize:10,fontWeight:"900" }}>{t("searchTab")}</Text>
              </TouchableOpacity>
            </View>
            {Object.keys(nearbyDistances).length ? [...(locationShares.incoming || [])].sort((a,b)=>(nearbyDistances[a.share_id]??Infinity)-(nearbyDistances[b.share_id]??Infinity)).map((item)=>(
              <View key={"nearby-"+item.share_id} style={{ flexDirection:"row",alignItems:"center",backgroundColor:PANEL,borderRadius:10,padding:10,marginBottom:6 }}>
                <Ionicons name="location" color={GOLD} size={17}/>
                <Text style={{ color:TEXT,fontSize:11,fontWeight:"800",flex:1,marginLeft:8 }}>@{item.owner_username}</Text>
                <Text style={{ color:MUTED,fontSize:10 }}>{nearbyDistances[item.share_id].toFixed(1)} km</Text>
              </View>
            )) : <Text style={{ color:MUTED,fontSize:10,marginBottom:13 }}>{t("locationSafety")}</Text>}
            <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",marginBottom:8 }}>{t("section_location")}</Text>
            {locationShares.incoming.map((item)=>(
              <View key={item.share_id} style={{ backgroundColor:PANEL,borderRadius:12,padding:12,marginBottom:8 }}>
                <Text style={{ color:TEXT,fontSize:12,fontWeight:"900" }}>@{item.owner_username}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:4 }}>{t("updatedLabel")} {new Date(item.updated_at).toLocaleString()} · {t("expiresLabel")} {new Date(item.expires_at).toLocaleString()}</Text>
                <TouchableOpacity onPress={()=>Linking.openURL("https://www.google.com/maps/search/?api=1&query="+item.latitude+","+item.longitude)} style={{ paddingVertical:8 }}><Text style={{ color:GOLD,fontSize:11,fontWeight:"900" }}>{t("searchTab")}</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>endLocationShare(item.share_id)}><Text style={{ color:"#F08080",fontSize:11,fontWeight:"800" }}>{t("cancel")}</Text></TouchableOpacity>
              </View>
            ))}
            {!locationShares.incoming.length ? <Text style={{ color:MUTED,fontSize:11,marginBottom:12 }}>{t("noNotificationsYet")}</Text> : null}
            <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",marginTop:12,marginBottom:8 }}>{t("section_location")}</Text>
            {locationShares.outgoing.map((item)=>(
              <View key={item.share_id} style={{ backgroundColor:PANEL,borderRadius:12,padding:12,marginBottom:8 }}>
                <Text style={{ color:TEXT,fontSize:12,fontWeight:"900" }}>{t("sharedWithLabel")} @{item.recipient_username}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:4 }}>Updated {new Date(item.updated_at).toLocaleString()} · Expires {new Date(item.expires_at).toLocaleString()}</Text>
                <TouchableOpacity onPress={()=>endLocationShare(item.share_id)} style={{ paddingVertical:8 }}><Text style={{ color:"#F08080",fontSize:11,fontWeight:"900" }}>{t("cancel")}</Text></TouchableOpacity>
              </View>
            ))}
            {!locationShares.outgoing.length ? <Text style={{ color:MUTED,fontSize:11 }}>{t("noNotificationsYet")}</Text> : null}
            <Text style={{ color:TEXT,fontSize:14,fontWeight:"900",marginTop:18,marginBottom:8 }}>{t("section_location")}</Text>
            {(locationShares.history || []).map((item)=>(
              <View key={"history-"+item.share_id} style={{ backgroundColor:PANEL,borderRadius:11,padding:11,marginBottom:7 }}>
                <Text style={{ color:TEXT,fontSize:11,fontWeight:"800" }}>{item.owner_username===username ? t("youSharedWithLabel")+" @"+item.recipient_username : "@"+item.owner_username+" "+t("sharedWithYouLabel")"}</Text>
                <Text style={{ color:MUTED,fontSize:10,marginTop:4 }}>{new Date(item.created_at).toLocaleString()} · {item.active ? "Active" : "Ended"}</Text>
              </View>
            ))}
            {!(locationShares.history || []).length ? <Text style={{ color:MUTED,fontSize:11 }}>{t("noNotificationsYet")}</Text> : null}
            <View style={{ backgroundColor:"#1B1B1B",borderRadius:12,padding:12,marginTop:15,marginBottom:20 }}>
              <Text style={{ color:MUTED,fontSize:10,lineHeight:15 }}>Location is shared only after you press Start, only with the selected mutual follower, and expires automatically. Background Location requires the separate switch, Always permission, and an ongoing system notification. You can stop sharing here at any time. Approximate Location rounds coordinates before sending.</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={feedListsVisible && visible} transparent animationType="slide" onRequestClose={() => setFeedListsVisible(false)}>
        <View style={{ flex:1,backgroundColor:"#000000",paddingTop:Platform.OS==="android"?35:55,paddingHorizontal:18,paddingBottom:20 }}>
          <View style={{ flexDirection:"row",alignItems:"center",marginBottom:15 }}>
            <TouchableOpacity onPress={()=>setFeedListsVisible(false)} style={{ width:38 }}><Ionicons name="arrow-back" size={24} color={TEXT}/></TouchableOpacity>
            <Text style={{ color:TEXT,fontSize:20,fontWeight:"900",flex:1 }}>{t("section_feed")}</Text>
            <TouchableOpacity onPress={refreshFeedLists}><Ionicons name="refresh" size={21} color={GOLD}/></TouchableOpacity>
          </View>
          <View style={{ flexDirection:"row",backgroundColor:PANEL,borderRadius:12,padding:4,marginBottom:14 }}>
            {[
              { key:"favorite", label:"Favorites" },
              { key:"muted", label:"Muted" },
            ].map(item=>(
              <TouchableOpacity key={item.key} onPress={()=>setFeedListType(item.key)} style={{ flex:1,backgroundColor:feedListType===item.key?"#17334A":"transparent",borderRadius:9,padding:10,alignItems:"center" }}>
                <Text style={{ color:feedListType===item.key?GOLD:TEXT,fontWeight:"900",fontSize:12 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color:MUTED,fontSize:11,lineHeight:16,marginBottom:10 }}>
            {feedListType==="favorite"
              ? "Favorite accounts appear first in your Posts and Reels feed. They are not notified."
              : "Muted accounts' posts, reels and stories are hidden from your feed. They are not notified."}
          </Text>
          <View style={{ flexDirection:"row",alignItems:"center",marginBottom:14 }}>
            <TextInput value={feedListUsername} onChangeText={setFeedListUsername} placeholder="Enter username" placeholderTextColor="#777777" autoCapitalize="none" autoCorrect={false} onSubmitEditing={saveFeedListAccount} returnKeyType="done" style={{ flex:1,color:TEXT,backgroundColor:PANEL,borderWidth:1,borderColor:BORDER,borderRadius:11,padding:12,marginRight:8 }}/>
            <TouchableOpacity disabled={feedListsLoading} onPress={saveFeedListAccount} style={{ backgroundColor:GOLD,borderRadius:11,paddingVertical:13,paddingHorizontal:16,opacity:feedListsLoading?0.6:1 }}>
              <Text style={{ color:"#FFFFFF",fontWeight:"900",fontSize:12 }}>{t("create")}</Text>
            </TouchableOpacity>
          </View>
          {feedListsLoading ? <ActivityIndicator color={GOLD} style={{ marginVertical:10 }}/> : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {(feedListType==="favorite"?feedLists.favorites:feedLists.muted).map(item=>(
              <View key={item.username} style={{ flexDirection:"row",alignItems:"center",backgroundColor:PANEL,borderRadius:12,padding:12,marginBottom:8 }}>
                <View style={{ width:38,height:38,borderRadius:19,backgroundColor:"#242424",alignItems:"center",justifyContent:"center",marginRight:10 }}>
                  <Ionicons name="person" size={18} color={GOLD}/>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color:TEXT,fontSize:13,fontWeight:"900" }}>{item.displayName || item.username}</Text>
                  <Text style={{ color:MUTED,fontSize:11,marginTop:2 }}>@{item.username}</Text>
                </View>
                <TouchableOpacity disabled={feedListsLoading} onPress={()=>deleteFeedListAccount(feedListType,item.username)} style={{ borderWidth:1,borderColor:"#5B3035",borderRadius:9,paddingVertical:8,paddingHorizontal:11 }}>
                  <Text style={{ color:"#F08080",fontSize:11,fontWeight:"900" }}>{feedListType==="favorite"?"Remove":"Unmute"}</Text>
                </TouchableOpacity>
              </View>
            ))}
            {!feedListsLoading && !(feedListType==="favorite"?feedLists.favorites:feedLists.muted).length
              ? <Text style={{ color:MUTED,fontSize:12,textAlign:"center",marginTop:24 }}>{t("noNotificationsYet")}</Text>
              : null}
          </ScrollView>
          <TouchableOpacity onPress={()=>setFeedListsVisible(false)} style={{ backgroundColor:"#242424",borderRadius:12,padding:13,alignItems:"center",marginTop:10 }}>
            <Text style={{ color:TEXT,fontWeight:"900" }}>{t("close")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={pinSetupVisible && visible} transparent animationType="fade" onRequestClose={() => setPinSetupVisible(false)}>
        <View style={{ flex:1,backgroundColor:"rgba(0,0,0,0.82)",justifyContent:"center",padding:24 }}>
          <View style={{ backgroundColor:"#121212",borderRadius:20,borderWidth:1,borderColor:"#303030",padding:20 }}>
            <Text style={{ color:TEXT,fontSize:19,fontWeight:"900" }}>{pinAlreadySet ? "Change App PIN" : "Set App PIN"}</Text>
            <Text style={{ color:MUTED,fontSize:12,lineHeight:18,marginTop:7 }}>Choose a 4–6 digit PIN. It is required on app launch; Automatic Lock can also require it whenever the app returns from the background.</Text>
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
              <Text style={{ color:"#FFFFFF",fontWeight:"900" }}>{t("save")}</Text>
            </TouchableOpacity>
            {pinAlreadySet ? <TouchableOpacity onPress={async()=>{
              try{
                await SecureStore.deleteItemAsync("bhumi_app_lock_pin");
                await SecureStore.deleteItemAsync("bhumi_app_biometric_fingerprint");
                await SecureStore.deleteItemAsync("bhumi_app_biometric_face");
                await SecureStore.setItemAsync("bhumi_app_auto_lock","false");
                const saved=await saveSettingsPreferences({"security.appLock":false,"security.pin":false,"security.fingerprint":false,"security.faceUnlock":false});
                setPreferences((current)=>({...current,...saved,"security.appLock":false,"security.pin":false}));
                setPinSetupVisible(false);
                setNotice({title:"App Lock disabled",message:"The device PIN requirement has been removed."});
              }catch(error){setNotice({title:"Could not disable App Lock",message:error?.message||"Please try again."});}
            }} style={{ padding:13,alignItems:"center",marginTop:4 }}>
              <Text style={{ color:"#F08080",fontWeight:"800" }}>Disable App Lock</Text>
            </TouchableOpacity> : null}
            <TouchableOpacity onPress={()=>setPinSetupVisible(false)} style={{ padding:10,alignItems:"center" }}>
              <Text style={{ color:MUTED,fontWeight:"800" }}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={qrVisible && visible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.82)", justifyContent:"center", alignItems:"center", padding:24 }}>
          <View style={{ width:"100%", maxWidth:340, backgroundColor:"#FFFFFF", borderRadius:22, padding:22, alignItems:"center" }}>
            <Text style={{ color:"#111111", fontSize:19, fontWeight:"900" }}>{t("profile")}</Text>
            <Text style={{ color:"#666666", fontSize:12, marginTop:5, marginBottom:18 }}>{t("shareProfileAction")}</Text>
            <Image source={{ uri:"https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=" + encodeURIComponent("bhumisocial://profile/" + (username || "")) }} style={{ width:250, height:250 }} resizeMode="contain" accessibilityLabel="Profile QR code" />
            <Text style={{ color:"#222222", fontWeight:"800", marginTop:12 }}>@{username || "your-profile"}</Text>
            <TouchableOpacity onPress={() => Share.share({ message:"Find me on Bhumi Social AI: bhumisocial://profile/" + (username || "") + "\nGet Bhumi Social AI: https://bhumi-social-app-1.onrender.com/download" })} style={{ backgroundColor:"#0095F6", borderRadius:13, paddingVertical:13, paddingHorizontal:22, marginTop:18, width:"100%", alignItems:"center" }}>
              <Text style={{ color:"#FFFFFF", fontWeight:"900" }}>{t("shareProfileAction")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQrVisible(false)} style={{ padding:13, marginTop:3 }}>
              <Text style={{ color:"#555555", fontWeight:"800" }}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={languageVisible && visible} transparent animationType="slide" onRequestClose={() => setLanguageVisible(false)}>
        <View style={{ flex:1,backgroundColor:"rgba(0,0,0,0.78)",justifyContent:"flex-end" }}>
          <View style={{ maxHeight:"82%",backgroundColor:BG,borderTopLeftRadius:22,borderTopRightRadius:22,borderWidth:1,borderColor:BORDER,padding:18 }}>
            <View style={{ flexDirection:"row",alignItems:"center",marginBottom:8 }}>
              <View style={{ flex:1 }}><Text style={{ color:TEXT,fontSize:19,fontWeight:"900" }}>{t("choose")}</Text><Text style={{ color:MUTED,fontSize:11,marginTop:3 }}>{t("region")}</Text></View>
              <TouchableOpacity onPress={() => setLanguageVisible(false)} style={{ padding:8 }}><Ionicons name="close" size={23} color={TEXT}/></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {APP_LANGUAGES.map((item) => (
                <TouchableOpacity key={item.code} onPress={async () => {
                  try { await SecureStore.setItemAsync("bhumi_app_language",item.code); setSelectedLanguage(item.code); onLanguageChange?.(item.code); setLanguageVisible(false); }
                  catch (error) { setNotice({title:"Could not save language",message:error?.message || "Please try again."}); }
                }} style={{ flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:BORDER }}>
                  <View style={{ flex:1 }}><Text style={{ color:TEXT,fontSize:14,fontWeight:"800" }}>{item.name}{appLanguage === "en" ? "" : " · " + item.native}</Text><Text style={{ color:MUTED,fontSize:10,marginTop:3 }}>{item.region}</Text></View>
                  {selectedLanguage===item.code ? <Ionicons name="checkmark-circle" size={21} color={GOLD}/> : <View style={{ width:20,height:20,borderRadius:10,borderWidth:1,borderColor:BORDER }}/>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ color:MUTED,fontSize:10,lineHeight:15,marginTop:10 }}>{t("selectLanguage")}</Text>
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
              <Text style={{ color:"#FFFFFF", fontSize:13, fontWeight:"900" }}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
