# SocialApp — Master Project Blueprint

## 1. Project Identity

- Working name: Bhoomi Social
- Android application ID: com.bhoomi.social
- Project root: ~/SocialApp
- Documentation directory: ~/SocialApp/docs
- Project type: Independent social media application
- Initial UI language: English
- Initial implementation target: Android
- Required platforms: Android phones and Apple iPhone (iOS)
- Architecture must be evaluated for cross-platform support before implementation
- Future integration: BhoomiAI and BPK Server, subject to explicit design decisions
- Primary product inspiration: Familiar Instagram-style layouts and interactions
- Branding: Original name, logo, assets, and visual identity

This is a new project. It must not depend on the deleted BhoomiAI
project's source files, databases, or runtime.

## 2. Project Rules

1. This document is the master feature inventory.
2. Every feature must have a defined purpose and documented location.
3. Do not silently remove, replace, or skip an approved feature.
4. Do not change an approved screen design without authorization.
5. Record significant architecture and implementation decisions.
6. Update PROGRESS.md when work starts, finishes, or is blocked.
7. Record reproducible errors, root causes, fixes, and verification in ERROR_LOG.md.
8. Test changes before marking them complete.
9. Never mark an untested feature as complete.
10. Protect user data and existing projects.
11. Do not commit real passwords, API keys, signing keys, or private tokens.
12. Use original branding and assets rather than copying proprietary assets.
13. Keep the Android application independent of BhoomiAI during initial development.
14. Design clean integration boundaries for possible future integrations.
15. Do not declare the application production-ready before security and release tests pass.

## 3. Feature Status Definitions

- PLANNED: Documented but not implemented.
- IN_PROGRESS: Implementation has started.
- IMPLEMENTED: Code exists, but complete verification is pending.
- TESTED: Required tests passed in the documented environment.
- BLOCKED: Work cannot continue until a dependency or issue is resolved.
- DEFERRED: Intentionally postponed and recorded with a reason.

A feature is not complete merely because its screen or button exists.

## 4. Main Application Navigation

The planned primary navigation contains five destinations:

1. Home
2. Search / Explore
3. Create
4. Reels
5. Profile

Each destination must have a defined screen, interaction behavior,
loading state, empty state, error state, and navigation behavior.

Final icon shapes, spacing, colors, typography, and screen details
must be documented in UI_SPECIFICATION.md before implementation.

## 5. Authentication and Account Management

- Account registration
- Login and logout
- Secure password storage on the server
- Username availability and validation
- Email or phone verification, depending on the selected provider
- Password reset
- Session management
- Login failure handling and rate limiting
- Account recovery
- Account deactivation
- Account deletion and confirmation
- Appropriate handling of deleted accounts and associated content

Provider choices and verification requirements must be finalized
before implementing external authentication dependencies.

## 6. Home Feed

- Feed containing eligible posts from followed accounts
- Post author avatar, username, and timestamp
- Image and video posts
- Multi-image carousel posts
- Captions and hashtags
- Like and unlike
- Comment access
- Share action
- Save and unsave
- Author profile navigation
- Follow and unfollow where appropriate
- Post options menu
- Report and block actions
- Pull-to-refresh
- Pagination or incremental loading
- Loading, empty, offline, and error states
- Prevention of duplicate feed entries where appropriate

Feed ranking and recommendation rules must be documented separately.
Start with a predictable feed before introducing complex ranking.

## 7. Stories

- Create a story using a photo or supported video
- Select media from the device
- Camera capture where supported
- Caption or supported text overlays
- Story upload progress
- Upload retry and failure feedback
- Story viewer
- Next and previous story navigation
- Pause and resume playback
- Story progress indicator
- Viewers list for the story owner
- Story view tracking
- Story expiry after 24 hours
- Story privacy and audience controls
- Delete own story
- Archive expired stories where enabled
- Story highlights on profiles
- Add and remove stories from highlights
- Loading and playback error states

Story expiry must be enforced by trusted server-side timestamps,
not only by the device clock.

## 8. Posts and Media Creation

- Select one or more photos
- Select supported videos
- Capture media using the camera where supported
- Preview selected media
- Crop
- Zoom
- Rotate
- Position and aspect-ratio controls
- Reorder carousel items
- Caption editor
- Hashtags
- Account mentions
- Optional location
- Audience selection
- Accessibility text where supported
- Preview before publishing
- Upload progress
- Retry failed uploads
- Cancel an unfinished upload safely
- Publish confirmation
- Edit own caption where permitted
- Delete own post
- Post details
- Post media playback and rendering
- Duplicate-submission protection
- Clear error messages for invalid or unsupported files

Supported media types, file-size limits, duration limits, and image
processing rules must be defined in the media specification.

The UI must never report a post as published before the server confirms
successful creation.

## 9. Reels

- Dedicated vertical-video feed
- Vertical video playback
- Play and pause
- Mute and unmute
- Next and previous reel
- Creator profile navigation
- Like and unlike
- Comments
- Share
- Save
- Caption and hashtags
- Video upload
- Video preview
- Video duration and file validation
- Upload progress and retry
- Processing status where video processing is required
- Playback error recovery
- Report and block actions
- Own reel management and deletion
- Pagination and efficient media loading

Advanced editing, music licensing integrations, effects, and complex
video transitions may be delivered in later phases.

## 10. Search and Explore

- Search users by username and display name
- Search hashtags
- Search eligible posts
- Search reels
- Recent searches
- Clear search history
- Explore feed
- Discover accounts
- Follow and unfollow from eligible results
- Open profile, post, or reel from results
- Loading, empty, and failure states
- Appropriate visibility rules for private or blocked accounts

Search results must respect privacy, blocking, and content visibility.

## 11. User Profiles

- Profile photo / avatar
- Display name
- Unique username
- Biography
- Post count
- Followers count
- Following count
- Posts tab
- Reels tab
- Tagged-content tab where supported
- Follow / unfollow
- Follow request controls
- Message action where permitted
- Saved posts for the owner
- Profile editing
- Profile privacy settings
- Account menu
- Report and block controls
- Empty profile states
- Profile loading and error states

### Username and Display Name Rules

- Username becomes immutable after account creation.
- Username changes must not be exposed as a normal profile-edit action.
- Display name can be changed at most once every three months.
- The server must enforce the display-name cooldown.
- The app must explain when another change becomes available.
- Reinstalling the app or changing devices must not reset this restriction.

### Profile Photo Management

- Select from gallery
- Capture from camera where supported
- Crop, zoom, and position
- Preview
- Save changes
- Replace photo
- Delete photo
- View larger photo where appropriate
- Upload progress and retry
- Consistent avatar updates throughout the application

Avatar updates must propagate to profiles, posts, comments, search,
stories, and messaging wherever the current avatar is displayed.
Use a consistent server-backed profile identity and safe cache refresh.

## 12. Followers and Following

- Followers list
- Following list
- Follow and unfollow
- Follow requests for private accounts
- Accept and decline follow requests
- Cancel outgoing requests
- Remove a follower where permitted
- Follow-request notifications
- Follower counts
- Duplicate follow prevention
- Privacy-aware list visibility

## 13. Likes, Comments, and Sharing

- Like and unlike posts
- Like and unlike reels
- Add comments
- Delete own comments where permitted
- Reply to comments
- Comment likes where supported
- Mentions in comments
- Comment loading and pagination
- Comment moderation controls
- Share posts and reels through supported destinations
- Copy share link where available
- Report abusive content
- Respect account privacy and blocking
- Prevent duplicate actions and inconsistent counts

## 14. Saved Posts and Archive

- Save a post
- Unsave a post
- View saved posts privately
- Organize saved posts into collections in a later phase
- Archive own posts
- Restore archived posts
- Delete own posts
- Story archive
- Story highlights
- Ownership and authorization checks for all archive operations

Saved content must remain private unless an explicitly documented
sharing feature is introduced.

## 15. Direct Messaging

- Inbox
- Conversation list
- One-to-one conversations
- Text messages
- Photo and video attachments where supported
- Message sending status
- Delivery status where supported
- Read receipts subject to privacy settings
- Message reactions
- Reply to a message
- Delete or unsend rules, clearly documented
- Message requests
- Accept or decline requests
- Conversation mute
- Block-aware messaging
- Report conversation or message
- Pagination of message history
- Retry for failed messages
- Duplicate-message protection
- Offline and reconnection handling

Real-time transport technology and end-to-end encryption requirements
must be evaluated and explicitly decided before implementation.
Do not claim end-to-end encryption unless it is actually implemented
and independently tested.

## 16. Notifications

- New follower
- Follow request
- Follow request accepted
- Likes
- Comments and replies
- Mentions
- Story interactions where supported
- Message notifications
- Notification list
- Read and unread status
- Mark as read
- Mark all as read
- Notification navigation
- Duplicate notification prevention
- Notification privacy settings
- Push notifications when a provider is selected
- Graceful handling of disabled notification permission

## 17. Settings, Privacy, and Safety

- Account settings
- Profile privacy
- Private and public account behavior
- Message-request settings
- Mention and tag controls
- Story audience controls
- Blocked accounts
- Muted accounts
- Restrict controls where supported
- Report account, post, reel, story, or message
- Account security
- Session review and logout
- Notification preferences
- Media and data preferences where appropriate
- Account deactivation
- Account deletion
- Help and support
- Community guidelines
- Terms and privacy policy

Every security-sensitive operation must be authorized by the server.
Hiding a button in the UI is not sufficient security.

## 18. Tags, Mentions, and Hashtags

- Hashtag recognition
- Hashtag search
- Post-to-hashtag associations
- Account mentions in captions
- Mentions in comments
- Mention notifications
- Tagged-content visibility controls
- Duplicate and invalid hashtag handling
- Safe parsing and display of user-generated text

## 19. Media Storage and Upload Reliability

- Client-side validation for user feedback
- Server-side validation for every upload
- Allowed MIME types and actual content verification
- File-size and video-duration limits
- Safe filenames and storage paths
- Upload progress
- Upload failure reasons
- Retry behavior
- Cancellation behavior
- Duplicate-submission protection
- Media ownership checks
- Secure media access
- Thumbnail generation where required
- Image resizing and compression where appropriate
- Video processing status where required
- Cleanup of abandoned temporary uploads
- Cleanup of unreferenced media
- Storage quotas and abuse protection
- Cache invalidation after media changes
- Recovery from network interruptions

Never trust client-supplied filenames, MIME types, user IDs, or
authorization claims without server-side verification.

## 20. Backend and API

Use a versioned API, provisionally under /api/v1/.

Proposed resource groups:

- /auth
- /users
- /profiles
- /posts
- /media
- /stories
- /highlights
- /reels
- /feed
- /search
- /hashtags
- /follows
- /follow-requests
- /likes
- /comments
- /saved-posts
- /archive
- /conversations
- /messages
- /notifications
- /settings
- /blocks
- /mutes
- /reports
- /health

Exact methods, paths, payloads, status codes, pagination, and error
formats must be finalized in API_CONTRACT.md before implementation.

Backend technology, hosting, media storage, database engine, and
real-time communication technology remain architecture decisions
until documented and approved.

## 21. Database Planning

The initial logical model must evaluate these entities:

- users
- profiles
- sessions
- user_settings
- posts
- post_media
- reels
- stories
- story_views
- story_highlights
- highlight_items
- follows
- follow_requests
- likes
- comments
- saved_posts
- saved_collections
- conversations
- conversation_members
- messages
- message_attachments
- notifications
- hashtags
- post_hashtags
- mentions
- blocked_users
- muted_users
- reports
- media_assets
- upload_jobs
- audit_events where appropriate

This is a planning inventory, not a finalized SQL schema.
DATABASE_SCHEMA.md must define keys, indexes, constraints, relationships,
deletion behavior, timestamps, migrations, and privacy requirements.

## 22. Android Application Architecture

Proposed functional areas:

- core
- auth
- navigation
- home
- posts
- media
- stories
- reels
- search
- profile
- follows
- comments
- saved
- messaging
- notifications
- settings
- privacy
- reporting
- networking
- persistence
- testing

The final module and package structure must be documented before
major implementation begins.

Choose the Android language, UI framework, minimum supported Android
version, build configuration, and dependency versions deliberately.
Do not add unnecessary dependencies.

## 23. UI and Accessibility

- Familiar, polished social-media navigation
- Consistent spacing, typography, icons, and component behavior
- Approved screen designs recorded in UI_SPECIFICATION.md
- Light theme
- Dark theme
- System theme preference
- Loading indicators and skeleton states where appropriate
- Empty states
- Error and retry states
- Accessible labels for controls
- Adequate touch targets
- Screen-reader support
- Keyboard and form behavior
- Media loading placeholders
- Responsive layouts for supported screen sizes
- Clear permission prompts
- No silent destructive actions
- Confirmation for high-impact actions

Use original branding and assets. The design can be inspired by common
social-media interaction patterns without copying proprietary assets.

## 24. Reliability and Performance

- Pagination for large lists
- Efficient image loading
- Thumbnail use where appropriate
- Caching with clear invalidation rules
- Network timeout handling
- Retry with bounded backoff
- Offline and reconnect states
- Background upload behavior where supported
- Memory-efficient video playback
- Duplicate-action protection
- Database indexes
- API response validation
- Crash and error diagnostics without leaking secrets
- Safe migration and upgrade behavior

## 25. Security and Privacy

- Strong password hashing on the server
- Secure session/token lifecycle
- Server-side authorization
- Input validation
- Rate limiting
- Upload validation
- SQL injection prevention
- Safe handling of user-generated content
- Private-account enforcement
- Block and mute enforcement
- Secure secret management
- HTTPS in deployed environments
- Protection of private media
- Account deletion and retention rules
- Minimal collection of personal information
- Redaction of credentials and sensitive data from logs
- Backup and restore procedures
- Dependency and configuration review

Security controls must be tested; a written policy alone is insufficient.

## 26. Testing Requirements

- Unit tests
- API tests
- Database constraint tests
- Authentication and authorization tests
- Upload tests
- Media validation tests
- UI navigation tests
- Form validation tests
- Privacy tests
- Block and follow tests
- Story expiry tests
- Reels playback tests
- Message delivery and retry tests
- Notification tests
- Offline and poor-network tests
- Duplicate submission tests
- Migration tests
- Performance tests
- Security tests
- Release build tests
- Fresh installation tests
- Upgrade tests
- Backup and recovery tests

For every feature, document expected behavior and actual test results.
A passing build alone does not prove that the feature works.

## 27. Documentation Set

The following documents are planned:

- docs/BLUEPRINT.md
- docs/UI_SPECIFICATION.md
- docs/DATABASE_SCHEMA.md
- docs/API_CONTRACT.md
- docs/SECURITY.md
- docs/TEST_PLAN.md
- docs/PROGRESS.md
- docs/ERROR_LOG.md
- docs/ARCHITECTURE_DECISIONS.md
- README.md

The blueprint is the master feature inventory.
Detailed documents must agree with it.
If requirements change, update all affected documents together.

## 28. Development Roadmap

Phase 0: Requirements, blueprint, screen map, and architecture decisions.

Phase 1: Project foundation, build setup, navigation, design system,
networking, environment configuration, and automated checks.

Phase 2: Registration, login, profiles, and account security.

Phase 3: Posts, media upload, feed, likes, comments, and saved posts.

Phase 4: Stories, story viewer, expiry, archive, and highlights.

Phase 5: Reels, video upload, playback, and reliability.

Phase 6: Search, Explore, hashtags, mentions, follows, and notifications.

Phase 7: Direct messaging and message requests.

Phase 8: Privacy, reporting, blocking, moderation, settings, and account
lifecycle features.

Phase 9: Accessibility, performance, security testing, recovery, and
release preparation.

Phase 10: Future integration with BhoomiAI and BPK Server, after separate
architecture review and explicit approval.

The phases may be adjusted when dependencies require it, but changes
must be recorded in PROGRESS.md and ARCHITECTURE_DECISIONS.md.

## 29. Definition of Done

A feature can be marked TESTED only when:

1. Its requirements are documented.
2. Its UI and behavior match the approved specification.
3. Its API and data rules are implemented where required.
4. Success and failure states have been tested.
5. Privacy and authorization rules have been checked.
6. Relevant automated tests pass.
7. Manual verification is recorded where necessary.
8. No known critical regression remains.
9. Documentation and PROGRESS.md are updated.
10. ERROR_LOG.md records any issue encountered and its resolution.

## 30. Current Project Status

- Project directory created: YES
- Documentation directory created: YES
- Master blueprint: IN_PROGRESS
- UI specification: PLANNED
- Database schema: PLANNED
- API contract: PLANNED
- Security plan: PLANNED
- Test plan: PLANNED
- Progress tracker: PLANNED
- Error log: PLANNED
- Android source implementation: NOT STARTED
- Backend implementation: NOT STARTED

No feature should be claimed implemented until actual source code exists
and the required verification has been completed.

## 31. Cross-Platform and Device Compatibility

- Support Android phones across a broad range of screen sizes and hardware.
- Plan for Apple iPhone/iOS support from the beginning.
- Evaluate cross-platform frameworks before choosing the implementation stack.
- Keep shared backend APIs and data rules platform-independent.
- Adapt layouts to screen sizes, resolutions, safe areas, and system navigation.
- Consider memory, CPU, storage, battery, and network limitations.
- Handle permissions and media selection according to each platform.
- Test Android and iOS versions on real devices or suitable simulators.
- Do not claim platform support until testing confirms it.
- Keep approved Instagram-inspired layouts consistent across platforms.
- Use original Bhoomi Social branding and assets.

## 32. App Language Policy

- The entire app interface must use English only.
- Do not include Hindi or other languages in buttons, menus, settings, messages, notifications, or system-generated UI text.
- Keep user-facing app errors and validation messages in English.
- Apply the same English-only policy to Android and iOS.
