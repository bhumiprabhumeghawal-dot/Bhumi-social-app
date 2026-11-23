import * as FileSystem from "expo-file-system/legacy";

const LIBRARY_VERSION = 1;
const LIBRARY_FILE = `${FileSystem.documentDirectory}bhumi-music-library-v1.json`;
const AUDIO_DIRECTORY = `${FileSystem.documentDirectory}bhumi-music-library/`;

const safeText = (value, max = 180) => String(value || "").trim().slice(0, max);

export const MUSIC_CATALOG_PROVIDERS = Object.freeze([
  {
    id: "google-web",
    label: "Google Search",
    kind: "web-search",
    enabled: true,
    note: "Opens Google results; audio must be selected from a permitted source.",
  },
  {
    id: "licensed-catalog",
    label: "Licensed music catalog",
    kind: "streaming-catalog",
    enabled: false,
    note: "Provider credentials and commercial usage rights can be configured later.",
  },
]);

export function buildGoogleMusicSearchUrl(query) {
  const clean = safeText(query, 160);
  if (!clean) throw new Error("Enter a song or artist name first.");
  return `https://www.google.com/search?q=${encodeURIComponent(clean + " official song audio")}`;
}

export function searchLocalMusic(query, tracks = []) {
  const q = safeText(query, 120).toLocaleLowerCase();
  if (!q) return tracks;
  return tracks.filter((track) =>
    [track.title, track.artist, track.album, ...(track.tags || [])]
      .join(" ")
      .toLocaleLowerCase()
      .includes(q)
  );
}

export async function loadMusicLibrary() {
  try {
    const raw = await FileSystem.readAsStringAsync(LIBRARY_FILE);
    const data = JSON.parse(raw);
    if (data?.version !== LIBRARY_VERSION || !Array.isArray(data.tracks)) return [];
    return data.tracks.filter((track) => track && track.id && track.uri);
  } catch (_) {
    return [];
  }
}

async function persistMusicLibrary(tracks) {
  await FileSystem.writeAsStringAsync(
    LIBRARY_FILE,
    JSON.stringify({ version: LIBRARY_VERSION, updatedAt: Date.now(), tracks })
  );
  return tracks;
}

export async function importAudioToMusicLibrary(asset, details = {}) {
  if (!asset?.uri) throw new Error("The audio file is unavailable.");
  await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, { intermediates: true });
  const sourceName = safeText(asset.name || asset.fileName || "song", 100);
  const extMatch = sourceName.match(/\.([a-z0-9]{2,5})$/i) || String(asset.uri).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
  const extension = (extMatch?.[1] || "mp3").toLowerCase();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${id}.${extension}`;
  const destination = AUDIO_DIRECTORY + fileName;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  const info = await FileSystem.getInfoAsync(destination);
  if (!info.exists || !info.size) throw new Error("The song could not be saved to the library.");
  const tracks = await loadMusicLibrary();
  const title = safeText(details.title || sourceName.replace(/\.[^.]+$/, "") || "Unknown song");
  const track = {
    id,
    title,
    artist: safeText(details.artist || asset.artist || "Unknown artist"),
    album: safeText(details.album || ""),
    uri: destination,
    fileName,
    mimeType: asset.mimeType || asset.mime || "audio/mpeg",
    fileSize: info.size,
    duration: Number(asset.duration || 0),
    source: "device-import",
    favorite: false,
    addedAt: Date.now(),
    tags: Array.isArray(details.tags) ? details.tags.map((tag) => safeText(tag, 40)).filter(Boolean) : [],
  };
  await persistMusicLibrary([track, ...tracks]);
  return track;
}

export async function updateMusicTrack(trackId, changes = {}) {
  const tracks = await loadMusicLibrary();
  const updated = tracks.map((track) => track.id === trackId
    ? { ...track, ...changes, id: track.id, uri: track.uri, updatedAt: Date.now() }
    : track
  );
  await persistMusicLibrary(updated);
  return updated;
}

export async function removeMusicTrack(trackId) {
  const tracks = await loadMusicLibrary();
  const target = tracks.find((track) => track.id === trackId);
  if (target?.uri) await FileSystem.deleteAsync(target.uri, { idempotent: true }).catch(() => {});
  const updated = tracks.filter((track) => track.id !== trackId);
  await persistMusicLibrary(updated);
  return updated;
}

// Future streaming providers implement this same contract and can be enabled
// by adding a licensed provider adapter without changing the editor UI.
export async function searchLicensedMusic(query, providers = []) {
  const clean = safeText(query, 160);
  if (!clean) return [];
  const results = await Promise.all(providers.map(async (provider) => {
    if (!provider || typeof provider.search !== "function" || provider.enabled === false) return [];
    const found = await provider.search(clean);
    return (Array.isArray(found) ? found : []).map((item) => ({
      id: safeText(item.id || item.trackId, 160),
      title: safeText(item.title),
      artist: safeText(item.artist),
      artworkUrl: item.artworkUrl || null,
      streamUrl: item.streamUrl || null,
      previewUrl: item.previewUrl || null,
      providerId: safeText(provider.id, 80),
      license: item.license || null,
      attribution: item.attribution || null,
      canUseInVideo: item.canUseInVideo === true,
    })).filter((item) => item.id && item.title);
  }));
  return results.flat();
}
