# Bhumi Social AI — Luxury Redesign

## Master Reference
User-selected second design image from the four supplied references.
Reproduce the reference as closely as possible, including all visible screens, layouts, colors, typography, icons, spacing, cards and branding.

## Branding
- Replace the existing logo with the logo shown in the selected reference.
- Update app icon, splash screen and related branding assets.
- Keep branding consistent throughout the application.

## Design Direction
- Match the selected image, not an independently invented theme.
- Luxury black, royal purple, violet and gold tones where shown in the reference.
- Preserve all existing functionality, authentication, API and database behavior.

## Screens
- [ ] Splash and branding
- [ ] Home Feed
- [ ] Stories
- [ ] Profile
- [ ] Reels
- [ ] Search and Explore
- [ ] Messages
- [ ] Notifications
- [ ] Settings
- [ ] Remaining screens, menus and dialogs

## Milestones
- [x] Isolated design worktree created
- [x] Original worktree preserved
- [x] Initial App.js audit
- [ ] First 50% redesign
- [ ] Pause for first build
- [ ] Remaining 50% redesign
- [ ] Final review

## Change Log
सभी पूरे किए गए बदलाव नीचे दर्ज हैं।


### 2026-11-17 — Foundation pass 1
- Header actions और brand text को champagne-gold किया।
- Header और Stories strip को near-black theme दिया।
- Story rings को violet और gold theme दिया।
- दोनों Bottom Navigation में gold active icons और dark palette लागू की।
- Android status bar और app UI style को dark किया।
- Navigation handlers, authentication, API और media logic अपरिवर्तित।
- Exact logo, app icon और splash artwork अभी लंबित।

- Profile cards, settings, follow requests, saved area and post-empty state updated to dark luxury colors.
- Search field, search results and follow-state buttons updated to the violet/gold palette.
- Main screen and bottom navigation backgrounds changed to near-black.
- Search/follow/profile event handlers and data logic were not intentionally changed.

### 2026-11-17 — Home Feed / Post Card pass
- Post header और footer को near-black luxury surface दी।
- Username, caption, likes और metadata को light lavender text में बदला।
- Like/comment/share/save actions को champagne-gold accent दिया।
- Comments modal, input और approval action को dark-violet palette में बदला।
- Post media sizing, cover mode, paging, gestures और video activation logic सुरक्षित रखा।

### 2026-11-17 — Home Stories / Empty State pass
- Add Status badge को violet background और gold border दिया।
- Add icon को dark contrast color दिया।
- Home Feed empty-state text को lavender किया।
- Stories creation और feed data/scroll handlers अपरिवर्तित रखे।

### 2026-11-17 — Messages / Chat visual pass
- Inbox cards, search, new-chat composer और message composer को dark luxury palette दी।
- Sent bubbles को royal violet और received bubbles को dark purple किया।
- Text, timestamps, unread badge, borders और chat action icons के colors बदले।
- Reply, unsend, media, typing, delivery/read status और message handlers सुरक्षित रखे।

### 2026-11-17 — Settings / Notifications / Saved pass
- Settings Hub को dark luxury cards, gold highlights और lavender text दिया।
- Notifications panel, unread state, icons और dividers को dark-violet palette में बदला।
- Saved screen का background, toolbar और empty state luxury theme में बदला।
- Saved media thumbnails, notification actions और settings handlers सुरक्षित रखे।

### 2026-11-17 — Viewed Profile Screen pass
- दूसरे यूज़र की Profile Screen को dark luxury background और violet surfaces दीं।
- Profile stats, username, bio और metadata को lavender/gold palette में बदला।
- Follow/Following और Message buttons को compact रखते हुए luxury colors दिए।
- Status section, Posts/Tagged tabs, empty states और three-dot menu को theme किया।
- Follow, Message, Story, profile loading और post data handlers सुरक्षित रखे।

### 2026-11-17 — Own Profile Screen refinement
- Edit Profile, Save और Create First Post buttons को gold accent दिया।
- Remove Photo action को dark-red luxury treatment दिया।
- Follow Requests के Accept/Reject controls और edit fields के colors सुधारे।
- Profile photo fallback और bio input को dark theme के अनुरूप किया।
- Profile editing, photo, follow-request और post creation handlers सुरक्षित रखे।

### 2026-11-17 — Reels screen visual pass
- Follow button border को champagne gold किया।
- Liked reel heart को gold accent दिया; unliked heart और video overlay icons सफेद रखे।
- Upload Reel action को gold accent दिया।
- Reel playback, active index, mute, paging, scrolling और action handlers अपरिवर्तित रखे।

### 2026-11-17 — Search screen refinement
- Search input border और result dividers को violet किया।
- Search error state को soft red luxury tone दिया।
- Follow और Follow Back actions को gold accent तथा readable dark text दिया।
- Search query, API results और follow-request handlers सुरक्षित रखे।

### 2026-11-17 — Messages / Inbox final refinement
- Inbox tabs, Notes rings और unread badge को gold/violet palette में सुधारा।
- New Message और message action buttons को champagne-gold accent दिया।
- Received message bubbles के reply preview को dark purple किया।
- Message text, timestamps, typing और error states की readability सुधारी।
- Reply, Unsend, media, emoji, send और delivery/read handlers सुरक्षित रखे।

### 2026-11-17 — Photo / Video Camera visual pass
- Camera screen background और gallery surface को dark luxury palette दी।
- Photo/Video mode selector और gallery action को gold/violet theme में बदला।
- Photo filters, capture ring और recording indicator को theme के अनुरूप किया।
- Retake, Use Photo, Use Video और recording handlers सुरक्षित रखे।

### 2026-11-17 — Media Preview / Story / Post / Reel Editor pass
- Media editor surfaces, header और dividers को dark luxury theme दी।
- Story upload, Share और editor actions को gold/violet accents दिए।
- Photo filters, music controls और zoom-effect settings को theme किया।
- Caption input, labels और media navigation की readability सुधारी।
- Media preview, crop/edit, music, zoom और upload handlers सुरक्षित रखे।
