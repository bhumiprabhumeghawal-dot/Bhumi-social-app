# Bhumi Social AI — Full Instagram-inspired UI Refresh

## Product direction
Build a cohesive, original Bhumi Social AI interface inspired by Instagram's interaction patterns and information architecture. Keep Bhumi Social AI branding, logo, backend APIs, authentication/session behavior, user content, and existing capabilities. Do not copy Instagram trademarks, logo, proprietary artwork, or exact branded assets.

## Global design system
- Establish shared design tokens for backgrounds/surfaces, text hierarchy, borders, accent colors, spacing, radii, typography, icon sizes, and touch targets.
- Use one consistent light/dark appearance strategy across every screen and modal; preserve the user's selected theme where supported.
- Standardize safe-area handling, status/navigation bars, keyboard avoidance, loading, empty, error, and offline states.
- Standardize headers, back controls, bottom navigation, sheets, dialogs, menus, badges, avatars, buttons, fields, dividers, and accessibility labels.

## Screen-by-screen coverage checklist

### Entry and account
- Splash/launch, welcome, sign in, sign up, forgot/reset password, verification, session restore, logout and account switching.
- Keep existing authentication API and persistent session behavior intact.

### Main navigation and discovery
- Home feed, story tray, post cards, create menu, Explore/search, Reels, activity/notifications, profile, and bottom navigation.
- Consistent selected/unselected icon states, badges, transitions, scrolling, pull-to-refresh, pagination, and empty/loading states.

### Posts and creation
- Post detail, photo/video viewer, carousel, comments, replies, likes, saves, share sheet, report/block menus.
- Camera/gallery picker, post/story/reel composer, caption editor, filters/effects, upload progress and publish/error states.

### Stories and Reels
- Full-screen story viewer, progress bars, tap/hold/swipe gestures, reactions, replies, viewers and story creation.
- Full-screen Reels viewer, active-item-only playback, audio/mute, like/comment/share/save, creator details, and reel creation.
- Preserve pinch zoom and feed/reel swipe behavior; do not regress gesture handling.

### Direct messages and calling
- Inbox, requests, search, conversation list, notes/status, individual DM thread, message composer, attachments, emoji, voice messages, typing/presence, replies, reactions, unsend, and chat personalization.
- Voice/video call incoming, outgoing, connecting, in-call, controls, mute, speaker, camera flip, local self-preview, remote video, minimized call, and ended/missed states.
- Keep existing call signaling/media/backend integrations; UI work must not claim a calling feature works unless the existing implementation supports it.

### Profiles and social graph
- Own profile, other-user profile, edit profile, avatar, bio, posts/reels/tagged/saved grids, followers/following, follow requests, follow/unfollow states and account menus.

### Activity and safety
- Notifications/activity feed, notification preferences, privacy, blocked/restricted accounts, reports, content controls and account security.

### Settings and utilities
- Settings hub, account, privacy, security, notifications, theme/appearance, language, help/support, about, legal, logout and destructive-action confirmations.
- Every settings row must lead to a real existing screen/action; do not add decorative nonfunctional controls.

## Engineering guardrails
- Keep existing server routes, request/response shapes, database schema, auth tokens, deep links, media uploads, calling transport, and data models unchanged unless a separately verified backend requirement exists.
- Prefer shared reusable UI components and tokens over one-off inline styling.
- Preserve Android/iOS responsive layouts, keyboard behavior, accessibility, and safe areas.
- Keep current feed/reel gesture requirements: scrolling starts from anywhere on a post/media surface; zoom disables feed scrolling only while zoomed; only the active reel plays.
- Do not remove or silently hide existing features.
- Do not claim full completion until every checklist area has been reviewed, implemented, and regression-tested.

## Verification gates
1. Inventory every screen, modal, nested route, and settings destination in the current app.
2. Implement the shared theme/components.
3. Refresh each screen group while preserving its actions and data flows.
4. Verify all navigation destinations and interactive controls.
5. Regression-check auth persistence, post/story/reel creation, feed/reel gestures, messaging, incoming/outgoing calls and local self-preview, profile/follow flows, notifications, and settings.
6. Run the repository's configured lint/type/test checks and Android build only when requested/authorized; report exact pass/fail results.


## Implementation log

### First UI pass committed on `instagram-style-full-ui`
- Replaced the previous purple/gold-heavy app palette with a consistent dark, neutral social-app palette and blue interaction accent across the main app, Settings Dashboard, chat personalization, and calling controls.
- Reworked the primary navigation to Home, Reels, Create, Search, Profile; Create now opens the existing in-app create menu rather than the native chooser.
- Reworked the Home header to keep Bhumi branding on the left and Create, Activity, and Direct Messages actions on the right.
- Preserved existing API calls, session logic, media flows, DM data handling, and calling components.

### Still required before calling this complete
- Review and refresh every remaining modal, profile sub-screen, story/reel composer, post/comment flow, auth screen, notification view, and call-state layout.
- Verify every settings destination and identify controls that currently show a not-connected message.
- Run static checks and device regression tests for navigation, auth, feed/reel gestures, chat, and camera/self-preview calling.
- No APK build has been run and no changes have been merged into `master`.


### Second UI pass committed
- Rebuilt the login/register entry layout around the Bhumi logo and a centered welcome header.
- Made the auth form keyboard-aware and scrollable; restyled input fields and account-type selectors to match the dark social UI.
- Restyled the notifications sheet with a black surface, neutral separators, unread-row contrast, and consistent icon containers.
- Polished profile cards, profile edit fields, and business-profile panels to match the shared visual language.
- Preserved the existing login/register handlers, notification actions, profile save handlers, and server-backed data paths.

### Verification status
- GitHub branch comparison confirms the UI changes are committed and ahead of master.
- No app build, device test, or APK has been run in this pass. These UI changes must still pass compile and device regression checks before merging.


### Video-call self-preview follow-up
- Kept the React Native LiveKit camera-track hook in its documented one-argument form, which returns local and remote camera references; avoided passing the web-components-only subscription options object.
- Retained the local participant publication fallback for the self-preview tile. This is a source-level correction, not proof that the camera renders on-device.
- The change has not been compiled or verified on a physical device; camera permission, device camera availability, and LiveKit runtime behavior still need an actual video-call test.


### Theme consistency follow-up
- Removed remaining legacy purple/brown surface and border colors from business profile panels, connection lists, notification and saved-content headers, and story rings.
- Improved contrast for feed action icons and supporting text against the black feed surface.
- Kept existing handlers, navigation, and data flows unchanged; this was a styling-only pass.
- No build or device verification was run.


### Chat and call theme consistency
- Renamed the default chat theme from “Royal Gold” to “Bhumi Blue” and aligned its base surface with the black-and-blue app identity.
- Neutralized the remaining purple-tinted call control panel surface.
- Preserved alternate user-selectable chat themes and all call controls/handlers.
- No build or device verification was run.


### Settings runtime fix
- Added the missing React Native `StyleSheet` import used by settings preference row separators. Without it, rendering a settings section could throw a runtime reference error.
- This source-level fix has not yet been confirmed by an app build or device test.


### Settings theme label consistency
- Updated the appearance preference label from the legacy “Royal Purple + Gold” wording to “Bhumi Blue Theme”, matching the current default chat/app visual direction.
- Kept the existing preference key and stored setting value unchanged to avoid breaking saved preferences.


### Startup, API and calling responsiveness pass
- Auth session reads now reuse an in-memory session after the first secure read, avoiding repeated SecureStore reads for each authenticated request.
- Home, Stories and Reels now paint their cached data and fresh responses independently; a slow Stories/Reels request no longer delays fresh Home posts.
- API request timeouts allow Render free-instance cold starts to complete while cached content is already available to render.
- Incoming-call and accepted-call status checks now use sequential retry timers instead of overlapping intervals, reducing signaling wait and duplicate requests.
- LiveKit React Native audio session is started before joining a room and stopped on call teardown.
- LiveKit join success/errors are surfaced, and a failed join has an in-call reconnect action.
- Device-level call quality, microphone routing, camera preview and server cold-start timing still require a real-device test; these code changes are not a substitute for that verification.


### Media editor and settings consistency pass
- Removed the remaining legacy gold/purple controls from the post photo/video editor and aligned active controls with Bhumi Blue.
- Standardized remaining business-profile, account and pending-state text/borders to the neutral dark palette.
- Privacy-related Settings actions now open the existing Privacy controls rather than a generic “not available” notice.


### Settings interaction polish
- Replaced native Android alert popups for Settings load/save and unavailable actions with a branded in-app notice panel that matches the dark Bhumi Blue design.
- Settings notices clear when the Settings hub closes; existing preference persistence and action handlers remain intact.


### Video-call camera initialization correction
- Removed the extra local camera bootstrap that was calling setCameraEnabled(true) while LiveKitRoom already receives video={...} and manages local camera publication.
- The room's native camera lifecycle is now the single source of truth; local self-preview continues to use the local camera publication/track reference.
- Must still verify with two real devices because a source-level change cannot confirm camera hardware, permissions or network behavior.


### Welcome, comments and detail surfaces
- Aligned the welcome/onboarding screen, both comments sheets, zoom controls and post-detail backdrop with the same black/neutral surfaces and Bhumi Blue accent.
- Kept the content, gestures, navigation and existing post/comment handlers unchanged.
