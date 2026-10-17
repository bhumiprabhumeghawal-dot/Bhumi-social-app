from pathlib import Path

app = Path("App.js")
backup = Path("App.js.before_server")

if not app.exists() or not backup.exists():
    raise SystemExit("ERROR: App.js या उसका बैकअप नहीं मिला।")

src = app.read_text()

if "from './api'" in src:
    raise SystemExit("API import पहले से मौजूद है। दोबारा patch नहीं किया।")

imports = """import { StatusBar } from 'expo-status-bar';
import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { loadContent, uploadContent, checkServer } from './api';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
} from 'react-native';
"""

old_import_end = "} from 'react-native';"
pos = src.find(old_import_end)
if pos == -1:
    raise SystemExit("Imports नहीं मिले; App.js नहीं बदली गई।")

# मौजूदा import block को बदलें, बाकी स्टाइल्स जस की तस रहेंगी।
first_import = src.find("import { StatusBar")
src = src[:first_import] + imports + src[pos + len(old_import_end):]

start = src.find("function Story({ item })")
end = src.find("const styles = StyleSheet.create")

if start == -1 or end == -1 or end <= start:
    raise SystemExit("Story/Styles section नहीं मिला; App.js नहीं बदली गई।")

replacement = r"""
function Story({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.story} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.storyRing, item.own && styles.ownRing]}>
        <View style={[styles.storyAvatar, { backgroundColor: item.color || '#DDE7F5' }]}>
          {item.uri ? (
            <Image source={{ uri: item.uri }} style={{ width: 52, height: 52, borderRadius: 26 }} />
          ) : item.own ? (
            <Text style={styles.plus}>＋</Text>
          ) : (
            <Text style={styles.avatarLetter}>{(item.name || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
      </View>
      <Text style={styles.storyName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );
}

function ReelVideo({ uri }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; });
  return <VideoView player={player} style={{ width: '100%', height: 420, backgroundColor: '#111' }} contentFit="contain" nativeControls />;
}

function PostCard({ post }) {
  const [liked, setLiked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <View style={styles.smallAvatar}>
          <Text style={styles.smallAvatarText}>{(post.user || 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.postUserInfo}>
          <Text style={styles.username}>{post.user || 'you'}</Text>
          <Text style={styles.location}>{post.location || 'Just now'}</Text>
        </View>
        <TouchableOpacity><Text style={styles.more}>•••</Text></TouchableOpacity>
      </View>

      {post.uri && post.mediaType === 'video' ? (
        <ReelVideo uri={post.uri} />
      ) : post.uri ? (
        <Image source={{ uri: post.uri }} style={styles.postImage} resizeMode="cover" />
      ) : (
        <View style={[styles.postImage, { backgroundColor: post.color || '#D8E7DF' }]}>
          <Text style={styles.postEmoji}>{post.emoji || '🌿'}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => setLiked(!liked)}>
          <Text style={[styles.actionIcon, liked && styles.liked]}>{liked ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        <TouchableOpacity><Text style={styles.actionIcon}>▢</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.actionIcon}>➤</Text></TouchableOpacity>
        <View style={styles.actionSpacer} />
        <TouchableOpacity onPress={() => setSaved(!saved)}>
          <Text style={styles.actionIcon}>{saved ? '▣' : '♧'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.likes}>{liked ? '1' : (post.likes || '0')} likes</Text>
      {!!post.caption && (
        <Text style={styles.caption}>
          <Text style={styles.username}>{post.user || 'you'} </Text>{post.caption}
        </Text>
      )}
      <TouchableOpacity><Text style={styles.comments}>View all comments</Text></TouchableOpacity>
      <Text style={styles.time}>JUST NOW</Text>
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = React.useState('Home');
  const [feedPosts, setFeedPosts] = React.useState(posts);
  const [serverStories, setServerStories] = React.useState([]);
  const [reels, setReels] = React.useState([]);
  const [serverOnline, setServerOnline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const refreshContent = React.useCallback(async () => {
    try {
      await checkServer();
      const [p, s, r] = await Promise.all([
        loadContent('posts'), loadContent('stories'), loadContent('reels')
      ]);
      setServerOnline(true);
      setFeedPosts([...p, ...posts]);
      setServerStories(s.map((item, i) => ({
        ...item, name: item.user || `story${i + 1}`, color: '#DDE7F5'
      })));
      setReels(r);
    } catch (e) {
      setServerOnline(false);
      console.error('Server load failed:', e);
    }
  }, []);

  React.useEffect(() => { refreshContent(); }, [refreshContent]);

  const chooseMedia = async (kind) => {
    if (busy) return;
    try {
      const video = kind === 'reels';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: video ? ['videos'] : ['images'],
        allowsEditing: !video,
        quality: 0.8,
        ...(video ? { videoMaxDuration: 180 } : {}),
      });
      if (result.canceled || !result.assets?.length) return;

      setBusy(true);
      const item = await uploadContent(kind, result.assets[0]);

      if (kind === 'posts') {
        setFeedPosts(current => [item, ...current]);
        setActiveTab('Home');
      } else if (kind === 'stories') {
        setServerStories(current => [{
          ...item, name: item.user || 'you', own: true, color: '#DDE7F5'
        }, ...current]);
        setActiveTab('Home');
      } else {
        setReels(current => [item, ...current]);
        setActiveTab('Reels');
      }
      Alert.alert('सफल', 'मीडिया सर्वर पर अपलोड हो गया।');
    } catch (e) {
      console.error('Upload failed:', e);
      Alert.alert('अपलोड विफल', e.message || 'सर्वर कनेक्शन जाँचें।');
    } finally {
      setBusy(false);
    }
  };

  const pickImage = () => chooseMedia('posts');
  const createStory = () => chooseMedia('stories');
  const createReel = () => chooseMedia('reels');

  const handleTab = (name) => {
    if (name === 'Create') {
      Alert.alert('Create', 'क्या अपलोड करना है?', [
        { text: 'पोस्ट', onPress: pickImage },
        { text: 'स्टोरी', onPress: createStory },
        { text: 'रील', onPress: createReel },
        { text: 'रद्द करें', style: 'cancel' },
      ]);
    } else {
      setActiveTab(name);
      if (name === 'Home') refreshContent();
      if (name === 'Reels' && reels.length === 0) {
        Alert.alert('Reels', 'अभी कोई रील नहीं है।', [
          { text: 'रील अपलोड करें', onPress: createReel },
          { text: 'ठीक है', style: 'cancel' },
        ]);
      }
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>SocialApp</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={pickImage}><Text style={styles.headerIcon}>＋</Text></TouchableOpacity>
          <TouchableOpacity><Text style={styles.headerIcon}>♡</Text></TouchableOpacity>
          <TouchableOpacity><Text style={styles.headerIcon}>➤</Text></TouchableOpacity>
        </View>
      </View>

      {!serverOnline && (
        <Text style={{ paddingHorizontal: 12, paddingVertical: 4, color: '#888', fontSize: 11 }}>
          सर्वर से कनेक्शन नहीं है
        </Text>
      )}
      {busy && <Text style={{ padding: 5, color: '#1685D9' }}>मीडिया अपलोड हो रहा है…</Text>}

      {activeTab === 'Reels' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {reels.length ? reels.map((r, i) => (
            <View key={r.id || r.uri || i} style={styles.post}>
              {r.uri ? <ReelVideo uri={r.uri} /> : null}
              {!!r.caption && <Text style={styles.caption}>{r.caption}</Text>}
              <Text style={styles.location}>@{r.user || 'you'}</Text>
            </View>
          )) : (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#555' }}>अभी कोई रील नहीं है।</Text>
              <TouchableOpacity onPress={createReel} style={{ padding: 14 }}>
                <Text style={{ color: '#1685D9', fontWeight: '700' }}>＋ रील अपलोड करें</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : activeTab === 'Home' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
            <Story item={{ name: 'Your story', color: '#DDE7F5', own: true }} onPress={createStory} />
            {serverStories.map((s, i) => (
              <Story key={s.id || i} item={s} onPress={() => {
                if (s.uri) Alert.alert(s.name || 'Story', s.caption || 'स्टोरी');
              }} />
            ))}
            {stories.filter(s => !s.own).map(s => <Story key={s.name} item={s} onPress={() => {}} />)}
          </ScrollView>
          <View style={styles.feedDivider} />
          {feedPosts.map((p, i) => <PostCard key={p.id || `${p.user}-${i}`} post={p} />)}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#555' }}>{activeTab}</Text>
          {activeTab === 'Profile' && <Text style={{ color: '#888', marginTop: 8 }}>@you</Text>}
        </View>
      )}

      <View style={styles.bottomNav}>
        {[
          { name: 'Home', icon: '⌂', color: '#4F83CC' },
          { name: 'Search', icon: '⌕', color: '#9274CC' },
          { name: 'Create', icon: '＋', color: '#4A9D83' },
          { name: 'Reels', icon: '▻', color: '#D879A0' },
          { name: 'Profile', icon: '○', color: '#C69255' }
        ].map(tab => (
          <TouchableOpacity key={tab.name} style={styles.navItem} onPress={() => handleTab(tab.name)}>
            <Text style={[styles.navIcon, { color: tab.color }, activeTab === tab.name && { fontWeight: '800' }]}>{tab.icon}</Text>
            <Text style={[styles.navLabel, activeTab === tab.name && styles.activeNavLabel]}>{tab.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

"""

src = src[:start] + replacement + src[end:]
app.write_text(src)
print("APP_PATCHED")
