import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
const API_BASE_URL = 'https://bhumi-social-app-1.onrender.com';

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


export async function registerAccount(username, password, phoneNumber, email, fullName) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'लॉगिन नहीं हुआ।');
  await saveAuthSession(data.token, data.username);
  return data;
}

export async function verifyAuthSession() {
  const session = await getAuthSession();
  if (!session?.token) {
    return { valid: false, reason: 'missing_token' };
  }

  const response = await originalFetch(`${API_BASE_URL}/api/auth/me`, {
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
  const headers = new Headers(init.headers || {});
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }
  const url = typeof input === 'string' ? input : input.url;
  const response = await originalFetch(input, { ...init, headers });
  if (String(url).includes('/api/')) {
    console.log('[AUTH DEBUG]', response.status, String(init.method || 'GET').toUpperCase(), String(url).split('?')[0], 'tokenSent=' + headers.has('Authorization'));
  }
  return response;
};


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
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load notification settings.');
  return data.enabled;
}

export async function saveNotificationPreference(enabled) {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save notification settings.');
  return data.enabled;
}

export async function loadNotificationDetails() {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications/details`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load notification details.');
  return data;
}

export async function saveNotificationDetails(preferences) {
  const response = await fetch(`${API_BASE_URL}/api/settings/notifications/details`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
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

export async function loadContent(type) {
  const response = await fetch(`${API_BASE_URL}/api/${type}`);
  if (!response.ok) {
    throw new Error(`Could not load ${type}`);
  }

  const data = await response.json();

  return (data.items || []).map(item => ({
    ...item,
    avatarUrl: item.avatarUrl ? (item.avatarUrl.startsWith("http") ? item.avatarUrl : API_BASE_URL + item.avatarUrl) : null,
    uri: item.mediaUrl
      ? `${API_BASE_URL}${item.mediaUrl}`
      : null,
    likes: '0',
  }));
}

export async function uploadContent(type, asset, caption = '', groupId = '') {
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

  const authSession = await getAuthSession();
  if (!authSession?.token) {
    throw new Error('कृपया पहले लॉगिन करें।');
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
    `${API_BASE_URL}/api/posts/${encodeURIComponent(postId)}`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load post.');
  }
  const item = data.item;
  if (!item) return null;
  return {
    ...item,
    avatarUrl: item.avatarUrl
      ? (item.avatarUrl.startsWith("http") ? item.avatarUrl : API_BASE_URL + item.avatarUrl)
      : null,
    uri: item.mediaUrl ? `${API_BASE_URL}${item.mediaUrl}` : null,
    likes: '0',
    mediaItems: [{
      ...item,
      avatarUrl: item.avatarUrl
        ? (item.avatarUrl.startsWith("http") ? item.avatarUrl : API_BASE_URL + item.avatarUrl)
        : null,
      uri: item.mediaUrl ? `${API_BASE_URL}${item.mediaUrl}` : null,
    }],
  };
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

export async function searchUsers(query) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const response = await fetch(
    `${API_BASE_URL}/api/search/users?q=${encodeURIComponent(term)}`
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Search failed.');
  return data.results || [];
}

export async function loadMessageConversations() {
  const response = await fetch(`${API_BASE_URL}/api/messages/conversations`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load conversations.');
  }
  return data.conversations || [];
}

export async function loadDirectMessages(username) {
  const response = await fetch(
    `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load messages.');
  }
  return data.messages || [];
}

export async function uploadChatPhoto(asset) {
  if (!asset?.uri) throw new Error('Please select a photo first.');
  const cleanUri = asset.uri.split('?')[0];
  const extension = (cleanUri.split('.').pop() || 'jpg').toLowerCase();
  const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
  const mimeType = asset.mimeType ||
    (safeExtension === 'png' ? 'image/png' :
     safeExtension === 'webp' ? 'image/webp' :
     safeExtension === 'gif' ? 'image/gif' : 'image/jpeg');
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: `chat-photo.${safeExtension}`,
    type: mimeType,
  });
  const response = await fetch(`${API_BASE_URL}/api/messages/upload-photo`, {
    method: 'POST',
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not upload chat photo.');
  return data.imageUrl.startsWith('http') ? data.imageUrl : `${API_BASE_URL}${data.imageUrl}`;
}

export async function sendDirectMessage(username, text, imageUrl = null) {
  const response = await fetch(
    `${API_BASE_URL}/api/messages/${encodeURIComponent(username)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageUrl }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not send message.');
  }
  return data.message;
}
