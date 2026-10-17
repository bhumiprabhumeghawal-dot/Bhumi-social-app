# SocialApp — Database Schema Plan

Version: 1.0
Status: Draft — architecture review required
Source of requirements: BLUEPRINT.md
Related UI inventory: UI_SPECIFICATION.md

## 1. Purpose

Define the data model for accounts, profiles, social content, media,
relationships, messaging, notifications, privacy, and moderation.

This document describes the planned logical schema. It is not proof
that a database or any table has been implemented.

## 2. Database Design Principles

1. Use stable primary keys.
2. Enforce important invariants in the database where possible.
3. Enforce permissions in the backend, not only in the UI.
4. Store timestamps consistently in UTC.
5. Define foreign keys and deletion behavior explicitly.
6. Add indexes for frequently queried relationships.
7. Use database migrations for schema changes.
8. Avoid storing unnecessary personal information.
9. Never store plaintext passwords.
10. Keep private media protected by authorization checks.
11. Record schema changes in ARCHITECTURE_DECISIONS.md.
12. Test migrations and recovery before release.

The production database engine is not selected yet. SQL types, index
syntax, migration tools, and transaction behavior must be adapted after
the database choice is approved.

## 3. Common Conventions

- Primary key: stable unique identifier.
- created_at: UTC creation timestamp.
- updated_at: UTC last-update timestamp where applicable.
- Foreign keys: point to the owning or referenced record.
- Unique constraints: prevent duplicate logical relationships.
- Status fields: use documented, validated values.
- Soft deletion: use only where product and retention rules require it.
- Media paths: store opaque storage references, not trusted client paths.

Use a consistent identifier strategy across related tables.
Do not expose sequential internal IDs unnecessarily through public APIs.

## 4. Accounts and Profiles

### users
Purpose: Core account identity and authentication state.

Planned fields:
- id
- username
- username_normalized
- password_hash or external_auth_reference
- account_status
- email_verified_at, if email is used
- phone_verified_at, if phone is used
- created_at
- updated_at
- deleted_at, if soft deletion is selected

Constraints:
- Unique normalized username.
- Validate username rules on the server.
- Never store plaintext passwords.
- Deleted, suspended, or disabled accounts must follow documented rules.

### profiles
Purpose: Public-facing profile information.

Planned fields:
- user_id
- display_name
- display_name_last_changed_at
- bio
- avatar_media_id
- created_at
- updated_at

Constraints:
- One profile per user.
- Username is stored in users and is immutable after registration.
- Display-name cooldown is enforced by the server.
- A display-name change is allowed at most once every three months.
- Avatar references must point to valid owned or authorized media.

### sessions
Purpose: Track revocable login sessions.

Planned fields:
- id
- user_id
- token_hash or session_reference
- created_at
- expires_at
- revoked_at
- last_used_at
- device_label where justified

Constraints:
- Store token hashes or use a secure session mechanism.
- Revoke sessions on logout or security events as appropriate.
- Never log raw session tokens.

### user_settings
Purpose: Store user preferences.

Planned fields:
- user_id
- theme_preference
- account_visibility
- notification_preferences
- message_preferences
- mention_preferences
- tag_preferences
- story_audience_defaults
- created_at
- updated_at

Settings must be validated and must not override server security rules.

## 5. Media and Uploads

### media_assets
Purpose: Register uploaded image, video, avatar, and other supported media.

Planned fields:
- id
- owner_user_id
- storage_key
- media_type
- verified_mime_type
- file_size_bytes
- width
- height
- duration_ms for video
- processing_status
- checksum where appropriate
- created_at
- deleted_at where applicable

Constraints:
- Generate storage keys on the server.
- Validate actual file content.
- Enforce size, type, and duration limits.
- Protect private media.
- Do not trust filenames or MIME types supplied by clients.

### upload_jobs
Purpose: Track multi-step or asynchronous uploads.

Planned fields:
- id
- owner_user_id
- media_asset_id where created
- upload_status
- idempotency_key
- error_code
- created_at
- updated_at
- completed_at

Constraints:
- Prevent duplicate publication on retry.
- Permit only valid status transitions.
- Clean up abandoned temporary uploads safely.
- Do not expose internal paths or sensitive error details.

## 6. Posts

### posts
Purpose: Store post metadata.

Planned fields:
- id
- author_user_id
- caption
- audience
- location_label where supported
- post_status
- created_at
- updated_at
- archived_at
- deleted_at where applicable

### post_media
Purpose: Associate ordered media with a post.

Planned fields:
- post_id
- media_asset_id
- position
- accessibility_text where supported

Constraints:
- Preserve carousel ordering.
- A post must have valid media according to the product rules.
- Only authorized users may edit or delete a post.
- Publication must be transactional where required.
- An upload retry must not create duplicate posts.

### likes
Purpose: Record likes on posts and, if selected, reels.

Planned fields:
- id
- user_id
- target_type
- target_id
- created_at

Constraint:
- One active like per user and target.
- Consider separate post_likes and reel_likes tables if stronger
  foreign-key integrity is required.

### comments
Purpose: Store comments and replies.

Planned fields:
- id
- author_user_id
- target_type
- target_id
- parent_comment_id
- body
- created_at
- updated_at
- deleted_at where applicable

Constraints:
- Replies must reference valid parent comments.
- Validate target ownership and visibility.
- Define behavior for deleted parent comments.
- Prevent unauthorized editing or deletion.

### saved_posts
Purpose: Privately save posts for an account.

Planned fields:
- user_id
- post_id
- created_at

Constraint:
- One saved entry per user and post.
- Saved posts are private to the owner by default.

### post_archive
Purpose: Track archived posts if archive state is modeled separately.

Planned fields:
- user_id
- post_id
- archived_at

Ensure archive ownership is checked by the backend.

## 7. Reels

### reels
Purpose: Store reel metadata.

Planned fields:
- id
- author_user_id
- media_asset_id
- caption
- audience
- processing_status
- created_at
- updated_at
- deleted_at where applicable

Constraints:
- Validate video type, size, and duration.
- Do not publish until required processing succeeds.
- Enforce audience and block rules when viewing.
- Define whether reels share likes/comments tables with posts or use
  dedicated tables before implementation.

## 8. Stories and Highlights

### stories
Purpose: Store temporary story entries.

Planned fields:
- id
- author_user_id
- media_asset_id
- caption or overlay metadata where supported
- audience
- created_at
- expires_at
- deleted_at where applicable

Constraints:
- Set expiry using trusted server time.
- Exclude expired stories from normal viewing.
- Define retention and deletion behavior.

### story_views
Purpose: Track eligible story views.

Planned fields:
- story_id
- viewer_user_id
- first_viewed_at
- last_viewed_at where required

Constraint:
- Define whether one row per viewer/story is sufficient.

### story_highlights
Purpose: Store profile highlight groups.

Planned fields:
- id
- owner_user_id
- title
- cover_media_id where supported
- created_at
- updated_at

### highlight_items
Purpose: Associate archived stories with highlights.

Planned fields:
- highlight_id
- story_id or archived_story_reference
- position
- added_at

The design must define how a highlight behaves if its original story
expires or is deleted.

## 9. Follow Relationships

### follows
Purpose: Store accepted follow relationships.

Planned fields:
- follower_user_id
- followed_user_id
- created_at

Constraints:
- Prevent duplicate relationships.
- Prevent following oneself.
- Enforce private-account approval rules.

### follow_requests
Purpose: Store pending follow requests.

Planned fields:
- id
- requester_user_id
- target_user_id
- request_status
- created_at
- updated_at

Constraints:
- Prevent duplicate pending requests.
- Accepting a request must update relationships consistently.
- Reject invalid transitions.

## 10. Direct Messaging

### conversations
Purpose: Represent a messaging conversation.

Planned fields:
- id
- conversation_type
- created_at
- updated_at

### conversation_members
Purpose: Represent conversation membership.

Planned fields:
- conversation_id
- user_id
- joined_at
- left_at where supported
- muted_until where supported

### messages
Purpose: Store message metadata and content according to the selected
privacy and encryption design.

Planned fields:
- id
- conversation_id
- sender_user_id
- message_type
- body or encrypted_payload according to the approved design
- reply_to_message_id where supported
- created_at
- edited_at where supported
- deleted_at where applicable
- delivery state where required

### message_attachments
Purpose: Associate media with messages.

Planned fields:
- id
- message_id
- media_asset_id
- position

The implementation must define message requests, authorization,
delivery/read receipts, deletion behavior, retention, and encryption.
Do not claim end-to-end encryption unless it is actually implemented
and tested.

## 11. Notifications

### notifications
Purpose: Store user-visible activity.

Planned fields:
- id
- recipient_user_id
- actor_user_id where applicable
- notification_type
- target_type
- target_id
- read_at
- created_at

Constraints:
- Validate supported notification types.
- Avoid duplicate notifications where required.
- Do not reveal private activity to unauthorized recipients.
- Define retention and deletion rules.

## 12. Hashtags and Mentions

### hashtags
Purpose: Normalize hashtag identities.

Planned fields:
- id
- tag_normalized
- created_at

Constraint:
- Unique normalized tag.

### post_hashtags
Purpose: Associate posts with hashtags.

Planned fields:
- post_id
- hashtag_id

### mentions
Purpose: Represent supported account mentions.

Planned fields:
- id
- source_type
- source_id
- mentioned_user_id
- created_at

Validate mentioned accounts and visibility before displaying content
or generating notifications.

## 13. Blocking, Muting, and Reporting

### blocked_users
Purpose: Record block relationships.

Planned fields:
- blocker_user_id
- blocked_user_id
- created_at

Constraints:
- Prevent duplicate entries.
- Prevent self-blocking.
- Apply blocking consistently across feeds, search, profiles, and messages.

### muted_users
Purpose: Record mute preferences.

Planned fields:
- muter_user_id
- muted_user_id
- created_at

### reports
Purpose: Track reports for moderation.

Planned fields:
- id
- reporter_user_id
- target_type
- target_id
- reason_code
- details where appropriate
- report_status
- created_at
- reviewed_at where applicable

Restrict access to report details and moderation operations.

## 14. Index Planning

Evaluate indexes for:
- Normalized unique username.
- Posts by author and creation time.
- Feed lookup by author/relationship and time.
- Media assets by owner and processing status.
- Stories by author and expiry time.
- Reels by author and creation time.
- Followers and following lookups.
- Follow requests by target and status.
- Comments by target and creation time.
- Likes by target and user.
- Saved posts by user and creation time.
- Conversation membership by user.
- Messages by conversation and creation time.
- Notifications by recipient and creation time.
- Hashtags by normalized tag.
- Reports by status and creation time.

Final indexes must be based on actual queries and measured performance.

## 15. Referential Integrity and Deletion

Before implementation, define behavior for:
- Account deletion.
- Post deletion.
- Media deletion.
- Story expiry.
- Reel deletion.
- Comment deletion.
- Message deletion.
- Highlight references.
- Notifications referencing deleted content.
- Reports and legal retention requirements.
- Backups and restoration.

Avoid orphaned records and inaccessible private files.
Use transactions for operations that must remain consistent.

## 16. Migration and Recovery

- Version all schema migrations.
- Test migrations on a copy of representative data.
- Provide a documented backup process.
- Test restore procedures.
- Never run destructive migrations without a reviewed recovery plan.
- Record migration failures and resolutions in ERROR_LOG.md.

## 17. Privacy and Authorization Checks

- Only the owner can edit protected profile fields.
- Username immutability is enforced server-side.
- Display-name cooldown is enforced server-side.
- Private-account content requires authorization.
- Saved posts are private.
- Block relationships affect all relevant surfaces.
- Only authorized participants may read conversations.
- Upload ownership is verified before publishing media.
- Report data is restricted to authorized workflows.
- Deletion and retention rules are consistently applied.

## 18. Open Decisions

The following decisions remain open and must be recorded in
ARCHITECTURE_DECISIONS.md before implementation:

1. Production database engine.
2. Primary-key strategy.
3. Migration framework.
4. Shared versus separate post/reel interaction tables.
5. Soft-delete and retention policies.
6. Media storage provider and access model.
7. Messaging encryption model.
8. Search indexing approach.
9. Feed ranking strategy.
10. Backup and restore design.

## 19. Status

This is a logical schema plan only.
No database tables, migrations, or database-backed features have been
implemented or verified by this document.
