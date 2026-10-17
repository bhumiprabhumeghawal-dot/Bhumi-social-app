import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
const API_BASE_URL = 'http://127.0.0.1:5000';

const AUTH_TOKEN_KEY = 'socialapp_auth_token';
const AUTH_USERNAME_KEY = 'socialapp_auth_username';

export async function saveAuthSession(token, username) {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  await SecureStore.setItemAsync(AUTH_USERNAME_KEY, username);
}

export async function clearAuthSession() {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(AUTH_USERNAME_KEY);
}

export async function getAuthSession() {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  const username = await SecureStore.getItemAsync(AUTH_USERNAME_KEY);
  return token && username ? { token, username } : null;
}


export async function registerAccount(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'रजिस्ट्रेशन नहीं हुआ।');
  await saveAuthSession(data.token, data.username);
  return data;
}

export async function loginAccount(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'लॉगिन नहीं हुआ।');
  await saveAuthSession(data.token, data.username);
  return data;
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
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return originalFetch(input, { ...init, headers });
};


export async function checkServer() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`Server status: ${response.status}`);
  }
  return response.json();
}

export async function loadContent(type) {
  const response = await fetch(`${API_BASE_URL}/api/${type}`);
  if (!response.ok) {
    throw new Error(`Could not load ${type}`);
  }

  const data = await response.json();

  return (data.items || []).map(item => ({
    ...item,
    uri: item.mediaUrl
      ? `${API_BASE_URL}${item.mediaUrl}`
      : null,
    likes: '0',
  }));
}

export async function uploadContent(type, asset, caption = '') {
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
      headers: authSession ? { Authorization: `Bearer ${authSession.token}` } : {},

      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mimeTypes[fileExtension] ||
        (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      parameters: {
        caption,
        username: authSession?.username || 'you',
      },
    }
  );

  let data;
  try {
    data = JSON.parse(result.body);
  } catch {
    throw new Error(`सर्वर का जवाब पढ़ा नहीं जा सका (HTTP ${result.status})`);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(data.error || `Upload failed: ${result.status}`);
  }

  const item = data.item;
  if (!item) {
    throw new Error('सर्वर ने अपलोड की जानकारी नहीं लौटाई।');
  }

  return {
    ...item,
    uri: item.mediaUrl ? `${API_BASE_URL}${item.mediaUrl}` : null,
    likes: '0',
  };
}


// SOCIALAPP_PROFILE_CLIENT_API_V1
export async function loadProfile(username = 'you', viewer = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}?viewer=${encodeURIComponent(viewer)}`
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'प्रोफ़ाइल लोड नहीं हुई।');
  if (data.profile?.avatarUrl && !data.profile.avatarUrl.startsWith('http')) {
    data.profile.avatarUrl = `${API_BASE_URL}${data.profile.avatarUrl}`;
  }
  return data;
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
  if (!response.ok) throw new Error(data.error || 'प्रोफ़ाइल सेव नहीं हुई।');
  return data;
}

export async function uploadProfileAvatar(asset, username = 'you') {
  const extension = (asset.fileName || asset.uri || '').split('.').pop().split('?')[0].toLowerCase();
  const ext = /^[a-z0-9]+$/.test(extension) ? extension : 'jpg';
  const mime = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
  }[ext] || 'image/jpeg';

  const result = await FileSystem.uploadAsync(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/avatar`,
    asset.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mime,
    }
  );

  let data;
  try { data = JSON.parse(result.body); }
  catch { throw new Error(`फ़ोटो अपलोड का जवाब पढ़ा नहीं जा सका (HTTP ${result.status})`); }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(data.error || `फ़ोटो अपलोड नहीं हुई (HTTP ${result.status})`);
  }
  return data;
}

export async function deleteProfileAvatar(username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/avatar`,
    { method: 'DELETE' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'प्रोफ़ाइल फ़ोटो हट नहीं सकी।');
  return data;
}

export async function followProfile(username, viewer = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/follow`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewer }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Follow नहीं हो सका।');
  return data;
}

export async function unfollowProfile(username, viewer = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/follow?viewer=${encodeURIComponent(viewer)}`,
    { method: 'DELETE' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unfollow नहीं हो सका।');
  return data;
}

export async function loadProfileConnections(username, type = 'followers') {
  if (!['followers', 'following'].includes(type)) {
    throw new Error('अमान्य प्रोफ़ाइल सूची।');
  }
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/${type}`
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'सूची लोड नहीं हुई।');
  return data;
}

export async function loadPrivacySettings(username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/profile/${encodeURIComponent(username)}/settings`
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not save privacy settings.');
  }
  return data.settings;
}


export async function togglePostLike(postId, username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/like`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not update post like.');
  }
  return data;
}

export async function loadPostComments(postId) {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load comments.');
  }
  return data.comments || [];
}

export async function createPostComment(postId, text, username = 'you') {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, text }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not create comment.');
  }
  return data.comment;
}
