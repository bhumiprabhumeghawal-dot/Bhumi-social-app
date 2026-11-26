import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import { createAudioPlayer, requestRecordingPermissionsAsync } from "expo-audio";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useTracks,
  isTrackReference,
  useLocalParticipant,
  registerGlobals,
} from "@livekit/react-native";
import { Track, VideoPresets } from "livekit-client";
import { translateAppText } from "./localization";

const CALL_LABELS = {
  en: ["Voice call","Video call","VOICE CALL","VIDEO CALL","Incoming call","Answer call","Cancel call","Reconnect","Reconnecting…","Mute","Unmute","Camera","Camera off","End","Call connected.","Connecting call…","Your video","You","Cancel call"],
  hi: ["वॉइस कॉल","वीडियो कॉल","वॉइस कॉल","वीडियो कॉल","आने वाली कॉल","कॉल उठाएँ","कॉल काटें","फिर से कनेक्ट करें","फिर से कनेक्ट हो रहा है…","माइक बंद करें","माइक चालू करें","कैमरा","कैमरा बंद","समाप्त करें","कॉल कनेक्ट हो गई।","कॉल कनेक्ट हो रही है…","आपका वीडियो","आप","कॉल रद्द करें"],
  gu: ["વૉઇસ કૉલ","વિડિયો કૉલ","વૉઇસ કૉલ","વિડિયો કૉલ","આવતો કૉલ","કૉલ ઉપાડો","કૉલ કાપો","ફરીથી કનેક્ટ કરો","ફરીથી કનેક્ટ થઈ રહ્યું છે…","માઇક બંધ","માઇક ચાલુ","કૅમેરા","કૅમેરા બંધ","સમાપ્ત","કૉલ કનેક્ટ થઈ ગયો.","કૉલ કનેક્ટ થઈ રહ્યો છે…","તમારો વિડિયો","તમે","કૉલ રદ કરો"],
  bn: ["ভয়েস কল","ভিডিও কল","ভয়েস কল","ভিডিও কল","ইনকামিং কল","কল ধরুন","কল কেটে দিন","আবার সংযোগ করুন","আবার সংযোগ হচ্ছে…","মাইক বন্ধ","মাইক চালু","ক্যামেরা","ক্যামেরা বন্ধ","শেষ করুন","কল সংযুক্ত হয়েছে।","কল সংযোগ হচ্ছে…","আপনার ভিডিও","আপনি","কল বাতিল করুন"],
  mr: ["व्हॉइस कॉल","व्हिडिओ कॉल","व्हॉइस कॉल","व्हिडिओ कॉल","येणारा कॉल","कॉल उचला","कॉल कट करा","पुन्हा कनेक्ट करा","पुन्हा कनेक्ट होत आहे…","माइक बंद","माइक सुरू","कॅमेरा","कॅमेरा बंद","समाप्त","कॉल जोडला गेला.","कॉल जोडला जात आहे…","तुमचा व्हिडिओ","तुम्ही","कॉल रद्द करा"],
  ta: ["குரல் அழைப்பு","வீடியோ அழைப்பு","குரல் அழைப்பு","வீடியோ அழைப்பு","உள்வரும் அழைப்பு","அழைப்பை ஏற்கவும்","அழைப்பை நிராகரிக்கவும்","மீண்டும் இணைக்கவும்","மீண்டும் இணைக்கிறது…","ஒலிவாங்கியை அணை","ஒலிவாங்கியை இயக்கு","கேமரா","கேமரா அணை","முடி","அழைப்பு இணைக்கப்பட்டது.","அழைப்பு இணைக்கப்படுகிறது…","உங்கள் வீடியோ","நீங்கள்","அழைப்பை ரத்துசெய்"],
  te: ["వాయిస్ కాల్","వీడియో కాల్","వాయిస్ కాల్","వీడియో కాల్","ఇన్‌కమింగ్ కాల్","కాల్ ఆన్సర్ చేయండి","కాల్ కట్ చేయండి","మళ్లీ కనెక్ట్ చేయండి","మళ్లీ కనెక్ట్ అవుతోంది…","మైక్ ఆఫ్","మైక్ ఆన్","కెమెరా","కెమెరా ఆఫ్","ముగించు","కాల్ కనెక్ట్ అయింది.","కాల్ కనెక్ట్ అవుతోంది…","మీ వీడియో","మీరు","కాల్ రద్దు చేయండి"],
  pa: ["ਵੌਇਸ ਕਾਲ","ਵੀਡੀਓ ਕਾਲ","ਵੌਇਸ ਕਾਲ","ਵੀਡੀਓ ਕਾਲ","ਆਉਣ ਵਾਲੀ ਕਾਲ","ਕਾਲ ਚੁੱਕੋ","ਕਾਲ ਕੱਟੋ","ਮੁੜ ਕਨੈਕਟ ਕਰੋ","ਮੁੜ ਕਨੈਕਟ ਹੋ ਰਿਹਾ ਹੈ…","ਮਾਈਕ ਬੰਦ","ਮਾਈਕ ਚਾਲੂ","ਕੈਮਰਾ","ਕੈਮਰਾ ਬੰਦ","ਖਤਮ","ਕਾਲ ਜੁੜ ਗਈ।","ਕਾਲ ਜੁੜ ਰਹੀ ਹੈ…","ਤੁਹਾਡਾ ਵੀਡੀਓ","ਤੁਸੀਂ","ਕਾਲ ਰੱਦ ਕਰੋ"],
  kn: ["ಧ್ವನಿ ಕರೆ","ವೀಡಿಯೊ ಕರೆ","ಧ್ವನಿ ಕರೆ","ವೀಡಿಯೊ ಕರೆ","ಒಳಬರುವ ಕರೆ","ಕರೆ ಸ್ವೀಕರಿಸಿ","ಕರೆ ಕಡಿತಗೊಳಿಸಿ","ಮತ್ತೆ ಸಂಪರ್ಕಿಸಿ","ಮತ್ತೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…","ಮೈಕ್ ಆಫ್","ಮೈಕ್ ಆನ್","ಕ್ಯಾಮೆರಾ","ಕ್ಯಾಮೆರಾ ಆಫ್","ಮುಕ್ತಾಯ","ಕರೆ ಸಂಪರ್ಕಗೊಂಡಿದೆ.","ಕರೆ ಸಂಪರ್ಕಗೊಳ್ಳುತ್ತಿದೆ…","ನಿಮ್ಮ ವೀಡಿಯೊ","ನೀವು","ಕರೆಯನ್ನು ರದ್ದುಗೊಳಿಸಿ"],
  ml: ["വോയ്സ് കോൾ","വീഡിയോ കോൾ","വോയ്സ് കോൾ","വീഡിയോ കോൾ","വരുന്ന കോൾ","കോൾ എടുക്കുക","കോൾ നിരസിക്കുക","വീണ്ടും ബന്ധിപ്പിക്കുക","വീണ്ടും ബന്ധിപ്പിക്കുന്നു…","മൈക്ക് ഓഫ്","മൈക്ക് ഓൺ","ക്യാമറ","ക്യാമറ ഓഫ്","അവസാനിപ്പിക്കുക","കോൾ ബന്ധിപ്പിച്ചു.","കോൾ ബന്ധിപ്പിക്കുന്നു…","നിങ്ങളുടെ വീഡിയോ","നിങ്ങൾ","കോൾ റദ്ദാക്കുക"],
  ur: ["وائس کال","ویڈیو کال","وائس کال","ویڈیو کال","آنے والی کال","کال اٹھائیں","کال ختم کریں","دوبارہ منسلک کریں","دوبارہ منسلک ہو رہا ہے…","مائیک بند","مائیک آن","کیمرہ","کیمرہ بند","ختم","کال منسلک ہو گئی۔","کال منسلک ہو رہی ہے…","آپ کی ویڈیو","آپ","کال منسوخ کریں"],
  es: ["Llamada de voz","Videollamada","LLAMADA DE VOZ","VIDEOLLAMADA","Llamada entrante","Responder","Rechazar","Reconectar","Reconectando…","Silenciar","Activar sonido","Cámara","Cámara apagada","Finalizar","Llamada conectada.","Conectando llamada…","Tu vídeo","Tú","Cancelar llamada"],
  fr: ["Appel vocal","Appel vidéo","APPEL VOCAL","APPEL VIDÉO","Appel entrant","Répondre","Refuser","Reconnecter","Reconnexion…","Couper le micro","Activer le micro","Caméra","Caméra désactivée","Terminer","Appel connecté.","Connexion de l’appel…","Votre vidéo","Vous","Annuler l’appel"],
  ar: ["مكالمة صوتية","مكالمة فيديو","مكالمة صوتية","مكالمة فيديو","مكالمة واردة","رد","رفض","إعادة الاتصال","جارٍ إعادة الاتصال…","كتم الميكروفون","تشغيل الميكروفون","الكاميرا","إيقاف الكاميرا","إنهاء","تم الاتصال.","جارٍ الاتصال…","الفيديو الخاص بك","أنت","إلغاء المكالمة"],
  pt: ["Chamada de voz","Chamada de vídeo","CHAMADA DE VOZ","CHAMADA DE VÍDEO","Chamada recebida","Atender","Recusar","Reconectar","Reconectando…","Silenciar","Ativar som","Câmera","Câmera desligada","Encerrar","Chamada conectada.","Conectando chamada…","Seu vídeo","Você","Cancelar chamada"],
  de: ["Sprachanruf","Videoanruf","SPRACHANRUF","VIDEOANRUF","Eingehender Anruf","Annehmen","Ablehnen","Erneut verbinden","Verbindung wird hergestellt…","Mikrofon stummschalten","Mikrofon aktivieren","Kamera","Kamera aus","Beenden","Anruf verbunden.","Anruf wird verbunden…","Dein Video","Du","Anruf abbrechen"],
  ja: ["音声通話","ビデオ通話","音声通話","ビデオ通話","着信中","応答","拒否","再接続","再接続中…","マイクをミュート","マイクをオン","カメラ","カメラオフ","終了","通話が接続されました。","通話を接続中…","あなたのビデオ","あなた","通話をキャンセル"],
  ko: ["음성 통화","영상 통화","음성 통화","영상 통화","수신 전화","받기","거절","다시 연결","다시 연결 중…","마이크 음소거","마이크 켜기","카메라","카메라 끄기","종료","통화가 연결되었습니다.","통화 연결 중…","내 비디오","나","통화 취소"],
  id: ["Panggilan suara","Panggilan video","PANGGILAN SUARA","PANGGILAN VIDEO","Panggilan masuk","Jawab","Tolak","Hubungkan ulang","Menghubungkan ulang…","Bisukan","Aktifkan suara","Kamera","Kamera mati","Akhiri","Panggilan terhubung.","Menghubungkan panggilan…","Video Anda","Anda","Batalkan panggilan"],
  ru: ["Голосовой звонок","Видеозвонок","ГОЛОСОВОЙ ЗВОНОК","ВИДЕОЗВОНОК","Входящий звонок","Ответить","Отклонить","Переподключить","Переподключение…","Выключить микрофон","Включить микрофон","Камера","Камера выключена","Завершить","Звонок подключён.","Подключение звонка…","Ваше видео","Вы","Отменить звонок"],
  zh: ["语音通话","视频通话","语音通话","视频通话","来电","接听","拒绝","重新连接","正在重新连接…","静音","取消静音","摄像头","摄像头已关闭","结束","通话已连接。","正在连接通话…","你的视频","你","取消通话"],
  tr: ["Sesli arama","Görüntülü arama","SESLİ ARAMA","GÖRÜNTÜLÜ ARAMA","Gelen arama","Yanıtla","Reddet","Yeniden bağlan","Yeniden bağlanıyor…","Mikrofonu kapat","Mikrofonu aç","Kamera","Kamera kapalı","Bitir","Arama bağlandı.","Arama bağlanıyor…","Videonuz","Siz","Aramayı iptal et"],
  th: ["โทรด้วยเสียง","วิดีโอคอล","โทรด้วยเสียง","วิดีโอคอล","สายเรียกเข้า","รับสาย","ปฏิเสธ","เชื่อมต่อใหม่","กำลังเชื่อมต่อใหม่…","ปิดไมค์","เปิดไมค์","กล้อง","ปิดกล้อง","วางสาย","เชื่อมต่อสายแล้ว","กำลังเชื่อมต่อสาย…","วิดีโอของคุณ","คุณ","ยกเลิกสาย"],
  vi: ["Cuộc gọi thoại","Cuộc gọi video","GỌI THOẠI","GỌI VIDEO","Cuộc gọi đến","Trả lời","Từ chối","Kết nối lại","Đang kết nối lại…","Tắt mic","Bật mic","Máy ảnh","Đã tắt máy ảnh","Kết thúc","Đã kết nối cuộc gọi.","Đang kết nối cuộc gọi…","Video của bạn","Bạn","Hủy cuộc gọi"]
};
const callText = (language, key) => {
  const keys = ["voice","video","voiceCaps","videoCaps","incoming","answer","decline","reconnect","reconnecting","mute","unmute","camera","cameraOff","end","connected","connecting","yourVideo","you","cancel"];
  const index = keys.indexOf(key);
  const normalizedLanguage = typeof language === "string" ? language.trim().toLowerCase().split("-")[0] : "en";
  const row = CALL_LABELS[normalizedLanguage] || CALL_LABELS.en;
  return index >= 0 ? row[index] : translateAppText(language, key);
};

import {
  createVoiceVideoCall,
  loadPendingCalls,
  respondToCall,
  getCallConnectionToken,
  getVoiceVideoCallStatus,
} from "./api";

let liveKitGlobalsRegistered = false;
if (!liveKitGlobalsRegistered) {
  try {
    registerGlobals();
    liveKitGlobalsRegistered = true;
  } catch (error) {
    console.warn("LiveKit WebRTC initialization failed:", error?.message || error);
  }
}

function CallAvatarStage({ name, status, connected = false }) {
  const { width, height } = useWindowDimensions();
  const compact = width < 360;
  const avatarSize = Math.max(104, Math.min(compact ? 126 : 154, Math.min(width * 0.42, height * 0.22)));
  const innerSize = avatarSize * 0.86;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#07090D", paddingHorizontal: 18 }}>
      <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, borderWidth: 1, borderColor: "rgba(0,149,246,0.42)", backgroundColor: "rgba(0,149,246,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        <View style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "#202630", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="person" size={avatarSize * 0.4} color="#FFFFFF" />
        </View>
      </View>
      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: Math.min(29, width * 0.075), fontWeight: "700", marginTop: 12, letterSpacing: 0.2, textAlign: "center" }}>{name || "Bhumi Social"}</Text>
      <View style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: "#171B22", borderWidth: 1, borderColor: "#303946", flexDirection: "row", alignItems: "center", gap: 8 }}>
        {connected ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#45D483" }} /> : <ActivityIndicator color="#0095F6" size="small" />}
        <Text style={{ color: "#D1D7E0", fontSize: 12, fontWeight: "600" }}>{status}</Text>
      </View>
    </View>
  );
}

function CallVideoStage({ callType, remoteName, isConnected, appLanguage = "en" }) {
  const { width: videoStageWidth, height: videoStageHeight } = useWindowDimensions();
  const previewWidth = Math.max(76, Math.min(112, videoStageWidth * 0.28));
  const previewHeight = Math.min(previewWidth * 1.41, Math.max(110, videoStageHeight * 0.34));
  const labels = { connected: callText(appLanguage, "connected"), connecting: callText(appLanguage, "connecting") };
  // The React Native LiveKit hook returns local and remote camera references.
  // Keep its documented one-argument form so the local self-preview is included.
  const tracks = useTracks([Track.Source.Camera]);
  const trackReferences = tracks.filter(isTrackReference);
  const { localParticipant } = useLocalParticipant();
  const remoteTracks = trackReferences.filter(
    (item) => item.participant && !item.participant.isLocal &&
      item.participant.sid !== localParticipant?.sid
  );
  const localTracks = trackReferences.filter(
    (item) => item.participant &&
      (item.participant.isLocal || item.participant.sid === localParticipant?.sid)
  );
  // Prefer the local participant's actual camera publication. Some RN LiveKit
  // versions expose local publications through the participant before the
  // useTracks list has refreshed.
  const localCameraPublication = localParticipant?.getTrackPublication?.(Track.Source.Camera);
  const localCameraTrackRef = localCameraPublication?.track
    ? {
        participant: localParticipant,
        source: Track.Source.Camera,
        publication: localCameraPublication,
      }
    : localTracks[0];

  if (callType !== "video") {
    return (
      <CallAvatarStage
        name={remoteName}
        status={isConnected ? labels.connected : labels.connecting}
        connected={isConnected}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000", borderRadius: 22, overflow: "hidden" }}>
      {remoteTracks.length ? (
        remoteTracks.map((track, index) => (
          <VideoTrack key={track.publication?.trackSid || index} trackRef={track} style={{ flex: 1 }} />
        ))
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#121212" }}>
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: "#262626", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="videocam" size={42} color="#FFFFFF" />
          </View>
          <ActivityIndicator color="#0095F6" size="large" style={{ marginTop: 22 }} />
          <Text style={{ color: "#FFFFFF", marginTop: 12, fontSize: 13 }}>{isConnected ? labels.connected : labels.connecting}</Text>
        </View>
      )}
      <View pointerEvents="none" style={{ position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isConnected ? "#45D483" : "#0095F6" }} />
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>{isConnected ? labels.connected : labels.connecting}</Text>
        </View>
        <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{remoteName || callText(appLanguage, "video")}</Text>
        </View>
      </View>
      <View style={{ position: "absolute", right: Math.max(8, videoStageWidth * 0.035), top: Math.max(46, videoStageHeight * 0.09), width: previewWidth, height: previewHeight, overflow: "hidden", borderRadius: 18, borderWidth: 1.5, borderColor: "#FFFFFF", backgroundColor: "#262626", elevation: 8 }}>
        {localCameraTrackRef ? (
          <VideoTrack
            trackRef={localCameraTrackRef}
            style={{ flex: 1, width: "100%", height: "100%" }}
            mirror
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person" size={30} color="#FFFFFF" />
            <ActivityIndicator color="#FFFFFF" size="small" style={{ marginTop: 8 }} />
            <Text style={{ color: "#E5E5E5", fontSize: 9, marginTop: 5 }}>{label("yourVideo")}</Text>
          </View>
        )}
        <View style={{ position: "absolute", left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.62)" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700" }}>{label("you")}</Text>
        </View>
      </View>
    </View>
  );
}
export default function VoiceVideoCallControls({ username, currentUsername = username, enableIncoming = true, enableOutgoing = true, showButtons = true, appLanguage = "en" }) {
  const { width: callWidth, height: callHeight } = useWindowDimensions();
  const callCompact = callWidth < 360;
  const callShort = callHeight < 680;
  const callInset = callWidth < 340 ? 14 : callCompact ? 18 : 22;
  const label = (key) => callText(appLanguage, key);
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(false);
  const [connection, setConnection] = useState(null);
  const [callMessage, setCallMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [roomConnected, setRoomConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const callRef = useRef(null);
  const tokenAttemptedRef = useRef(false);
  const connectionRef = useRef(null);
  const audioSessionActiveRef = useRef(false);
  const ringbackPlayerRef = useRef(null);

  const stopRingbackTone = () => {
    const player = ringbackPlayerRef.current;
    ringbackPlayerRef.current = null;
    if (player) {
      try { player.pause(); } catch (_) {}
      try { player.remove(); } catch (_) {}
      try { player.release(); } catch (_) {}
    }
  };

  // Caller hears a ringback tone until the recipient answers.
  useEffect(() => {
    stopRingbackTone();
    if (!call || incoming || connection || roomConnected) return undefined;
    let player;
    try {
      player = createAudioPlayer({ uri: "https://sfxmint.com/dl/phone-ring-10.mp3" });
      player.loop = true;
      player.volume = 0.7;
      ringbackPlayerRef.current = player;
      player.play();
    } catch (error) {
      console.warn("Call ringback tone could not start:", error?.message || error);
    }
    return () => {
      if (ringbackPlayerRef.current === player) stopRingbackTone();
    };
  }, [call?.id, incoming, connection, roomConnected]);
  const disconnectHandlingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const resetCall = () => {
    setCall(null);
    setIncoming(false);
    setConnection(null);
    setCallMessage("");
    setBusy(false);
    setConnectionFailed(false);
    setRoomConnected(false);
    callRef.current = null;
    connectionRef.current = null;
    tokenAttemptedRef.current = false;
    disconnectHandlingRef.current = false;
    setMicEnabled(true);
    setCameraEnabled(true);
    if (audioSessionActiveRef.current) {
      audioSessionActiveRef.current = false;
      AudioSession.stopAudioSession().catch((error) => {
        console.warn("LiveKit audio session stop failed:", error?.message || error);
      });
    }
  };

  const connectCall = async (callInfo) => {
    disconnectHandlingRef.current = false;
    setBusy(true);
    setConnectionFailed(false);
    setRoomConnected(false);
    setCallMessage(callText(appLanguage, "connecting"));
    try {
      // Fetch the short-lived room token while native audio routing starts.
      // These independent setup steps run together to reduce answer-to-audio delay.
      const [tokenResult, audioResult] = await Promise.allSettled([
        getCallConnectionToken(callInfo.id),
        audioSessionActiveRef.current
          ? Promise.resolve(true)
          : AudioSession.startAudioSession(),
      ]);
      if (audioResult.status === "fulfilled") audioSessionActiveRef.current = true;
      if (tokenResult.status === "rejected") {
        if (audioSessionActiveRef.current) {
          audioSessionActiveRef.current = false;
          await AudioSession.stopAudioSession().catch(() => {});
        }
        throw tokenResult.reason;
      }
      if (audioResult.status === "rejected") throw audioResult.reason;
      const result = tokenResult.value;
      if (!result?.token || !result?.url) {
        if (audioSessionActiveRef.current) {
          audioSessionActiveRef.current = false;
          await AudioSession.stopAudioSession().catch(() => {});
        }
        throw new Error("Call server connection details were not received.");
      }
      if (!mountedRef.current) {
        audioSessionActiveRef.current = false;
        await AudioSession.stopAudioSession();
        return;
      }
      setConnection(result);
      setConnectionFailed(false);
      setCallMessage(callText(appLanguage, "connecting"));
    } catch (error) {
      if (mountedRef.current) {
        setConnectionFailed(true);
        setCallMessage(translateAppText(appLanguage, "alertTryAgain"));
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const ensureCallPermissions = async (type) => {
    const microphonePromise = requestRecordingPermissionsAsync();
    const cameraPromise = type === "video"
      ? (cameraPermission?.granted ? Promise.resolve(cameraPermission) : requestCameraPermission())
      : Promise.resolve({ granted: true });
    const [microphone, camera] = await Promise.all([microphonePromise, cameraPromise]);
    if (!microphone?.granted) throw new Error("Allow microphone access to make a call.");
    if (type === "video" && !camera?.granted) {
      throw new Error("Allow camera access for a video call.");
    }
  };

  const startCall = async (type) => {
    if (!enableOutgoing || !username || busy || callRef.current) return;
    setBusy(true);
    setCallMessage("");
    try {
      await ensureCallPermissions(type);
      tokenAttemptedRef.current = false;
      // Warm the native audio route while the recipient's phone is ringing.
      // This avoids waiting for audio-session setup after the recipient answers.
      const [createdResult] = await Promise.allSettled([
        createVoiceVideoCall(username, type),
        AudioSession.startAudioSession().then(() => {
          audioSessionActiveRef.current = true;
          return true;
        }).catch((error) => {
          console.warn("LiveKit audio prewarm failed:", error?.message || error);
          return false;
        }),
      ]);
      if (createdResult.status === "rejected") throw createdResult.reason;
      const created = createdResult.value;
      if (!mountedRef.current) {
        if (audioSessionActiveRef.current) {
          audioSessionActiveRef.current = false;
          await AudioSession.stopAudioSession().catch(() => {});
        }
        return;
      }
      callRef.current = created;
      setCall(created);
      setIncoming(false);
      setCallMessage(callText(appLanguage, "connecting"));
    } catch (error) {
      if (audioSessionActiveRef.current && !callRef.current) {
        audioSessionActiveRef.current = false;
        await AudioSession.stopAudioSession().catch(() => {});
      }
      if (mountedRef.current) setCallMessage(translateAppText(appLanguage, "alertTryAgain"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (call || !enableIncoming || !currentUsername) return undefined;
    let active = true;
    let timer = null;
    const checkIncoming = async () => {
      if (!active || callRef.current) return;
      try {
        const pending = await loadPendingCalls();
        if (!active || callRef.current) return;
        if (pending.length) {
          const next = pending[0];
          callRef.current = next;
          setCall(next);
          setIncoming(true);
          setCallMessage(next.type === "video" ? `${callText(appLanguage, "incoming")} · ${callText(appLanguage, "video")}` : `${callText(appLanguage, "incoming")} · ${callText(appLanguage, "voice")}`);
          return;
        }
      } catch (error) {
        // Retry after the current request settles; never stack overlapping polls.
      } finally {
        if (active && !callRef.current) timer = setTimeout(checkIncoming, 1000 + Math.floor(Math.random() * 250));
      }
    };
    void checkIncoming();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [call, currentUsername, enableIncoming]);

  useEffect(() => {
    if (!call || incoming || connection || tokenAttemptedRef.current) return undefined;
    let active = true;
    let timer = null;
    let finished = false;
    const checkStatus = async () => {
      if (!active || finished || tokenAttemptedRef.current) return;
      try {
        const latest = await getVoiceVideoCallStatus(call.id);
        if (!active || !latest) return;
        if (latest.status === "accepted" && !tokenAttemptedRef.current) {
          tokenAttemptedRef.current = true;
          await connectCall(latest);
          return;
        }
        if (["rejected", "missed", "ended"].includes(latest.status)) {
          finished = true;
          setCallMessage(latest.status === "rejected" ? callText(appLanguage, "decline") : latest.status === "missed" ? callText(appLanguage, "incoming") : callText(appLanguage, "end"));
          timer = setTimeout(() => { if (active) resetCall(); }, 2200);
          return;
        }
      } catch (error) {
        if (active) setCallMessage(translateAppText(appLanguage, "alertCheckConnection"));
      } finally {
        if (active && !finished && !tokenAttemptedRef.current) timer = setTimeout(checkStatus, 900 + Math.floor(Math.random() * 200));
      }
    };
    void checkStatus();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [call, incoming, connection]);

  // Keep the recipient's ringing screen in sync if the caller cancels,
  // the call expires, or the server marks it missed while this device is ringing.
  useEffect(() => {
    if (!call || !incoming) return undefined;
    let active = true;
    let timer = null;
    const checkIncomingStatus = async () => {
      if (!active || callRef.current?.id !== call.id) return;
      try {
        const latest = await getVoiceVideoCallStatus(call.id);
        if (!active || callRef.current?.id !== call.id) return;
        if (latest && ["rejected", "missed", "ended"].includes(latest.status)) {
          resetCall();
          return;
        }
      } catch (_) {
        // A temporary network failure must not dismiss a valid ringing call.
      } finally {
        if (active && callRef.current?.id === call.id) {
          timer = setTimeout(checkIncomingStatus, 1200);
        }
      }
    };
    void checkIncomingStatus();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [call?.id, incoming]);

  const answerCall = async () => {
    if (!call || busy) return;
    setBusy(true);
    try {
      // Prepare audio routing while the server marks the call accepted.
      // These independent steps used to run one after another, adding avoidable
      // delay after the recipient tapped Answer.
      // Permissions must succeed before the server marks the call accepted.
      // Otherwise a denied mic/camera permission can leave a ghost accepted call.
      await ensureCallPermissions(call.type);
      const [acceptResult, audioResult] = await Promise.allSettled([
        respondToCall(call.id, "accept"),
        audioSessionActiveRef.current
          ? Promise.resolve(true)
          : AudioSession.startAudioSession(),
      ]);
      if (acceptResult.status === "rejected") throw acceptResult.reason;
      if (audioResult.status === "fulfilled") audioSessionActiveRef.current = true;
      const next = acceptResult.value || call;
      tokenAttemptedRef.current = true;
      callRef.current = next;
      setCall(next);
      setIncoming(false);
      await connectCall(next);
    } catch (error) {
      setCallMessage(translateAppText(appLanguage, "alertTryAgain"));
    } finally {
      setBusy(false);
    }
  };

  const declineCall = async () => {
    const current = callRef.current;
    if (!current) return;
    // Dismiss the local ringing UI immediately; server signalling is best-effort
    // and must not make the user wait on a slow or unavailable network.
    void respondToCall(current.id, "reject").catch(() => {});
    resetCall();
  };

  const endCall = async () => {
    const current = callRef.current;
    if (current) {
      // Close controls and release audio locally before waiting on the network.
      void respondToCall(current.id, "end").catch(() => {});
    }
    resetCall();
  };

  const showCallModal = !!call;

  return (
    <>
      {showButtons ? <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 2 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label("voice")}
          disabled={!enableOutgoing || !username || busy || !!call}
          onPress={() => startCall("audio")}
          style={{ width: 32, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", opacity: !enableOutgoing || !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="call-outline" size={23} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label("video")}
          disabled={!enableOutgoing || !username || busy || !!call}
          onPress={() => startCall("video")}
          style={{ width: 32, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", opacity: !enableOutgoing || !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="videocam-outline" size={23} color="#FFFFFF" />
        </TouchableOpacity>
      </View> : null}

      {showButtons && callMessage && !showCallModal ? (
        <View style={{ position: "absolute", top: 54, right: 0, zIndex: 50, backgroundColor: "#262626", padding: 10, borderRadius: 10, maxWidth: 240 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>{callMessage}</Text>
        </View>
      ) : null}

      <Modal visible={showCallModal} animationType="fade" statusBarTranslucent onRequestClose={endCall}>
        <View style={{ flex: 1, backgroundColor: "#07090D", paddingTop: callShort ? 20 : 42, paddingBottom: callShort ? 12 : 24 }}>
          <View pointerEvents="none" style={{ position: "absolute", top: -115, alignSelf: "center", width: Math.min(350, callWidth * 0.9), height: Math.min(350, callWidth * 0.9), borderRadius: Math.min(350, callWidth * 0.9) / 2, backgroundColor: "#10243A", opacity: 0.42 }} />
          <View pointerEvents="none" style={{ position: "absolute", bottom: 110, alignSelf: "center", width: Math.min(300, callWidth * 0.78), height: Math.min(300, callWidth * 0.78), borderRadius: Math.min(300, callWidth * 0.78) / 2, backgroundColor: "#17121F", opacity: 0.34 }} />
          <View style={{ paddingHorizontal: callInset, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#0095F6" }} />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", letterSpacing: 0.2 }}>{call?.type === "video" ? label("video") : label("voice")}</Text>
            </View>
            <TouchableOpacity onPress={endCall} accessibilityLabel={translateAppText(appLanguage, "close")} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#171B22", borderWidth: 1, borderColor: "#303946", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {connection?.token ? (
            <LiveKitRoom
              serverUrl={connection.url}
              token={connection.token}
              connect={true}
              audio={micEnabled}
              video={call?.type === "video" && cameraEnabled}
              onConnected={() => {
                if (mountedRef.current) {
                  setRoomConnected(true);
                  setCallMessage(callText(appLanguage, "connected"));
                }
              }}
              onError={(error) => {
                if (mountedRef.current) {
                  setConnection(null);
                  connectionRef.current = null;
                  setRoomConnected(false);
                  setConnectionFailed(true);
                  setCallMessage(translateAppText(appLanguage, "alertTryAgain"));
                  if (audioSessionActiveRef.current) {
                    audioSessionActiveRef.current = false;
                    AudioSession.stopAudioSession().catch(() => {});
                  }
                }
              }}
              onDisconnected={async () => {
                const activeCall = callRef.current;
                if (!mountedRef.current || !activeCall || disconnectHandlingRef.current) return;
                disconnectHandlingRef.current = true;
                setConnection(null);
                connectionRef.current = null;
                setRoomConnected(false);
                setConnectionFailed(true);
                setCallMessage(translateAppText(appLanguage, "alertCheckConnection"));
                if (audioSessionActiveRef.current) {
                  audioSessionActiveRef.current = false;
                  AudioSession.stopAudioSession().catch(() => {});
                }
                try {
                  const latest = await getVoiceVideoCallStatus(activeCall.id);
                  if (
                    mountedRef.current &&
                    disconnectHandlingRef.current &&
                    callRef.current?.id === activeCall.id &&
                    latest &&
                    ["ended", "rejected", "missed"].includes(latest.status)
                  ) {
                    resetCall();
                  }
                } catch (_) {}
              }}
              options={{
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: {
                  autoGainControl: true,
                  echoCancellation: true,
                  noiseSuppression: true,
                },
                videoCaptureDefaults: {
                  resolution: VideoPresets.h720.resolution,
                },
                publishDefaults: {
                  videoEncoding: VideoPresets.h720.encoding,
                  videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h180],
                  simulcast: true,
                },
              }}
              style={{ flex: 1, marginTop: 18 }}
            >
              <CallVideoStage callType={call?.type} remoteName={incoming ? call?.caller : username} isConnected={roomConnected} appLanguage={appLanguage} />
            </LiveKitRoom>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
              <CallAvatarStage
                name={incoming ? call?.caller : (call?.callee || username)}
                status={callMessage || (incoming ? label("incoming") : label("connecting"))}
                connected={false}
              />
              {busy ? <ActivityIndicator color="#0095F6" size="small" style={{ marginTop: 22 }} /> : null}
              {incoming ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: callCompact ? 8 : 18, marginTop: callShort ? 18 : 36, width: "100%" }}>
                  <TouchableOpacity onPress={declineCall} activeOpacity={0.85} style={{ width: 84, height: 104, alignItems: "center", justifyContent: "flex-start" }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FF3040", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="call" size={25} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                    </View>
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", marginTop: 9 }}>{label("decline")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={answerCall} disabled={busy} activeOpacity={0.85} style={{ width: 84, height: 104, alignItems: "center", justifyContent: "flex-start", opacity: busy ? 0.6 : 1 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#00C86B", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="call" size={25} color="#FFFFFF" />
                    </View>
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", marginTop: 9 }}>{label("answer")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {connectionFailed ? (
                    <TouchableOpacity
                      onPress={() => { tokenAttemptedRef.current = true; void connectCall(call); }}
                      disabled={busy}
                      activeOpacity={0.85}
                      style={{ marginTop: 30, minWidth: 170, minHeight: 54, borderRadius: 18, backgroundColor: "#102A3C", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, opacity: busy ? 0.6 : 1 }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{busy ? label("reconnecting") : label("reconnect")}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={endCall} activeOpacity={0.85} style={{ marginTop: connectionFailed ? 12 : (callShort ? 16 : 36), width: 84, height: 104, alignItems: "center", justifyContent: "flex-start" }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FF3040", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="call" size={25} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                    </View>
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", marginTop: 9 }}>{label("cancel")}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {connection?.token ? (
            <View style={{ marginTop: 10, marginHorizontal: callInset, paddingHorizontal: callCompact ? 10 : 18, paddingTop: 14, paddingBottom: 12, borderRadius: 28, backgroundColor: "#171717", borderWidth: 1, borderColor: "#363636", flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
              <TouchableOpacity onPress={() => setMicEnabled((value) => !value)} accessibilityLabel={micEnabled ? label("mute") : label("unmute")} style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: micEnabled ? "#333333" : "#B83D50", borderWidth: 1, borderColor: "#555555", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={micEnabled ? "mic" : "mic-off"} size={22} color="#FFFFFF" />
                </View>
                <Text style={{ color: "#E5E5E5", fontSize: 10, fontWeight: "600" }}>{micEnabled ? label("mute") : label("unmute")}</Text>
              </TouchableOpacity>
              {call?.type === "video" ? (
                <TouchableOpacity onPress={() => setCameraEnabled((value) => !value)} accessibilityLabel={cameraEnabled ? label("cameraOff") : label("camera")} style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: cameraEnabled ? "#333333" : "#B83D50", borderWidth: 1, borderColor: "#555555", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={22} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "#E5E5E5", fontSize: 10, fontWeight: "600" }}>{cameraEnabled ? label("camera") : label("cameraOff")}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={endCall} accessibilityLabel={label("end")} style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#FF3040", borderWidth: 4, borderColor: "#57212A", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={23} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </View>
                <Text style={{ color: "#F2DCE1", fontSize: 10, fontWeight: "700" }}>{label("end")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
