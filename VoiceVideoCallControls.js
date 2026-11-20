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

function CallVideoStage({ callType, remoteName }) {
  const tracks = useTracks([Track.Source.Camera]);
  const remoteTracks = tracks.filter((item) => item.participant && !item.participant.isLocal);
  const localTracks = tracks.filter((item) => item.participant && item.participant.isLocal);

  if (callType !== "video") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: "#241B30", borderWidth: 1, borderColor: "#D8B86A", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="person" size={52} color="#D8B86A" />
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 18 }}>{remoteName}</Text>
        <Text style={{ color: "#B9AFC4", marginTop: 8 }}>वॉइस कॉल कनेक्ट है</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#08050D" }}>
      {remoteTracks.length ? (
        remoteTracks.map((track, index) => (
          <VideoTrack key={track.publication?.trackSid || index} trackRef={track} style={{ flex: 1 }} />
        ))
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#D8B86A" size="large" />
          <Text style={{ color: "#FFFFFF", marginTop: 14 }}>दूसरे व्यक्ति का कैमरा जुड़ रहा है…</Text>
        </View>
      )}
      {localTracks.length ? (
        <View style={{ position: "absolute", right: 16, top: 18, width: 104, height: 150, overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: "#D8B86A" }}>
          <VideoTrack trackRef={localTracks[0]} style={{ flex: 1 }} />
        </View>
      ) : null}
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
    const checkIncoming = async () => {
      if (callRef.current) return;
      try {
        const pending = await loadPendingCalls();
        if (!active || callRef.current || !pending.length) return;
        const next = pending[0];
        callRef.current = next;
        setCall(next);
        setIncoming(true);
        setCallMessage(next.type === "video" ? "आपको वीडियो कॉल आ रही है।" : "आपको वॉइस कॉल आ रही है।");
      } catch (error) {
        // Keep polling quietly; temporary network errors should not interrupt chat.
      }
    };
    checkIncoming();
    const timer = setInterval(checkIncoming, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [call, currentUsername, enableIncoming]);

  useEffect(() => {
    if (!call || incoming || connection || tokenAttemptedRef.current) return undefined;
    let active = true;
    const checkStatus = async () => {
      try {
        const latest = await getVoiceVideoCallStatus(call.id);
        if (!active || !latest) return;
        if (latest.status === "accepted" && !tokenAttemptedRef.current) {
          tokenAttemptedRef.current = true;
          await connectCall(latest);
        } else if (["rejected", "missed", "ended"].includes(latest.status)) {
          setCallMessage(latest.status === "rejected" ? "कॉल अस्वीकार कर दी गई।" : latest.status === "missed" ? "कॉल का जवाब नहीं मिला।" : "कॉल समाप्त हो गई।");
          setTimeout(() => { if (active) resetCall(); }, 2200);
        }
      } catch (error) {
        if (active) setCallMessage(error?.message || "कॉल की स्थिति नहीं मिल रही।");
      }
    };
    const timer = setInterval(checkStatus, 2200);
    checkStatus();
    return () => { active = false; clearInterval(timer); };
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
          style={{ minWidth: 76, height: 48, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#19131F", borderWidth: 1, borderColor: "#80683D", alignItems: "center", justifyContent: "center", opacity: !enableOutgoing || !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="call-outline" size={20} color="#E2C477" />
          <Text style={{ color: "#E9D7A7", fontSize: 9, fontWeight: "700", marginTop: 2, letterSpacing: 0.6 }}>VOICE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Video call"
          disabled={!enableOutgoing || !username || busy || !!call}
          onPress={() => startCall("video")}
          style={{ minWidth: 76, height: 48, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#19131F", borderWidth: 1, borderColor: "#80683D", alignItems: "center", justifyContent: "center", opacity: !enableOutgoing || !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="videocam-outline" size={21} color="#E2C477" />
          <Text style={{ color: "#E9D7A7", fontSize: 9, fontWeight: "700", marginTop: 2, letterSpacing: 0.6 }}>VIDEO</Text>
        </TouchableOpacity>
      </View> : null}

      {showButtons && callMessage && !showCallModal ? (
        <View style={{ position: "absolute", top: 54, right: 0, zIndex: 50, backgroundColor: "#241B30", padding: 10, borderRadius: 10, maxWidth: 240 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>{callMessage}</Text>
        </View>
      ) : null}

      <Modal visible={showCallModal} animationType="fade" statusBarTranslucent onRequestClose={endCall}>
        <View style={{ flex: 1, backgroundColor: "#090710", paddingTop: 54, paddingBottom: 30 }}>
          <View style={{ position: "absolute", top: -110, alignSelf: "center", width: 330, height: 330, borderRadius: 165, backgroundColor: "#21152D", opacity: 0.72 }} />
          <View style={{ paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#D8B86A" }} />
              <Text style={{ color: "#D8B86A", fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>BHUMI • PRIVATE CALL</Text>
            </View>
            <TouchableOpacity onPress={endCall} accessibilityLabel="Close call" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#211B2A", borderWidth: 1, borderColor: "#40334B", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chevron-down" size={22} color="#EDE6F2" />
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
              <CallVideoStage callType={call?.type} remoteName={incoming ? call?.caller : username} />
            </LiveKitRoom>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
              <View style={{ width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: "#80683D", alignItems: "center", justifyContent: "center", backgroundColor: "#17111F", shadowColor: "#D8B86A", shadowOpacity: 0.22, shadowRadius: 24, elevation: 10 }}>
                <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: "#4D3C59", backgroundColor: "#251B30", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={incoming ? "call" : call?.type === "video" ? "videocam" : "call"} size={48} color="#E2C477" />
                </View>
              </View>
              <Text style={{ color: "#F8F4FA", fontSize: 25, fontWeight: "800", marginTop: 28, letterSpacing: 0.2 }}>{incoming ? call?.caller : username}</Text>
              <Text style={{ color: "#B9AFC4", fontSize: 12, marginTop: 7, letterSpacing: 1.5 }}>{call?.type === "video" ? "VIDEO CALL" : "VOICE CALL"}</Text>
              <View style={{ marginTop: 20, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 22, backgroundColor: "#1C1723", borderWidth: 1, borderColor: "#44364F" }}>
                <Text style={{ color: "#D9CBAE", fontSize: 12, textAlign: "center" }}>{callMessage || (incoming ? "आपको कॉल आ रही है" : "रिंग हो रही है…")}</Text>
              </View>
              {busy ? <ActivityIndicator color="#D8B86A" size="small" style={{ marginTop: 22 }} /> : null}
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
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20, paddingTop: 18, paddingBottom: 8 }}>
              <TouchableOpacity onPress={() => setMicEnabled((value) => !value)} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: micEnabled ? "#282131" : "#B83D50", borderWidth: 1, borderColor: "#51435D", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={micEnabled ? "mic" : "mic-off"} size={23} color="#F5EFF8" />
              </TouchableOpacity>
              {call?.type === "video" ? (
                <TouchableOpacity onPress={() => setCameraEnabled((value) => !value)} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: cameraEnabled ? "#282131" : "#B83D50", borderWidth: 1, borderColor: "#51435D", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={23} color="#F5EFF8" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={endCall} style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: "#B83D50", borderWidth: 4, borderColor: "#4A2734", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
