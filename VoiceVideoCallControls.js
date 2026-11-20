import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import { requestRecordingPermissionsAsync } from "expo-audio";
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  registerGlobals,
} from "@livekit/react-native";
import { Track } from "livekit-client";
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

function LocalCameraBootstrap({ enabled }) {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();

  useEffect(() => {
    if (!enabled || isCameraEnabled) return;
    localParticipant.setCameraEnabled(true).catch((error) => {
      console.warn("LiveKit local camera start failed:", error?.message || error);
    });
  }, [enabled, isCameraEnabled, localParticipant]);

  return null;
}

function CallVideoStage({ callType, remoteName }) {
  // The React Native LiveKit hook returns local and remote camera references.
  // Keep its documented one-argument form so the local self-preview is included.
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant } = useLocalParticipant();
  const remoteTracks = tracks.filter(
    (item) => item.participant && !item.participant.isLocal &&
      item.participant.sid !== localParticipant?.sid
  );
  const localTracks = tracks.filter(
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
        <View style={{ width: 126, height: 126, borderRadius: 63, backgroundColor: "#262626", borderWidth: 1, borderColor: "#3A3A3A", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="person" size={58} color="#FFFFFF" />
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 20 }}>{remoteName}</Text>
        <View style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: "#1F1F1F" }}>
          <Text style={{ color: "#D1D1D1", fontSize: 12 }}>वॉइस कॉल कनेक्ट है</Text>
        </View>
      </View>
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
          <Text style={{ color: "#FFFFFF", marginTop: 12, fontSize: 13 }}>वीडियो कनेक्ट हो रहा है…</Text>
        </View>
      )}
      <View pointerEvents="none" style={{ position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#45D483" }} />
          <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>LIVE</Text>
        </View>
        <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{remoteName || "Video call"}</Text>
        </View>
      </View>
      <View style={{ position: "absolute", right: 14, top: 58, width: 112, height: 158, overflow: "hidden", borderRadius: 18, borderWidth: 1.5, borderColor: "#FFFFFF", backgroundColor: "#262626", elevation: 8 }}>
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
            <Text style={{ color: "#E5E5E5", fontSize: 9, marginTop: 5 }}>आपका वीडियो</Text>
          </View>
        )}
        <View style={{ position: "absolute", left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.62)" }}>
          <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700" }}>You</Text>
        </View>
      </View>
    </View>
  );
}
export default function VoiceVideoCallControls({ username, currentUsername = username, enableIncoming = true, enableOutgoing = true, showButtons = true }) {
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(false);
  const [connection, setConnection] = useState(null);
  const [callMessage, setCallMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const callRef = useRef(null);
  const tokenAttemptedRef = useRef(false);
  const connectionRef = useRef(null);
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
    callRef.current = null;
    connectionRef.current = null;
    tokenAttemptedRef.current = false;
    setMicEnabled(true);
    setCameraEnabled(true);
  };

  const connectCall = async (callInfo) => {
    setBusy(true);
    setCallMessage("कॉल कनेक्ट हो रही है…");
    try {
      const result = await getCallConnectionToken(callInfo.id);
      if (!mountedRef.current) return;
      setConnection(result);
      setCallMessage("कनेक्ट हो गया");
    } catch (error) {
      if (mountedRef.current) setCallMessage(error?.message || "कॉल कनेक्ट नहीं हो पाई।");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const ensureCallPermissions = async (type) => {
    const microphone = await requestRecordingPermissionsAsync();
    if (!microphone?.granted) throw new Error("कॉल के लिए माइक्रोफोन की अनुमति दें।");
    if (type === "video") {
      const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!camera?.granted) throw new Error("वीडियो कॉल के लिए कैमरा की अनुमति दें।");
    }
  };

  const startCall = async (type) => {
    if (!enableOutgoing || !username || busy || callRef.current) return;
    setBusy(true);
    setCallMessage("");
    try {
      await ensureCallPermissions(type);
      tokenAttemptedRef.current = false;
      const created = await createVoiceVideoCall(username, type);
      if (!mountedRef.current) return;
      callRef.current = created;
      setCall(created);
      setIncoming(false);
      setCallMessage("रिंग हो रही है… सामने वाले के जवाब का इंतज़ार करें।");
    } catch (error) {
      if (mountedRef.current) setCallMessage(error?.message || "कॉल शुरू नहीं हो पाई।");
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
          setCallMessage(next.type === "video" ? "आपको वीडियो कॉल आ रही है।" : "आपको वॉइस कॉल आ रही है।");
          return;
        }
      } catch (error) {
        // Retry after the current request settles; never stack overlapping polls.
      } finally {
        if (active && !callRef.current) timer = setTimeout(checkIncoming, 1400);
      }
    };
    void checkIncoming();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [call, currentUsername, enableIncoming]);

  useEffect(() => {
    if (!call || incoming || connection || tokenAttemptedRef.current) return undefined;
    let active = true;
    let timer = null;
    const checkStatus = async () => {
      if (!active || tokenAttemptedRef.current) return;
      try {
        const latest = await getVoiceVideoCallStatus(call.id);
        if (!active || !latest) return;
        if (latest.status === "accepted" && !tokenAttemptedRef.current) {
          tokenAttemptedRef.current = true;
          await connectCall(latest);
          return;
        }
        if (["rejected", "missed", "ended"].includes(latest.status)) {
          setCallMessage(latest.status === "rejected" ? "कॉल अस्वीकार कर दी गई।" : latest.status === "missed" ? "कॉल का जवाब नहीं मिला।" : "कॉल समाप्त हो गई।");
          timer = setTimeout(() => { if (active) resetCall(); }, 2200);
          return;
        }
      } catch (error) {
        if (active) setCallMessage(error?.message || "कॉल की स्थिति नहीं मिल रही।");
      } finally {
        if (active && !tokenAttemptedRef.current) timer = setTimeout(checkStatus, 1200);
      }
    };
    void checkStatus();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [call, incoming, connection]);

  const answerCall = async () => {
    if (!call || busy) return;
    setBusy(true);
    try {
      await ensureCallPermissions(call.type);
      const accepted = await respondToCall(call.id, "accept");
      const next = accepted || call;
      tokenAttemptedRef.current = true;
      callRef.current = next;
      setCall(next);
      setIncoming(false);
      await connectCall(next);
    } catch (error) {
      setCallMessage(error?.message || "कॉल स्वीकार नहीं हो पाई।");
    } finally {
      setBusy(false);
    }
  };

  const declineCall = async () => {
    if (!call) return;
    try { await respondToCall(call.id, "reject"); } catch (_) {}
    resetCall();
  };

  const endCall = async () => {
    const current = callRef.current;
    if (current) {
      try { await respondToCall(current.id, "end"); } catch (_) {}
    }
    resetCall();
  };

  const showCallModal = !!call;

  return (
    <>
      {showButtons ? <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voice call"
          disabled={!enableOutgoing || !username || busy || !!call}
          onPress={() => startCall("audio")}
          style={{ minWidth: 76, height: 48, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center", opacity: !enableOutgoing || !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="call-outline" size={20} color="#FFFFFF" />
          <Text style={{ color: "#E5E5E5", fontSize: 9, fontWeight: "700", marginTop: 2, letterSpacing: 0.6 }}>VOICE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Video call"
          disabled={!enableOutgoing || !username || busy || !!call}
          onPress={() => startCall("video")}
          style={{ minWidth: 76, height: 48, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center", opacity: !enableOutgoing || !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="videocam-outline" size={21} color="#FFFFFF" />
          <Text style={{ color: "#E5E5E5", fontSize: 9, fontWeight: "700", marginTop: 2, letterSpacing: 0.6 }}>VIDEO</Text>
        </TouchableOpacity>
      </View> : null}

      {showButtons && callMessage && !showCallModal ? (
        <View style={{ position: "absolute", top: 54, right: 0, zIndex: 50, backgroundColor: "#262626", padding: 10, borderRadius: 10, maxWidth: 240 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>{callMessage}</Text>
        </View>
      ) : null}

      <Modal visible={showCallModal} animationType="fade" statusBarTranslucent onRequestClose={endCall}>
        <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: 54, paddingBottom: 30 }}>
          <View style={{ position: "absolute", top: -110, alignSelf: "center", width: 330, height: 330, borderRadius: 165, backgroundColor: "#1B1B1B", opacity: 0.72 }} />
          <View style={{ paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#0095F6" }} />
              <Text style={{ color: "#0095F6", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }}>BHUMI SOCIAL • CALL</Text>
            </View>
            <TouchableOpacity onPress={endCall} accessibilityLabel="Close call" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#262626", borderWidth: 1, borderColor: "#363636", alignItems: "center", justifyContent: "center" }}>
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
              onDisconnected={() => { if (mountedRef.current) resetCall(); }}
              options={{ adaptiveStream: true, dynacast: true }}
              style={{ flex: 1, marginTop: 18 }}
            >
              {call?.type === "video" ? <LocalCameraBootstrap enabled={cameraEnabled} /> : null}
              <CallVideoStage callType={call?.type} remoteName={incoming ? call?.caller : username} />
            </LiveKitRoom>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
              <View style={{ width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: "#0095F6", alignItems: "center", justifyContent: "center", backgroundColor: "#171717", shadowColor: "#0095F6", shadowOpacity: 0.22, shadowRadius: 24, elevation: 10 }}>
                <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: "#4A4A4A", backgroundColor: "#262626", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={incoming ? "call" : call?.type === "video" ? "videocam" : "call"} size={48} color="#FFFFFF" />
                </View>
              </View>
              <Text style={{ color: "#FFFFFF", fontSize: 25, fontWeight: "800", marginTop: 28, letterSpacing: 0.2 }}>{incoming ? call?.caller : username}</Text>
              <Text style={{ color: "#BDBDBD", fontSize: 12, marginTop: 7, letterSpacing: 1.5 }}>{call?.type === "video" ? "VIDEO CALL" : "VOICE CALL"}</Text>
              <View style={{ marginTop: 20, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 22, backgroundColor: "#1F1F1F", borderWidth: 1, borderColor: "#363636" }}>
                <Text style={{ color: "#D1D1D1", fontSize: 12, textAlign: "center" }}>{callMessage || (incoming ? "आपको कॉल आ रही है" : "रिंग हो रही है…")}</Text>
              </View>
              {busy ? <ActivityIndicator color="#0095F6" size="small" style={{ marginTop: 22 }} /> : null}
              {incoming ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 48, width: "100%" }}>
                  <TouchableOpacity onPress={declineCall} activeOpacity={0.85} style={{ width: 132, minHeight: 92, borderRadius: 22, backgroundColor: "#28131D", borderWidth: 1, borderColor: "#9A4054", alignItems: "center", justifyContent: "center", paddingVertical: 13 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#B83D50", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="call" size={22} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                    </View>
                    <Text style={{ color: "#F4DDE2", fontSize: 12, fontWeight: "800", marginTop: 8 }}>कॉल कैंसल</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={answerCall} disabled={busy} activeOpacity={0.85} style={{ width: 132, minHeight: 92, borderRadius: 22, backgroundColor: "#10271F", borderWidth: 1, borderColor: "#3D9A70", alignItems: "center", justifyContent: "center", paddingVertical: 13, opacity: busy ? 0.6 : 1 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#159A65", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="call" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={{ color: "#D9F5E7", fontSize: 12, fontWeight: "800", marginTop: 8 }}>कॉल रिसीव</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={endCall} activeOpacity={0.85} style={{ marginTop: 48, width: 156, minHeight: 88, borderRadius: 22, backgroundColor: "#28131D", borderWidth: 1, borderColor: "#9A4054", alignItems: "center", justifyContent: "center", paddingVertical: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#B83D50", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="call" size={22} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </View>
                  <Text style={{ color: "#F4DDE2", fontSize: 12, fontWeight: "800", marginTop: 7 }}>कॉल कैंसल करें</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {connection?.token ? (
            <View style={{ marginTop: 16, marginHorizontal: 22, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, borderRadius: 28, backgroundColor: "#171717", borderWidth: 1, borderColor: "#363636", flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
              <TouchableOpacity onPress={() => setMicEnabled((value) => !value)} accessibilityLabel={micEnabled ? "Mute microphone" : "Unmute microphone"} style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: micEnabled ? "#333333" : "#B83D50", borderWidth: 1, borderColor: "#555555", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={micEnabled ? "mic" : "mic-off"} size={22} color="#FFFFFF" />
                </View>
                <Text style={{ color: "#E5E5E5", fontSize: 10, fontWeight: "600" }}>{micEnabled ? "Mute" : "Unmute"}</Text>
              </TouchableOpacity>
              {call?.type === "video" ? (
                <TouchableOpacity onPress={() => setCameraEnabled((value) => !value)} accessibilityLabel={cameraEnabled ? "Turn camera off" : "Turn camera on"} style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: cameraEnabled ? "#333333" : "#B83D50", borderWidth: 1, borderColor: "#555555", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={22} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: "#E5E5E5", fontSize: 10, fontWeight: "600" }}>{cameraEnabled ? "Camera" : "Camera off"}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={endCall} accessibilityLabel="End call" style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#E3445B", borderWidth: 4, borderColor: "#512633", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={23} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </View>
                <Text style={{ color: "#F2DCE1", fontSize: 10, fontWeight: "700" }}>End</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

