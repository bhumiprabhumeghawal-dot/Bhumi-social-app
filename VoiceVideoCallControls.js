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

  const startCall = async (type) => {
    if (!enableOutgoing || !username || busy || callRef.current) return;
    setBusy(true);
    setCallMessage("");
    try {
      const microphone = await requestRecordingPermissionsAsync();
      if (!microphone?.granted) throw new Error("कॉल के लिए माइक्रोफोन की अनुमति दें।");
      if (type === "video") {
        const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
        if (!camera?.granted) throw new Error("वीडियो कॉल के लिए कैमरा की अनुमति दें।");
      }
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voice call"
          disabled={!username || busy || !!call}
          onPress={() => startCall("audio")}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#19131F", borderWidth: 1, borderColor: "#3B2B4B", alignItems: "center", justifyContent: "center", opacity: !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="call-outline" size={21} color="#D8B86A" />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Video call"
          disabled={!username || busy || !!call}
          onPress={() => startCall("video")}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#19131F", borderWidth: 1, borderColor: "#3B2B4B", alignItems: "center", justifyContent: "center", opacity: !username || busy || call ? 0.55 : 1 }}
        >
          <Ionicons name="videocam-outline" size={22} color="#D8B86A" />
        </TouchableOpacity>
      </View>

      {callMessage && !showCallModal ? (
        <View style={{ position: "absolute", top: 54, right: 0, zIndex: 50, backgroundColor: "#241B30", padding: 10, borderRadius: 10, maxWidth: 240 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12 }}>{callMessage}</Text>
        </View>
      ) : null}

      <Modal visible={showCallModal} animationType="slide" onRequestClose={endCall}>
        <View style={{ flex: 1, backgroundColor: "#08050D", paddingTop: 50, paddingBottom: 30 }}>
          <View style={{ paddingHorizontal: 22, paddingBottom: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>{call?.type === "video" ? "वीडियो कॉल" : "वॉइस कॉल"}</Text>
              <Text style={{ color: "#B9AFC4", fontSize: 12, marginTop: 4 }}>{incoming ? "इनकमिंग कॉल" : username}</Text>
            </View>
            <TouchableOpacity onPress={endCall} accessibilityLabel="Close call">
              <Ionicons name="close-circle" size={30} color="#FFFFFF" />
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
              style={{ flex: 1 }}
            >
              <CallVideoStage callType={call?.type} remoteName={incoming ? call?.caller : username} />
            </LiveKitRoom>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
              <View style={{ width: 116, height: 116, borderRadius: 58, backgroundColor: "#241B30", borderWidth: 1, borderColor: "#D8B86A", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={incoming ? "call" : call?.type === "video" ? "videocam" : "call"} size={48} color="#D8B86A" />
              </View>
              <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 22 }}>{incoming ? call?.caller : username}</Text>
              <Text style={{ color: "#C5B8D2", fontSize: 14, marginTop: 10, textAlign: "center" }}>{callMessage || (incoming ? "आपको कॉल आ रही है" : "रिंग हो रही है…")}</Text>
              {busy ? <ActivityIndicator color="#D8B86A" size="large" style={{ marginTop: 20 }} /> : null}
              {incoming ? (
                <View style={{ flexDirection: "row", gap: 28, marginTop: 42 }}>
                  <TouchableOpacity onPress={declineCall} style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: "#D83B52", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={answerCall} disabled={busy} style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: "#1DAD69", alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
                    <Ionicons name="call" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={endCall} style={{ marginTop: 42, width: 66, height: 66, borderRadius: 33, backgroundColor: "#D83B52", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {connection?.token ? (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 28, paddingTop: 20 }}>
              <TouchableOpacity onPress={() => setMicEnabled((value) => !value)} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: micEnabled ? "#30263A" : "#D83B52", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={micEnabled ? "mic" : "mic-off"} size={23} color="#FFFFFF" />
              </TouchableOpacity>
              {call?.type === "video" ? (
                <TouchableOpacity onPress={() => setCameraEnabled((value) => !value)} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: cameraEnabled ? "#30263A" : "#D83B52", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={23} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={endCall} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#D83B52", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={23} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
