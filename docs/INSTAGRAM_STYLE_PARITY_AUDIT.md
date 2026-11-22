# Bhumi Social AI — Instagram-style parity audit

This is the working checklist for the full mobile UI and interaction pass. The goal is familiar social-app navigation and interaction patterns while retaining Bhumi Social AI branding, original assets, and backend contracts.

## Responsive sizing rules

All measurements below are React Native density-independent pixels (dp), not raw device pixels. Screen dimensions must come from the current safe-area viewport; do not hard-code one phone's pixel resolution.

- Home top bar: 58 dp high.
- Story item slot: 68 dp wide; story ring 64 dp; inner ring 60 dp; avatar 54 dp.
- Feed post header: 58 dp high; avatar 36 dp.
- Feed media: use the available feed viewport and the media's supported aspect ratio; never stretch media to fill a mismatched ratio.
- Reels: one viewport-height item per page, with only the active reel playing.
- Bottom navigation: 68 dp Android / 58 dp iOS, including platform-specific bottom inset handling.
- Profile avatar frame currently uses 86 dp; verify against compact and large screens during device QA.
- Settings sheet currently caps at 94% of available height and must remain scrollable on short screens and with the keyboard open.

## Screen-by-screen acceptance checklist

### Home and feed
- [x] Fixed top bar with create, notifications, and messages actions.
- [x] Horizontal story row and vertically scrolling feed.
- [x] Story avatar sizing pass and contrasting ring colors.
- [ ] Verify story viewer progress, tap zones, hold-to-pause, reply/share controls, and full-screen media on small and large screens.
- [ ] Verify feed post action row, caption expansion, comments, share, save, and overflow menu alignment.
- [ ] Verify media ratio behavior for portrait, square, landscape, carousel, and video posts.
- [ ] Verify swipes that begin on media still scroll the feed unless the media is intentionally zoomed.

### Reels
- [x] Full viewport paging and active-index tracking.
- [x] Active-only video playback wiring.
- [x] Remove the blocking empty-Reels alert; the Reels screen now owns its empty state and upload action.
- [ ] Verify right-side action rail, caption truncation, follow state, comments sheet, share sheet, and mute state.
- [ ] Verify swipe/zoom interaction and safe-area placement across Android devices.

### Inbox and direct messages
- [x] Full-screen inbox with All, Primary, General, and Requests filters; unclassified conversations now default to Primary.
- [x] Notes row, search, unread filter, and new-message entry.
- [x] Direct conversation with presence, typing, attachments, voice recording, and call controls.
- [x] Fixed dark-mode contrast problems in inbox controls and received-message text.
- [x] Updated default chat bubble styling and theme preview.
- [x] Confirm inbox includes All, Primary, General, Requests, search, unread filter, Notes, and a separate conversation view in the current UI.
- [x] Make empty states reflect the active search, unread-only toggle, and inbox folder instead of incorrectly showing an empty inbox only when the entire conversation list is empty.
- [ ] Verify unread counts, request acceptance, conversation ordering, sent/received state, and message delivery errors.
- [x] Implement persisted per-user Primary/General/Requests conversation assignment with an authenticated folder endpoint and an inbox row action (request → Primary; Primary ↔ General).
- [ ] Verify image/video/document previews, download/open behavior, voice playback, and keyboard avoidance.
- Note: sent messages belong inside their conversation thread; a separate outbox screen is not part of the usual Instagram DM navigation model.

### Search and profiles
- [ ] Verify search field, recent searches, people discovery, result rows, follow/request states, and profile navigation.
- [x] Normalize the profile avatar and fallback-image dimensions so they share one consistent circular frame.
- [ ] Verify profile header, counts, bio, edit profile, story highlights, post/reel/tagged tabs, saved posts, and overflow menu.
- [ ] Verify followers/following lists and private-account request states.

### Create, camera, and editors
- [ ] Verify create menu placement and camera/gallery entry points.
- [ ] Verify story, post, and reel capture previews, crop/ratio controls, filters, music/audio, caption, and publishing states.
- [ ] Verify permissions and graceful failure states without breaking existing upload APIs.

### Notifications, settings, privacy, and account
- [x] Fix notification dark-mode row and filter-chip contrast.
- [x] Add visible notification loading feedback and filter-specific empty states.
- [ ] Verify notification unread state, navigation to the related post/profile, and server synchronization.
- [x] Add settings search and filtered category results; category-name searches preserve the full category list when opened.
- [ ] Verify privacy, blocked/restricted accounts, login/security, notifications, appearance, account controls, and logout.
- [x] Align Creator & Business Hub colors with the app-wide dark surface and blue accent system.
- [x] Replace Creator & Business Hub system alerts with inline feedback and an in-app catalog-delete confirmation.
- [ ] Verify all setting actions are functional and do not merely show placeholder notices.

- [x] Add a dedicated Messages notification filter so DM alerts are visible without mixing them into Likes, Comments, or Follows.

- [x] Source includes incoming/outgoing call signaling, push-token registration, CallKeep lock-screen integration, and LiveKit room-token flow; [ ] verify Render LIVEKIT_URL/API key configuration and real-device audio/video end-to-end before calling this complete.

- [x] Align system appearance and status-bar icon contrast with the app's dark Instagram-style surfaces.

### Quality gates
- [x] Correct a malformed confirm-password TextInput attribute discovered during source review.
- [x] Python backend compile, backend unit tests, and media-storage checks passed in GitHub CI; npm install passed on Node 18/20/22.
- [ ] JavaScript/React Native bundle syntax and dependency compatibility check still pending; package.json has no build/test scripts, and no Expo/Android build was run.
- [ ] Android and iOS layout review at compact and large viewport sizes.
- [ ] End-to-end checks for login persistence, post/story/reel publishing, likes/comments/saves, follow requests, DM delivery, and calls.
- [ ] Confirm no regression in feed/reel scrolling, zoom coordination, and active-only reel playback.
- [ ] Only after these checks, create a release APK; this branch is not a release build.

## Release policy

- Do not trigger Android APK builds, EAS builds, or release workflows while this parity pass is in progress.
- Build only after the full screen checklist, static checks, and device QA have been completed and the user is told the result.


- Latest PR CI checks passed on the current branch head: Backend unit tests, Python compile/media-storage checks, and Node 18/20/22 install/build-if-present/test-if-present jobs. Since package.json defines no build/test scripts, this does not prove the Expo bundle or native app works; device QA remains required.

## Current implementation notes

The existing app is a large single-file React Native screen with supporting modules. Changes should be small, isolated, and tested against the existing API and gesture logic. Do not replace the app shell or rewrite the backend as part of a visual-only pass.
