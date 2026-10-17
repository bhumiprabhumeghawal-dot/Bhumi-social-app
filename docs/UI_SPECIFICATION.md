# SocialApp — UI Specification

Version: 1.0
Status: Draft — pending screen-by-screen review
Reference: BLUEPRINT.md

## 1. UI Rules

- Initial interface language: English.
- Use original SocialApp branding and assets.
- Use familiar social-media interaction patterns.
- Do not copy proprietary logos, artwork, or assets.
- Do not change an approved screen without recording the change.
- Every interactive control must have a defined action.
- Every network-backed screen must handle loading, empty, success,
  offline, and error states as appropriate.
- Destructive actions require confirmation.
- Accessibility labels and adequate touch targets are required.
- Support light and dark themes.
- Keep navigation behavior consistent across screens.

## 2. Primary Navigation

Five primary destinations:

1. Home
2. Search
3. Create
4. Reels
5. Profile

The navigation bar must indicate the current destination.
Navigation must not unexpectedly discard unsaved content.
Back navigation must behave consistently.

## 3. Screen Inventory

### A. Startup and Authentication

#### A1. Splash / Startup
- App branding and startup progress.
- Check session state.
- Route to Home or Login.
- Show a recoverable error if initialization fails.

#### A2. Welcome
- Sign in action.
- Create account action.
- Terms and privacy links.

#### A3. Registration
- Username.
- Display name.
- Email or phone according to the selected authentication design.
- Password and confirmation where applicable.
- Input validation.
- Terms acceptance where required.
- Submit and loading states.
- Clear field-level errors.

#### A4. Login
- Username/email/phone field according to the final auth design.
- Password.
- Show/hide password.
- Login button.
- Forgot password.
- Registration link.
- Loading, invalid credentials, offline, and server-error states.

#### A5. Password Recovery
- Account identifier input.
- Submit recovery request.
- Neutral confirmation that avoids account enumeration.
- Error and retry handling.

#### A6. Verification
- Verification instructions.
- Code or link workflow depending on the chosen provider.
- Resend control with cooldown where supported.
- Expired and invalid verification states.

## 4. Home and Feed

### H1. Home Feed
- Top app bar and approved brand treatment.
- Stories row.
- Feed posts.
- Pull-to-refresh.
- Incremental loading.
- Empty-feed guidance.
- Retry after network failure.

### H2. Story Tray
- Avatar.
- Account name.
- Unseen-story indication.
- Open story viewer.
- Create-own-story entry when applicable.

### H3. Post Card
- Author avatar and username.
- Post timestamp.
- Options menu.
- Image/video/carousel media.
- Caption and expandable text where needed.
- Hashtags and mentions.
- Like control and count.
- Comment entry.
- Share action.
- Save/unsave action.
- Open author profile.
- Report action where permitted.

### H4. Post Options
- Edit own post when supported.
- Archive own post when supported.
- Delete own post.
- Report another account's post.
- Block or mute author where permitted.
- Confirmation for destructive actions.

### H5. Post Details
- Full media and caption.
- Comments list.
- Comment composer.
- Like and save controls.
- Loading, empty, and retry states.

## 5. Search and Explore

### S1. Search Landing
- Search input.
- Recent searches.
- Clear history.
- Suggested content or accounts.

### S2. Search Results
- Accounts results.
- Posts results.
- Reels results.
- Hashtag results.
- Appropriate empty and error states.

### S3. Explore
- Discoverable posts and reels.
- Open content.
- Open creator profiles.
- Pagination or incremental loading.

### S4. Hashtag Page
- Hashtag title.
- Eligible related posts and reels.
- Empty, loading, and error states.

## 6. Create and Upload

### C1. Create Menu
- Create Post.
- Create Story.
- Create Reel.
- Only show options that are implemented and supported.

### C2. Media Picker
- Select photos and videos.
- Multi-select where supported.
- Selection count.
- Preview selection.
- Permission-denied guidance.
- Unsupported-file feedback.

### C3. Media Editor
- Preview.
- Crop.
- Zoom.
- Rotate.
- Position.
- Aspect ratio.
- Reorder carousel items.
- Continue and cancel actions.
- Preserve selection when moving between editing steps.

### C4. Post Composer
- Media preview.
- Caption input.
- Hashtags and mentions.
- Optional location.
- Audience setting.
- Accessibility text where supported.
- Publish action.
- Prevent accidental duplicate submission.

### C5. Story Composer
- Selected photo/video preview.
- Supported text overlay options.
- Audience controls.
- Publish action.
- Upload progress and retry.

### C6. Reel Composer
- Video selection/capture.
- Video preview and playback.
- Caption.
- Hashtags and mentions.
- Cover selection where supported.
- Video validation.
- Publish action.
- Processing and upload states.

### C7. Upload Status
- Progress where available.
- Uploading, processing, succeeded, failed, and cancelled states.
- Retry failed uploads.
- Clear reason for validation failures.
- Never claim success before server confirmation.
- Avoid duplicate posts after retries.

## 7. Stories

### ST1. Story Viewer
- Full-screen story media.
- Progress indicator.
- Next and previous navigation.
- Pause/resume where supported.
- Close viewer.
- Author profile navigation.
- Story actions according to ownership and privacy.

### ST2. Story Viewers
- Available to the story owner.
- List viewers when permitted.
- Loading and empty states.

### ST3. Story Archive
- Archived stories.
- Open and delete actions.
- Restore or add to highlights where supported.

### ST4. Story Highlights
- Highlight list on profile.
- Create/edit highlight.
- Select archived stories.
- Remove story from highlight.
- Delete highlight with confirmation.

## 8. Reels

### R1. Reels Feed
- Vertical media player.
- Creator identity.
- Caption and hashtags.
- Like, comment, share, and save actions.
- Open creator profile.
- Report action.
- Playback/loading/error states.
- Efficient media loading and release of off-screen players.

### R2. Reel Comments
- Comments list.
- Add comment.
- Reply and like where supported.
- Delete own comment where permitted.
- Retry and empty states.

### R3. Own Reel Management
- Open reel details.
- Edit permitted metadata.
- Delete reel with confirmation.
- Show upload or processing state where relevant.

## 9. Profiles and Social Graph

### P1. Own Profile
- Avatar.
- Display name.
- Immutable username.
- Bio.
- Post/follower/following counts.
- Posts, reels, and tagged-content tabs where supported.
- Edit profile.
- Settings/menu access.
- Saved content access for owner only.

### P2. Other User Profile
- Avatar and identity.
- Bio and counts subject to privacy.
- Follow/unfollow or request action.
- Message action when allowed.
- Posts/reels according to account privacy.
- Report, block, and mute actions.

### P3. Edit Profile
- Display name.
- Bio.
- Avatar controls.
- Save and cancel.
- Show next eligible display-name change date.
- Username is read-only and cannot be changed through this screen.

### P4. Avatar Editor
- Select from gallery or camera where supported.
- Crop, zoom, and position.
- Preview.
- Save, replace, or delete.
- Upload progress and retry.
- Refresh avatar across the application after confirmed success.

### P5. Followers and Following
- List accounts.
- Open profiles.
- Follow/unfollow where appropriate.
- Remove follower where permitted.
- Loading, empty, and error states.

### P6. Follow Requests
- Incoming requests.
- Accept and decline.
- Outgoing requests where supported.
- Cancel outgoing request.
- Confirm state changes.

## 10. Likes, Comments, and Saved Content

### L1. Likes List
- Eligible users who liked the content.
- Privacy-aware visibility.

### L2. Comment Composer
- Text input.
- Mention support where implemented.
- Submit progress.
- Validation and failure feedback.

### L3. Saved Posts
- Private list of saved posts.
- Open post.
- Unsave.
- Empty state.

### L4. Archive
- Own archived posts.
- Restore or delete actions.
- Confirmation for deletion.

## 11. Messaging

### M1. Inbox
- Conversation list.
- Latest-message preview.
- Unread indicator where supported.
- Search conversations where supported.
- Message-request entry.

### M2. Conversation
- Message history.
- Text composer.
- Supported attachments.
- Send status and retry.
- Reactions and replies where supported.
- Read/delivery status according to settings.
- Conversation options.

### M3. Message Requests
- Request list.
- Preview according to privacy rules.
- Accept or decline.
- Report or block actions.

### M4. Conversation Details
- Participant profile.
- Mute controls.
- Block/report controls.
- Other supported conversation settings.

## 12. Notifications

### N1. Notification List
- Follow activity.
- Follow requests.
- Likes, comments, replies, and mentions.
- Message notifications where supported.
- Open related profile or content.
- Read/unread state.
- Loading, empty, and error states.

### N2. Notification Settings
- Push notification preferences.
- Activity category controls where supported.
- Respect system notification permission.

## 13. Settings and Safety

### SET1. Settings Home
- Account.
- Privacy.
- Security.
- Notifications.
- Blocked accounts.
- Muted accounts.
- Help and support.
- Terms and privacy policy.
- Log out.

### SET2. Privacy
- Public/private account setting.
- Story audience.
- Mentions and tags.
- Message requests.
- Other documented privacy controls.

### SET3. Security
- Session management.
- Password/security actions supported by the chosen auth design.
- Security event feedback where supported.

### SET4. Blocked Accounts
- Blocked account list.
- Unblock with confirmation.
- Refresh visibility and permissions after changes.

### SET5. Muted Accounts
- Muted account list.
- Unmute.
- Explain mute behavior in the interface.

### SET6. Report Flow
- Select report reason.
- Confirm target content/account.
- Submit report.
- Confirmation and failure handling.
- Do not reveal confidential moderation information.

### SET7. Account Lifecycle
- Deactivation explanation.
- Account deletion explanation.
- Re-authentication if required.
- Explicit confirmation.
- Explain consequences and recovery rules before final submission.

## 14. Shared UI Components

- Avatar.
- User identity row.
- Post card.
- Reel action rail.
- Media viewer.
- Loading indicator.
- Empty state.
- Error message with retry.
- Confirmation dialog.
- Bottom navigation.
- Form field and validation message.
- Upload progress component.
- Toast/snackbar feedback.
- Accessible icon button.

Shared components should be implemented once where practical, with
consistent behavior across screens.

## 15. Screen State Requirements

Each relevant screen must specify:
- Initial/loading state.
- Successful state.
- Empty state.
- Validation failure.
- Network/offline failure.
- Server failure.
- Retry behavior.
- Permission-denied state where applicable.
- Unauthorized or expired-session behavior.
- Navigation after success or cancellation.

## 16. Navigation Requirements

- The selected bottom-navigation destination is visually identifiable.
- Opening a profile from a post must not lose unrelated draft content.
- Back navigation must follow a consistent screen stack.
- Unsubmitted drafts should warn before being discarded when appropriate.
- Deep links must validate access before showing private content.
- A failed navigation request must provide understandable feedback.

## 17. Accessibility and Themes

- Accessible control labels.
- Screen-reader-friendly content order.
- Sufficient contrast.
- Adequate touch targets.
- Text scaling support.
- Keyboard handling for forms.
- Light, dark, and system theme choices.
- Reduced-motion behavior where appropriate.

## 18. UI Acceptance Checklist

- [ ] Every screen in this inventory has a route or navigation entry.
- [ ] Every interactive control has a documented action.
- [ ] Every relevant screen has loading, empty, and error behavior.
- [ ] Destructive actions have confirmation.
- [ ] Private content respects account and block settings.
- [ ] Upload success requires server confirmation.
- [ ] Avatar changes refresh consistently.
- [ ] Username remains immutable.
- [ ] Display-name cooldown is enforced by the server.
- [ ] Accessibility labels are provided.
- [ ] Light and dark themes are reviewed.
- [ ] UI tests cover critical navigation and actions.
- [ ] Changes are recorded in PROGRESS.md and ERROR_LOG.md as needed.

## 19. Status

This is a draft screen inventory, not proof that the screens exist.
Detailed layouts, exact colors, icon assets, spacing, and interaction
prototypes require review before implementation.

No Android UI implementation has been verified yet.
