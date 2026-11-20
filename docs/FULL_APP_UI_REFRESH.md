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
