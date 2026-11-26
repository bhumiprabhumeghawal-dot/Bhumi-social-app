import { Platform } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
const API_BASE_URL = 'https://bhumi-social-app-1.onrender.com';

const withAbsoluteAvatar = (item) => {
  if (!item || typeof item !== "object") return item;
  const next = { ...item };
  for (const key of ["avatarUrl", "senderAvatarUrl", "recipientAvatarUrl", "profilePicture", "avatar"]) {
    const value = next[key];
    if (typeof value === "string" && value.trim() && !/^https?:\/\//i.test(value)) {
      next[key] = `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
    }
  }
  return next;
};

const AUTH_TOKEN_KEY = 'socialapp_auth_token';
const AUTH_USERNAME_KEY = 'socialapp_auth_username';

// Keep the bearer token in memory after the first secure read. SecureStore I/O
// on every API request adds avoidable latency, especially during parallel loads.
let authTokenMemory = null;
let authUsernameMemory = null;
let authSessionLoaded = false;
let authSessionLoadPromise = null;
let authSessionRevision = 0;

async function getCachedAuthToken() {
  const session = await getAuthSession();
  return session?.token || null;
}

export async function saveAuthSession(token, username) {
  authSessionRevision += 1;
  authTokenMemory = token || null;
  authUsernameMemory = username || null;
  authSessionLoaded = true;
  await Promise.all([
    SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
    SecureStore.setItemAsync(AUTH_USERNAME_KEY, username),
  ]);
}

export async function clearAuthSession() {
  authSessionRevision += 1;
  authTokenMemory = null;
  authUsernameMemory = null;
  authSessionLoaded = true;
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
    SecureStore.deleteItemAsync(AUTH_USERNAME_KEY),
  ]);
}

export async function getAuthSession() {
  if (authSessionLoaded) {
    return authTokenMemory && authUsernameMemory
      ? { token: authTokenMemory, username: authUsernameMemory }
      : null;
  }
  if (!authSessionLoadPromise) {
    const revision = authSessionRevision;
    authSessionLoadPromise = Promise.all([
      SecureStore.getItemAsync(AUTH_TOKEN_KEY),
      SecureStore.getItemAsync(AUTH_USERNAME_KEY),
    ]).then(([token, username]) => {
      if (revision !== authSessionRevision) {
        return authTokenMemory && authUsernameMemory
          ? { token: authTokenMemory, username: authUsernameMemory }
          : null;
      }
      authTokenMemory = token || null;
      authUsernameMemory = username || null;
      authSessionLoaded = true;
      return token && username ? { token, username } : null;
    }).finally(() => { authSessionLoadPromise = null; });
  }
  return authSessionLoadPromise;
}

async function authHeaders(extra = {}) {
  const session = await getAuthSession();
  return {
    ...extra,
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}


export async function registerAccount(username, password, phoneNumber, email, fullName) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Name': `${Platform.OS} device ${Platform.Version}` },
    body: JSON.stringify({
      username: username.trim(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone_number: phoneNumber.trim(),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Registration failed.');
  await saveAuthSession(data.token, data.username);
  return data;
}

export async function loginAccount(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Name': `${Platform.OS} device ${Platform.Version}` },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed.');
  await saveAuthSession(data.token, data.username);
  return data;
}

export async function verifyAuthSession() {
  const session = await getAuthSession();
  if (!session?.token) {
    return { valid: false, reason: 'missing_token' };
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.token}` },
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  return response.ok
    ? { valid: true, username: data.username }
    : { valid: false, status: response.status, reason: data.error || 'Token rejected' };
}

export async function logoutAccount() {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
  } finally {
    await clearAuthSession();
  }
}

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const urlText = String(url);
  const isUpload = /upload|media/i.test(urlText);
  // Render free instances can take about a minute to wake from idle; local cache keeps the UI visible while the request is allowed to finish.
  const timeoutMs = isUpload ? 120000 : 75000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init.headers || {});
    const token = await getCachedAuthToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      headers.delete('Authorization');
    }

    const response = await originalFetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(isUpload
        ? 'The upload is taking longer than expected. Please try again.'
        : 'The server is taking longer than expected to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};


// Start waking the API as soon as the app launches. This is deliberately
// non-blocking so cached UI and secure-session restoration are never held up.
let serverWarmupPromise = null;
export function warmUpServer() {
  if (serverWarmupPromise) return serverWarmupPromise;
  serverWarmupPromise = fetch(`${API_BASE_URL}/api/health`, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      serverWarmupPromise = null;
    });
  return serverWarmupPromise;
}


export async function loadAccountSettings() {
  const response = await fetch(`${API_BASE_URL}/api/account/settings`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load account settings.');
  return data;
}

export async function saveAccountSettings(email, phoneNumber) {
  const response = await fetch(`${API_BASE_URL}/api/account/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), phone_number: phoneNumber.trim() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save account settings.');
  return data;
}

export async function loadNotificationPreference() {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load notification settings.');
  return data.enabled;
}

export async function saveNotificationPreference(enabled) {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enabled }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save notification settings.');
  return data.enabled;
}

export async function loadNotificationDetails() {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications/details`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load notification details.');
  return data;
}

export async function saveNotificationDetails(preferences) {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications/details`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(preferences),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save notification details.');
  return data;
}

export async function checkServer() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`Server status: ${response.status}`);
  }
  return response.json();
}

const CONTENT_CACHE_PREFIX = 'socialapp-content-cache-v1-';

async function contentCachePath(type) {
  const session = await getAuthSession();
  const accountScope = session?.username ? encodeURIComponent(session.username.toLowerCase()) : "guest";
  return `${FileSystem.documentDirectory}${CONTENT_CACHE_PREFIX}${accountScope}-${type}.json`;
}

export async function getCachedContent(type) {
  if (!['posts', 'stories', 'reels'].includes(type)) return null;
  try {
    // Remove legacy unscoped cache files so one signed-in account cannot see
    // another account's previously cached private feed.
    const legacyPath = `${FileSystem.documentDirectory}${CONTENT_CACHE_PREFIX}${type}.json`;
    await FileSystem.deleteAsync(legacyPath, { idempotent: true }).catch(() => {});
    const path = await contentCachePath(type);
    const raw = await FileSystem.readAsStringAsync(path);
    const cached = JSON.parse(raw);
    return Array.isArray(cached.items) ? cached.items : null;
  } catch (error) {
    return null;
  }
}

async function saveCachedContent(type, items) {
  if (!['posts', 'stories', 'reels'].includes(type)) return;
  try {
    const path = await contentCachePath(type);
    await FileSystem.writeAsStringAsync(
      path,
      JSON.stringify({ savedAt: Date.now(), items })
    );
  } catch (error) {
    console.log('CONTENT_CACHE_SAVE_ERROR:', type, error?.message);
  }
}

const CONTENT_REQUESTS_IN_FLIGHT = new Map();
const CONTENT_MEMORY_CACHE = new Map();
const CONTENT_CACHE_TTL_MS = 60 * 1000;
const UPLOAD_REQUESTS_IN_FLIGHT = new Map();

async function loadContentOnce(type) {
  const response = await fetch(`${API_BASE_URL}/api/${type}`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(`Could not load ${type}`);
  }

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Invalid server response while loading ${type}.`);
  }
  // Treat malformed/partial API payloads as an empty list instead of allowing
  // a bad row or non-string media URL to crash the feed renderer on Android.
  const items = Array.isArray(data?.items) ? data.items : [];

  const normalizedItems = items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const avatar = typeof item.avatarUrl === "string" ? item.avatarUrl : "";
      const media = typeof item.mediaUrl === "string" ? item.mediaUrl : "";
      return {
        ...item,
        id: item.id == null ? null : item.id,
        user: typeof item.user === "string" ? item.user : "you",
        caption: typeof item.caption === "string" ? item.caption : "",
        type: typeof item.type === "string" ? item.type : type,
        mediaType: typeof item.mediaType === "string" ? item.mediaType : "image",
        avatarUrl: avatar
          ? (avatar.startsWith("http") ? avatar : `${API_BASE_URL}${avatar.startsWith("/") ? "" : "/"}${avatar}`)
          : null,
        uri: media
          ? (media.startsWith("http") ? media : `${API_BASE_URL}${media.startsWith("/") ? "" : "/"}${media}`)
          : null,
        likes: item.likes ?? "0",
        mediaItems: Array.isArray(item.mediaItems) ? item.mediaItems : undefined,
      };
    });
  void saveCachedContent(type, normalizedItems);
  return normalizedItems;
}
export async function loadContent(type, options = {}) {
  if (!['posts', 'stories', 'reels'].includes(type)) {
    return loadContentOnce(type);
  }
  const session = await getAuthSession();
  const cacheKey = `${session?.username?.toLowerCase() || "guest"}:${type}`;
  const forceRefresh = options?.force === true;
  const cached = CONTENT_MEMORY_CACHE.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.savedAt < CONTENT_CACHE_TTL_MS) {
    return cached.items;
  }
  const pending = CONTENT_REQUESTS_IN_FLIGHT.get(cacheKey);
  if (pending) return pending;
  const request = loadContentOnce(type).then((items) => {
    CONTENT_MEMORY_CACHE.set(cacheKey, { items, savedAt: Date.now() });
    return items;
  }).finally(() => {
    if (CONTENT_REQUESTS_IN_FLIGHT.get(cacheKey) === request) {
      CONTENT_REQUESTS_IN_FLIGHT.delete(cacheKey);
    }
  });
  CONTENT_REQUESTS_IN_FLIGHT.set(cacheKey, request);
  return request;
}

async function uploadContentOnce(type, asset, caption = '', groupId = '') {
  const extension = (
    asset.fileName || asset.uri || ''
  ).split('.').pop().split('?')[0].toLowerCase();

  const fallbackExtension = type === 'reels' ? 'mp4' : 'jpg';
  const fileExtension = /^[a-z0-9]+$/.test(extension)
    ? extension
    : fallbackExtension;

  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  };

  const authSession = await getAuthSession();
  const result = await FileSystem.uploadAsync(
    `${API_BASE_URL}/api/${type}`,
    asset.uri,
    {
      httpMethod: 'POST',
      headers: {
        ...(authSession ? { Authorization: `Bearer ${authSession.token}` } : {}),
        ...(groupId ? { 'X-Post-Group-Id': groupId } : {}),
      },

      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mimeTypes[fileExtension] ||
        (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      parameters: {
        caption,
        username: authSession?.username || 'you',
        group_id: groupId,
      },
    }
  );

  let data;
  try {
    data = JSON.parse(result.body);
  } catch {
    throw new Error(`Could not read the server response (HTTP ${result.status})`);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(data.error || `Upload failed: ${result.status}`);
  }

  const item = data.item;
  if (!item) {
    throw new Error('The server did not return upload details.');
  }

  return {
    ...item,
    uri: item.mediaUrl ? `${API_BASE_URL}${item.mediaUrl}` : null,
    likes: '0',
  };
}



export async function deleteContent(type, contentId) {
  if (!['posts', 'stories', 'reels'].includes(type)) {
    throw new Error('Invalid content type.');
  }
  const id = Number(contentId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('This content cannot be deleted.');
  }
  const response = await fetch(`${API_BASE_URL}/api/${type}/${id}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not delete the content.');

  CONTENT_MEMORY_CACHE.delete(type);
  CONTENT_REQUESTS_IN_FLIGHT.delete(type);
  try {
    const items = await getCachedContent(type);
    if (Array.isArray(items)) {
      await saveCachedContent(type, items.filter(item => String(item.id) !== String(id)));
    }
  } catch (_) {}
  return data;
}

export function uploadContent(type, asset, caption = '', groupId = '') {
  const uri = String(asset?.uri || '');
  const key = [type, uri, caption].join('|');
  const pending = UPLOAD_REQUESTS_IN_FLIGHT.get(key);
  if (pending) return pending;

  const request = uploadContentOnce(type, asset, caption, groupId).finally(() => {
    if (UPLOAD_REQUESTS_IN_FLIGHT.get(key) === request) {
      UPLOAD_REQUESTS_IN_FLIGHT.delete(key);
    }
  });
  UPLOAD_REQUESTS_IN_FLIGHT.set(key, request);
  return request;
}


// SOCIALAPP_PROFILE_CLIENT_API_V1
const PROFILE_CACHE_PREFIX = 'socialapp-profile-cache-v1-';

function profileCachePath(username, viewer) {
  const key = encodeURIComponent(`${username}::${viewer}`);
  return `${FileSystem.documentDirectory}${PROFILE_CACHE_PREFIX}${key}.json`;
}

export async function getCachedProfile(username = 'you', viewer = 'you') {
  try {
    const raw = await FileSystem.readAsStringAsync(profileCachePath(username, viewer));
    const cached = JSON.parse(raw);
    return cached?.profile ? cached : null;
  } catch (error) {
    return null;
  }
}

async function saveCachedProfile(username, viewer, data) {
  try {
    await FileSystem.writeAsStringAsync(
      profileCachePath(username, viewer),
      JSON.stringify({ ...data, cachedAt: Date.now() })
    );
  } catch (error) {
    console.log('PROFILE_CACHE_SAVE_ERROR:', error?.message);
  }
}

export async function loadProfile(username = 'you', viewer = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}?viewer=${encodeURIComponent(viewer)}`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load the profile.');
  if (data.profile?.avatarUrl && !data.profile.avatarUrl.startsWith('http')) {
    data.profile.avatarUrl = `${API_BASE_URL}${data.profile.avatarUrl}`;
  }
  await saveCachedProfile(username, viewer, data);
  return data;
}

export async function loadProfilePosts(username, viewer = '', pageSize = 100) {
  const normalizedUsername = String(username || '').trim().replace(/^@/, '');
  if (!normalizedUsername) throw new Error('Username not found.');

  const limit = Math.min(Math.max(Number(pageSize) || 100, 1), 100);
  const items = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const query = new URLSearchParams({
      viewer: String(viewer || ''),
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(
      `${API_BASE_URL}/api/profile/${encodeURIComponent(normalizedUsername)}/posts?${query.toString()}`,
      { headers: await authHeaders() }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load profile posts.');

    const pageItems = Array.isArray(data.items) ? data.items : [];
    items.push(...pageItems);
    hasMore = Boolean(data.hasMore);
    offset = Number(data.nextOffset ?? (offset + pageItems.length));
    if (!pageItems.length) break;
  }

  return items.map(item => ({
    ...item,
    avatarUrl: item.avatarUrl
      ? (item.avatarUrl.startsWith('http') ? item.avatarUrl : API_BASE_URL + item.avatarUrl)
      : null,
    uri: item.mediaUrl
      ? (item.mediaUrl.startsWith('http') ? item.mediaUrl : API_BASE_URL + item.mediaUrl)
      : null,
  }));
}

export async function updateProfile(username = 'you', changes = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save the profile.');
  return data;
}

export async function uploadProfileAvatar(asset, username = 'you') {
  const extension = (asset.fileName || asset.uri || '').split('.').pop().split('?')[0].toLowerCase();
  const ext = /^[a-z0-9]+$/.test(extension) ? extension : 'jpg';
  const mime = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
  }[ext] || 'image/jpeg';

  const authSession = await getAuthSession();
  if (!authSession?.token) {
    throw new Error('Please log in first.');
  }

  const result = await FileSystem.uploadAsync(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/avatar`,
    asset.uri,
    {
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${authSession.token}` },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mime,
    }
  );

  let data;
  try { data = JSON.parse(result.body); }
  catch { throw new Error(`Could not read the photo upload response (HTTP ${result.status})`); }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(data.error || `Photo upload failed (HTTP ${result.status})`);
  }
  return data;
}

export async function deleteProfileAvatar(username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/avatar`,
    { method: 'DELETE' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not remove the profile photo.');
  return data;
}

export async function followProfile(username, viewer = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/follow`,
    {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ viewer }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not follow this account.');
  return data;
}

export async function unfollowProfile(username, viewer = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/follow?viewer=${encodeURIComponent(viewer)}`,
    { method: 'DELETE', headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not unfollow this account.');
  return data;
}

export async function loadProfileConnections(username, type = 'followers') {
  if (!['followers', 'following'].includes(type)) {
    throw new Error('Invalid profile list.');
  }
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/${type}`
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load the list.');
  return data;
}


export async function loadBusinessProfile() {
  const response = await fetch(`${API_BASE_URL}/api/business/profile`, {
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Business profile could not be loaded.");
  return data.businessProfile || {};
}

export async function saveBusinessProfile(changes) {
  const response = await fetch(`${API_BASE_URL}/api/business/profile`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(changes),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Business profile could not be saved.");
  return data.businessProfile || {};
}


export async function loadBusinessCatalog() {
  const response = await fetch(`${API_BASE_URL}/api/business/catalog`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Catalog could not be loaded.");
  return data.items || [];
}
export async function createBusinessCatalogItem(item) {
  const response = await fetch(`${API_BASE_URL}/api/business/catalog`, {
    method: "POST", headers: await authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(item),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Catalog item could not be saved.");
  return data.item;
}
export async function deleteBusinessCatalogItem(id) {
  const response = await fetch(`${API_BASE_URL}/api/business/catalog/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Catalog item could not be deleted.");
  return data;
}
export async function loadBusinessQuickReplies() {
  const response = await fetch(`${API_BASE_URL}/api/business/quick-replies`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Quick replies could not be loaded.");
  return data.items || [];
}
export async function createBusinessQuickReply(item) {
  const response = await fetch(`${API_BASE_URL}/api/business/quick-replies`, {
    method: "POST", headers: await authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(item),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Quick reply could not be saved.");
  return data.item;
}
export async function deleteBusinessQuickReply(id) {
  const response = await fetch(`${API_BASE_URL}/api/business/quick-replies/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Quick reply could not be deleted.");
  return data;
}

export async function loadBusinessInsights() {
  const response = await fetch(`${API_BASE_URL}/api/business/insights`, {
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Business insights could not be loaded.");
  return data.insights || {};
}

export async function discoverBusinesses(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value).trim());
  });
  const response = await fetch(`${API_BASE_URL}/api/businesses?${query.toString()}`, {
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Businesses could not be loaded.");
  return Array.isArray(data.businesses) ? data.businesses : [];
}

export async function loadPrivacySettings(username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/settings`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load privacy settings.');
  }
  return data.settings;
}

export async function savePrivacySettings(changes, username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/settings`,
    {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(changes),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not save privacy settings.');
  }
  return data.settings;
}


export async function loadRestrictedAccounts() {
  const response = await fetch(`${API_BASE_URL}/api/settings/restricted-accounts`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Restricted accounts could not be loaded.');
  return data.restrictedAccounts || [];
}

export async function restrictAccount(username) {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/restrict`,
    { method: 'POST' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account could not be restricted.');
  return data;
}

export async function unrestrictAccount(username) {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/restrict`,
    { method: 'DELETE' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account could not be unrestricted.');
  return data;
}

export async function blockAccount(username) {
  const response = await fetch(
    `${API_BASE_URL}/api/settings/blocked-accounts/${encodeURIComponent(username)}`,
    {
      method: 'POST',
      headers: await authHeaders(),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account could not be blocked.');
  return data;
}

export async function loadBlockedAccounts() {
  const response = await fetch(`${API_BASE_URL}/api/settings/blocked-accounts`, {
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Blocked accounts could not be loaded.');
  return data.blockedAccounts || [];
}

export async function unblockAccount(username) {
  const response = await fetch(
    `${API_BASE_URL}/api/settings/blocked-accounts/${encodeURIComponent(username)}`,
    { method: 'DELETE' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account could not be unblocked.');
  return data;
}

export async function requestPasswordReset(email) {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not request a password reset.');
  }
  return data;
}

export async function verifyPasswordReset(email, otp) {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not verify the reset code.');
  }
  return data;
}

export async function resetPasswordWithToken(email, resetToken, newPassword, confirmPassword) {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      reset_token: resetToken,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not reset the password.');
  }
  return data;
}

export async function logoutOtherSessions() {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout-other-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not sign out other sessions.');
  }
  return data;
}

export async function changeAccountPassword(oldPassword, newPassword, confirmPassword) {
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not change password.');
  }
  return data;
}


export async function loadPostById(postId) {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load post.');
  }
  const item = data.item;
  if (!item) return null;
  const mediaUri = item.mediaUrl
    ? (item.mediaUrl.startsWith("http") ? item.mediaUrl : `${API_BASE_URL}${item.mediaUrl}`)
    : null;
  const avatarUrl = item.avatarUrl
    ? (item.avatarUrl.startsWith("http") ? item.avatarUrl : API_BASE_URL + item.avatarUrl)
    : null;
  return {
    ...item,
    avatarUrl,
    uri: mediaUri,
    likes: '0',
    mediaItems: [{ ...item, avatarUrl, uri: mediaUri }],
  };
}

export async function togglePostLike(postId, activeSession = null) {
  const session = activeSession?.token && activeSession?.username
    ? activeSession
    : await getAuthSession();
  if (!session?.token || !session?.username) {
    throw new Error('Please log in to like this post.');
  }
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/like`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not update post like.');
  }
  return data;
}

export async function togglePostRepost(postId, activeSession = null) {
  const session = activeSession?.token && activeSession?.username ? activeSession : await getAuthSession();
  if (!session?.token || !session?.username) throw new Error('Please log in to repost this post.');
  const response = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/repost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not repost this post.');
  return data;
}

export async function sendPostFlowerGift(contentId) {
  const response = await fetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(contentId)}/gifts`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ giftType: 'flower' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not send flower gift.');
  return data;
}

export async function loadGiftHistory() {
  const response = await fetch(`${API_BASE_URL}/api/gifts/history`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load gift history.');
  return data.gifts || [];
}

export async function loadPostComments(postId) {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load comments.');
  }
  return data.comments || [];
}

export async function createPostComment(postId, text, parentCommentId = null) {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}) }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not create comment.');
  }
  return data.comment;
}

export async function approvePostComment(postId, commentId) {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/approve`,
    { method: 'POST', headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not approve comment.');
  return data;
}

export async function searchUsers(query) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const response = await fetch(
    `${API_BASE_URL}/api/search/users?q=${encodeURIComponent(term)}`
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Search failed.');
  return (data.results || []).map(withAbsoluteAvatar);
}

export async function loadFollowRequests() {
  const response = await fetch(`${API_BASE_URL}/api/follow-requests`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load follow requests.');
  return data.requests || [];
}

export async function acceptFollowRequest(requestId) {
  const response = await fetch(`${API_BASE_URL}/api/follow-requests/${encodeURIComponent(requestId)}/accept`, { method: 'POST', headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not accept the request.');
  return data;
}

export async function rejectFollowRequest(requestId) {
  const response = await fetch(`${API_BASE_URL}/api/follow-requests/${encodeURIComponent(requestId)}/reject`, { method: 'POST', headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reject the request.');
  return data;
}

export async function loadNotifications() {
  const response = await fetch(`${API_BASE_URL}/api/notifications`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load notifications.');
  return data;
}

export async function markNotificationRead(notificationId) {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH', headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not mark the notification as read.');
  return data;
}

export async function markAllNotificationsRead() {
  const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, { method: 'PATCH', headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not update notifications.');
  return data;
}

export async function loadUserNotes() {
  const response = await fetch(`${API_BASE_URL}/api/notes`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load notes.');
  return data;
}

export async function saveUserNote(text, audio = null) {
  const response = await fetch(`${API_BASE_URL}/api/notes`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text,
      audioUrl: audio?.url || null,
      audioTitle: audio?.title || null,
      audioArtist: audio?.artist || null,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save note.');
  return data;
}

export async function deleteUserNote() {
  const response = await fetch(`${API_BASE_URL}/api/notes`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not delete note.');
  return data;
}

const CHAT_READ_REQUESTS_IN_FLIGHT = new Map();

async function coalesceChatRead(key, request) {
  const existing = CHAT_READ_REQUESTS_IN_FLIGHT.get(key);
  if (existing) return existing;
  const pending = request().finally(() => {
    if (CHAT_READ_REQUESTS_IN_FLIGHT.get(key) === pending) {
      CHAT_READ_REQUESTS_IN_FLIGHT.delete(key);
    }
  });
  CHAT_READ_REQUESTS_IN_FLIGHT.set(key, pending);
  return pending;
}

export async function sendPresenceHeartbeat() {
  const response = await fetch(`${API_BASE_URL}/api/presence/heartbeat`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Presence update failed.");
  return data;
}

export async function getChatPresence(username) {
  const response = await fetch(`${API_BASE_URL}/api/presence/${encodeURIComponent(username)}`, {
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Presence unavailable.");
  return data;
}

export async function loadMessageConversations() {
  return coalesceChatRead('conversations', async () => {
    const response = await fetch(`${API_BASE_URL}/api/messages/conversations`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load conversations.');
    return (data.conversations || []).map(withAbsoluteAvatar);
  });
}

export async function updateMessageConversationFolder(username, folder) {
  const response = await fetch(`${API_BASE_URL}/api/messages/conversations/${encodeURIComponent(username)}/folder`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not organize this conversation.");
  return data;
}

export async function loadDirectMessages(username) {
  const peer = String(username || '').trim().toLowerCase();
  return coalesceChatRead(`messages:${peer}`, async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}`
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load messages.');
    return (data.messages || []).map(withAbsoluteAvatar);
  });
}

export async function unsendDirectMessage(username, messageId) {
  const response = await fetch(
    `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not unsend message.');
  }
  return data;
}

export async function updateChatTyping(username, typing) {
  const response = await fetch(
    `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}/typing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typing: !!typing }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not update typing status.');
  return data;
}

export async function loadChatTyping(username) {
  const response = await fetch(
    `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}/typing`
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load typing status.');
  return !!data.typing;
}

export async function uploadChatAttachment(asset) {
  if (!asset?.uri) throw new Error('Please select a file first.');

  const cleanUri = asset.uri.split('?')[0];
  const suppliedName = String(asset.name || asset.fileName || '').trim();
  const uriFileName = cleanUri.split('/').pop() || '';
  const nameExtension = suppliedName.includes('.') ? suppliedName.split('.').pop().toLowerCase() : '';
  const uriExtension = uriFileName.includes('.') ? uriFileName.split('.').pop().toLowerCase() : '';

  const mimeByExtension = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    m4v: 'video/x-m4v',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
    wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/opus',
    amr: 'audio/amr',
    pdf: 'application/pdf', txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv', rtf: 'application/rtf',
  };

  const mimeToExtension = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
    'audio/opus': 'opus', 'audio/amr': 'amr',
    'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/rtf': 'rtf',
  };

  const suppliedMime = String(asset.mimeType || '').toLowerCase();
  const extension = nameExtension || uriExtension || mimeToExtension[suppliedMime] || 'bin';
  const mimeType = mimeByExtension[extension] ||
    (suppliedMime && suppliedMime !== 'application/octet-stream'
      ? suppliedMime
      : 'application/octet-stream');
  const name = suppliedName && suppliedName.includes('.')
    ? suppliedName
    : `${suppliedName || 'chat-attachment'}.${extension}`;

  const authSession = await getAuthSession();
  if (!authSession?.token) {
    throw new Error('Please log in first.');
  }

  // Use Expo FileSystem's native multipart uploader. React Native 0.88's
  // fetch/FormData rejects the legacy { uri, name, type } file-part shape.
  const result = await FileSystem.uploadAsync(
    `${API_BASE_URL}/api/messages/upload-attachment`,
    asset.uri,
    {
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${authSession.token}` },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
    }
  );

  let data;
  try {
    data = JSON.parse(result.body);
  } catch {
    throw new Error(`Could not read the attachment upload response (HTTP ${result.status})`);
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(data.error || `Could not upload chat attachment (HTTP ${result.status}).`);
  }
  if (!data.attachmentUrl) throw new Error('Server did not return an attachment URL.');
  return data;
}

export async function uploadChatPhoto(asset) {
  const data = await uploadChatAttachment(asset);
  if (data.attachmentType !== 'image') {
    throw new Error('Please select an image.');
  }
  return data.attachmentUrl.startsWith(`${API_BASE_URL}/`)
    ? data.attachmentUrl.slice(API_BASE_URL.length)
    : data.attachmentUrl;
}

export async function sendDirectMessage(username, text, attachment = null, replyToId = null) {
  const legacyImageUrl = typeof attachment === 'string' ? attachment : null;
  const attachmentUrl = attachment && typeof attachment === 'object'
    ? attachment.attachmentUrl || null
    : legacyImageUrl;
  const attachmentType = attachment && typeof attachment === 'object'
    ? attachment.attachmentType || null
    : (legacyImageUrl ? 'image' : null);

  const response = await fetch(
    `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}`,
    {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        text,
        imageUrl: attachmentType === 'image' ? attachmentUrl : null,
        attachmentUrl,
        attachmentType,
        attachmentName: attachment?.attachmentName || attachment?.name || null,
        mimeType: attachment?.mimeType || null,
        sizeBytes: attachment?.sizeBytes || null,
        replyToId,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not send message.');
  }
  return data.message;
}

// SOCIALAPP_REELS_SAVED_API_V1
export async function toggleReelLike(reelId) {
  const response = await fetch(`${API_BASE_URL}/api/reels/${encodeURIComponent(reelId)}/like`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not update reel like.');
  return data;
}

export async function loadReelComments(reelId) {
  const response = await fetch(`${API_BASE_URL}/api/reels/${encodeURIComponent(reelId)}/comments`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load reel comments.');
  return data.comments || [];
}

export async function createReelComment(reelId, text, parentCommentId = null) {
  const response = await fetch(`${API_BASE_URL}/api/reels/${encodeURIComponent(reelId)}/comments`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text, ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not create reel comment.');
  return data.comment;
}

export async function approveReelComment(reelId, commentId) {
  const response = await fetch(
    `${API_BASE_URL}/api/reels/${encodeURIComponent(reelId)}/comments/${encodeURIComponent(commentId)}/approve`,
    { method: 'POST', headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not approve reel comment.');
  return data;
}

export async function loadSavedContent() {
  const response = await fetch(`${API_BASE_URL}/api/saved`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load Saved content.');
  return (data.items || []).map(item => ({
    ...item,
    avatarUrl: item.avatarUrl
      ? (item.avatarUrl.startsWith('http') ? item.avatarUrl : API_BASE_URL + item.avatarUrl)
      : null,
    uri: item.mediaUrl
      ? (item.mediaUrl.startsWith('http') ? item.mediaUrl : API_BASE_URL + item.mediaUrl)
      : null,
  }));
}

export async function toggleSavedContent(kind, contentId) {
  if (!['posts', 'reels'].includes(kind)) throw new Error('Invalid content type.');
  const response = await fetch(
    `${API_BASE_URL}/api/content/${kind}/${encodeURIComponent(contentId)}/save`,
    { method: 'POST', headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not update Saved content.');
  return data;
}


export async function loadFeedUserLists() {
  const response = await fetch(`${API_BASE_URL}/api/feed/lists`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load Favorites and Muted accounts.");
  return { favorites: data.favorites || [], muted: data.muted || [] };
}

export async function addFeedUserList(listType, username) {
  const response = await fetch(`${API_BASE_URL}/api/feed/lists`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ list_type: listType, username }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not update account list.");
  CONTENT_MEMORY_CACHE.clear();
  return data;
}

export async function removeFeedUserList(listType, username) {
  const response = await fetch(
    `${API_BASE_URL}/api/feed/lists/${encodeURIComponent(listType)}/${encodeURIComponent(username)}`,
    { method: "DELETE", headers: await authHeaders() }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not remove account from list.");
  CONTENT_MEMORY_CACHE.clear();
  return data;
}


export async function loadSettingsPreferences() {
  const response = await fetch(`${API_BASE_URL}/api/settings/preferences`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load settings.");
  return data.preferences || {};
}

export async function saveSettingsPreferences(changes) {
  const response = await fetch(`${API_BASE_URL}/api/settings/preferences`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(changes),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not save settings.");
  return data.preferences || {};
}


export async function loadLoginHistory(limit = 30) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login-history?limit=${encodeURIComponent(limit)}`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load login history.");
  return data.items || [];
}

export async function loadActiveSessions() {
  const response = await fetch(`${API_BASE_URL}/api/auth/sessions`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load active devices.");
  return data.items || [];
}

export async function revokeActiveSession(sessionId) {
  const response = await fetch(`${API_BASE_URL}/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE", headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not sign out this device.");
  return data;
}

export async function loadLocationShares() {
  const response = await fetch(`${API_BASE_URL}/api/location/shares`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load location sharing.");
  return { outgoing: data.outgoing || [], incoming: data.incoming || [], history: data.history || [] };
}

export async function createOrUpdateLocationShare(payload) {
  const response = await fetch(`${API_BASE_URL}/api/location/shares`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Could not share live location.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function stopLocationShare(shareId) {
  const response = await fetch(`${API_BASE_URL}/api/location/shares/${encodeURIComponent(shareId)}`, {
    method: "DELETE", headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not stop location sharing.");
  return data;
}

// SOCIALAPP_LIVEKIT_CALL_API_V1
async function callApi(path, options = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 10000) : null;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
      headers: await authHeaders({
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Call server took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    throw new Error(data.error || 'Call request failed. Please try again.');
  }
  return data;
}

export async function registerCallPushToken(expoPushToken) {
  const token = String(expoPushToken || "").trim();
  if (!token) return;
  await callApi('/api/calls/push-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function removeCallPushToken(expoPushToken) {
  const token = String(expoPushToken || "").trim();
  if (!token) return;
  await callApi('/api/calls/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export async function createVoiceVideoCall(username, type = 'audio') {
  const target = String(username || '').trim().replace(/^@/, '');
  const callType = String(type || '').toLowerCase();
  if (!target) throw new Error('A username is required to place a call.');
  if (!['audio', 'video'].includes(callType)) {
    throw new Error('Invalid call type.');
  }
  const data = await callApi('/api/calls', {
    method: 'POST',
    body: JSON.stringify({ username: target, type: callType }),
  });
  return data.call;
}

export async function loadPendingCalls() {
  const data = await callApi('/api/calls/pending');
  return Array.isArray(data.calls) ? data.calls : [];
}

export async function respondToCall(callId, action) {
  const id = String(callId || '').trim();
  if (!id || !['accept', 'reject', 'end'].includes(action)) {
    throw new Error('Invalid call request.');
  }
  const data = await callApi(`/api/calls/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return data.call || data;
}

export async function getCallConnectionToken(callId) {
  const id = String(callId || '').trim();
  if (!id) throw new Error('Call ID was not found.');
  return callApi(`/api/calls/${encodeURIComponent(id)}/token`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getVoiceVideoCallStatus(callId) {
  const id = String(callId || '').trim();
  if (!id) throw new Error('Call ID was not found.');
  const data = await callApi(`/api/calls/${encodeURIComponent(id)}`);
  return data.call || null;
}
