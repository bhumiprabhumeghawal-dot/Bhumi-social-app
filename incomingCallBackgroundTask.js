import { AppState, Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import RNCallKeep from "react-native-callkeep";

const TASK_NAME = "BHUMI_INCOMING_CALL_BACKGROUND";

function parseIncomingCallPayload(taskData) {
  if (!taskData || typeof taskData !== "object") return null;
  let payload = taskData;
  if (typeof taskData.data?.dataString === "string") {
    try {
      payload = JSON.parse(taskData.data.dataString);
    } catch (_) {
      return null;
    }
  } else if (taskData.notification?.request?.content?.data) {
    payload = taskData.notification.request.content.data;
  }
  if (payload?.data && typeof payload.data === "object") payload = payload.data;
  if (payload?.type !== "incoming_call_headless") return null;
  if (!payload.callId || !payload.caller) return null;
  return payload;
}

function callUuid(callId) {
  const raw = String(callId).replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (raw.length === 32) {
    return raw.slice(0, 8) + "-" + raw.slice(8, 12) + "-" +
      raw.slice(12, 16) + "-" + raw.slice(16, 20) + "-" + raw.slice(20);
  }
  let hash = 2166136261;
  for (const char of String(callId)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  const tail = (String(callId).replace(/[^a-z0-9]/gi, "").toLowerCase() + hex)
    .padEnd(24, "0").slice(0, 24);
  return hex + "-0000-4000-8000-" + tail.slice(0, 12);
}

if (Platform.OS === "android" && !TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error) return;
    // Foreground call polling owns the UI while the app is open.
    if (AppState.currentState === "active") return;
    const payload = parseIncomingCallPayload(data);
    if (!payload) return;

    const uuid = callUuid(payload.callId);
    const caller = String(payload.caller).replace(/^@/, "").slice(0, 80) || "Bhumi Social";
    const isVideo = String(payload.callType || payload.type || "").toLowerCase() === "video";

    try {
      // CallKeep is initialized during the user's normal signed-in app session.
      // A headless notification wakes this JS task after Android terminates the UI process.
      await RNCallKeep.displayIncomingCall(uuid, caller, caller, "generic", isVideo);
    } catch (displayError) {
      console.warn("Background incoming call UI failed:", displayError?.message || displayError);
    }
  });

  Notifications.registerTaskAsync(TASK_NAME).catch((error) => {
    console.warn("Background call task registration failed:", error?.message || error);
  });
}
