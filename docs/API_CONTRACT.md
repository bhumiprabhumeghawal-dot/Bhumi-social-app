# SocialApp — API Contract

Version: 1.0
Status: Draft — backend architecture review required
Related documents:
- BLUEPRINT.md
- UI_SPECIFICATION.md
- DATABASE_SCHEMA.md

## 1. Purpose

Define the contract between the Android application and the backend.
This document is a planned API specification, not evidence that an API
server or endpoint has been implemented.

The API base path is provisionally /api/v1/.

## 2. General Rules

- Use HTTPS in deployed environments.
- Use JSON for ordinary request and response bodies.
- Use multipart uploads or a documented upload protocol for media.
- Authenticate protected requests using the approved session mechanism.
- Enforce authorization on the server.
- Validate all client inputs.
- Return documented HTTP status codes.
- Use UTC timestamps in a consistent ISO 8601 format.
- Apply pagination to potentially large collections.
- Use idempotency protection for operations that could create duplicates.
- Do not return password hashes, raw session tokens, or internal secrets.
- Do not expose private media through guessable public storage paths.
- Version breaking API changes.
- Keep error responses understandable but do not expose stack traces.

## 3. Common Response Conventions

Successful responses should use a consistent documented structure.

Example:
{
  "data": {},
  "meta": {}
}

Error responses should use a consistent documented structure.

Example:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be accepted.",
    "fields": {}
  }
}

These are examples only. Final response fields must be implemented
consistently and documented before release.

## 4. HTTP Status Codes

- 200: Successful request.
- 201: Resource created.
- 202: Accepted for asynchronous processing.
- 204: Successful operation with no response body.
- 400: Invalid request.
- 401: Missing or invalid authentication.
- 403: Authenticated but not permitted.
- 404: Resource not found or not visible.
- 409: Conflict or duplicate state transition.
- 413: Payload too large.
- 415: Unsupported media type.
- 422: Validly formed request with invalid field values.
- 429: Rate limit exceeded.
- 500: Unexpected server error.
- 503: Service temporarily unavailable.

Use 404 for private resources where revealing their existence would
violate the approved privacy model.

## 5. Authentication

### POST /auth/register
Purpose: Create an account.

Planned inputs:
- username
- display_name
- password
- email or phone if required by the approved design

Expected behavior:
- Validate username and password.
- Enforce username uniqueness.
- Create account and profile transactionally.
- Return the approved account/session result.
- Never return the password or password hash.

### POST /auth/login
Purpose: Authenticate a user.

Inputs:
- account identifier
- password

Expected behavior:
- Apply rate limiting.
- Return the approved session response.
- Use safe error messages.
- Do not reveal whether an arbitrary account exists.

### POST /auth/logout
Purpose: Revoke the current session.

Authentication: Required.

### POST /auth/password-recovery
Purpose: Start the password recovery workflow.

Expected behavior:
- Apply rate limits.
- Avoid account enumeration.
- Use the selected email/phone recovery provider.

### POST /auth/verify
Purpose: Verify an account when verification is required.

Exact payload depends on the approved authentication provider.

### GET /auth/me
Purpose: Return the current authenticated account and profile summary.

### GET /auth/sessions
Purpose: List sessions belonging to the current account.

### DELETE /auth/sessions/{session_id}
Purpose: Revoke an authorized session.

## 6. Profiles and Users

### GET /users/{username}
Purpose: Retrieve a profile visible to the current requester.

### PATCH /profiles/me
Purpose: Update permitted profile fields.

Potential fields:
- display_name
- bio
- avatar_media_id
- other explicitly approved editable fields

Rules:
- Username is not editable.
- Enforce the three-month display-name change interval on the server.
- Validate avatar ownership and media status.
- Respect account privacy.
- Return field-specific validation errors where appropriate.

### GET /profiles/me
Purpose: Retrieve the current user's profile.

### GET /profiles/{username}/posts
Purpose: Retrieve posts visible on a profile.

### GET /profiles/{username}/reels
Purpose: Retrieve reels visible on a profile.

### GET /profiles/me/saved-posts
Purpose: Retrieve the authenticated user's private saved posts.

### GET /profiles/me/archive
Purpose: Retrieve the authenticated user's archived content.

## 7. Posts

### POST /posts
Purpose: Publish a post.

Potential inputs:
- caption
- media asset IDs
- audience
- accessibility text
- optional location
- optional idempotency key

Rules:
- Authenticate the author.
- Validate all media assets and ownership.
- Validate audience permissions.
- Prevent duplicate creation on retry.
- Create the post and media associations consistently.
- Do not report publication before the server confirms success.

### GET /posts/{post_id}
Purpose: Retrieve a post the requester is allowed to see.

### PATCH /posts/{post_id}
Purpose: Update permitted metadata on the author's own post.

### DELETE /posts/{post_id}
Purpose: Delete the author's own post according to retention rules.

### GET /feed
Purpose: Retrieve the authenticated user's eligible feed.

Potential query parameters:
- cursor
- limit

Rules:
- Apply privacy and block restrictions.
- Return a stable pagination structure.
- Do not expose inaccessible posts.

### POST /posts/{post_id}/like
Purpose: Like a post.

### DELETE /posts/{post_id}/like
Purpose: Remove a post like.

### GET /posts/{post_id}/likes
Purpose: Retrieve the permitted likes list.

### GET /posts/{post_id}/comments
Purpose: Retrieve paginated comments.

### POST /posts/{post_id}/comments
Purpose: Create a comment.

Input:
- body
- parent_comment_id when replying

### PATCH /comments/{comment_id}
Purpose: Edit an authorized comment where editing is supported.

### DELETE /comments/{comment_id}
Purpose: Delete an authorized comment.

### POST /posts/{post_id}/save
Purpose: Save a post privately.

### DELETE /posts/{post_id}/save
Purpose: Unsave a post.

### POST /posts/{post_id}/archive
Purpose: Archive an authorized post.

### POST /posts/{post_id}/restore
Purpose: Restore an archived post.

## 8. Media Upload

### POST /media/uploads
Purpose: Start a media upload or register an upload job.

The final upload protocol may use multipart upload, direct object storage,
or another approved mechanism.

Potential metadata:
- media_type
- file_size_bytes
- verified content type where available
- checksum where supported
- idempotency key

### PUT /media/uploads/{upload_id}/content
Purpose: Transfer content when the selected protocol uses this route.

### GET /media/uploads/{upload_id}
Purpose: Retrieve upload and processing status.

### POST /media/uploads/{upload_id}/complete
Purpose: Finalize upload when the selected protocol requires it.

### DELETE /media/uploads/{upload_id}
Purpose: Cancel or remove an authorized unfinished upload.

### GET /media/{media_id}
Purpose: Obtain authorized media metadata or a protected media delivery
response according to the chosen storage design.

Media rules:
- Enforce type, size, and duration limits on the server.
- Verify content rather than trusting client metadata.
- Use server-generated storage identifiers.
- Validate ownership before associating media with content.
- Return clear validation errors.
- Support safe retry and duplicate-submission prevention.
- Do not expose internal storage paths.

## 9. Stories

### POST /stories
Purpose: Publish a story.

Potential inputs:
- media_asset_id
- caption or supported overlay data
- audience

### GET /stories/feed
Purpose: Retrieve eligible stories for the requester.

### GET /stories/{story_id}
Purpose: Retrieve an accessible story.

### POST /stories/{story_id}/views
Purpose: Record an eligible story view.

### GET /stories/{story_id}/viewers
Purpose: Retrieve viewers for the authorized story owner.

### DELETE /stories/{story_id}
Purpose: Delete the owner's story.

Expired stories must be excluded according to trusted server time.

## 10. Story Archive and Highlights

### GET /stories/archive
Purpose: Retrieve the owner's archived stories.

### POST /highlights
Purpose: Create a story highlight.

### GET /profiles/{username}/highlights
Purpose: Retrieve highlights visible on a profile.

### PATCH /highlights/{highlight_id}
Purpose: Update an authorized highlight.

### POST /highlights/{highlight_id}/items
Purpose: Add an eligible archived story to a highlight.

### DELETE /highlights/{highlight_id}/items/{item_id}
Purpose: Remove an item from a highlight.

### DELETE /highlights/{highlight_id}
Purpose: Delete an authorized highlight.

## 11. Reels

### POST /reels
Purpose: Publish a reel from a validated media asset.

### GET /reels/feed
Purpose: Retrieve eligible reels.

### GET /reels/{reel_id}
Purpose: Retrieve a reel visible to the requester.

### PATCH /reels/{reel_id}
Purpose: Update permitted metadata on an owned reel.

### DELETE /reels/{reel_id}
Purpose: Delete an owned reel.

### POST /reels/{reel_id}/like
Purpose: Like a reel.

### DELETE /reels/{reel_id}/like
Purpose: Unlike a reel.

### GET /reels/{reel_id}/comments
Purpose: Retrieve paginated reel comments.

### POST /reels/{reel_id}/comments
Purpose: Add a reel comment.

### POST /reels/{reel_id}/save
Purpose: Save a reel privately.

### DELETE /reels/{reel_id}/save
Purpose: Remove a reel from saved content.

The exact interaction routes must align with the final database design.

## 12. Search and Hashtags

### GET /search
Potential query parameters:
- q
- type
- cursor
- limit

Supported search types may include users, posts, reels, and hashtags.

### GET /search/recent
Purpose: Retrieve the current user's recent searches if stored.

### DELETE /search/recent
Purpose: Clear the current user's search history.

### GET /hashtags/{tag}
Purpose: Retrieve hashtag details and eligible associated content.

Search results must respect privacy and block rules.

## 13. Follows and Follow Requests

### POST /users/{user_id}/follow
Purpose: Follow a public account or request access to a private account.

### DELETE /users/{user_id}/follow
Purpose: Unfollow an account.

### GET /users/{user_id}/followers
Purpose: Retrieve an authorized followers list.

### GET /users/{user_id}/following
Purpose: Retrieve an authorized following list.

### GET /follow-requests
Purpose: Retrieve the current user's incoming requests.

### POST /follow-requests/{request_id}/accept
Purpose: Accept a request.

### POST /follow-requests/{request_id}/decline
Purpose: Decline a request.

### DELETE /follow-requests/{request_id}
Purpose: Cancel an authorized outgoing request where supported.

### DELETE /followers/{user_id}
Purpose: Remove a follower where permitted.

Prevent self-following and duplicate relationship records.

## 14. Saved Content

### GET /saved-posts
Purpose: Retrieve the current user's private saved posts.

### POST /saved-posts/{post_id}
Purpose: Save a post.

### DELETE /saved-posts/{post_id}
Purpose: Unsave a post.

If saved collections are implemented, define separate collection routes
and authorization rules before coding.

## 15. Messaging

### GET /conversations
Purpose: Retrieve conversations accessible to the current user.

### POST /conversations
Purpose: Create or obtain an authorized conversation.

### GET /conversations/{conversation_id}/messages
Purpose: Retrieve paginated conversation history.

### POST /conversations/{conversation_id}/messages
Purpose: Send a message.

Potential inputs:
- message_type
- body or approved encrypted payload
- attachment media IDs
- reply_to_message_id
- idempotency key

### PATCH /messages/{message_id}
Purpose: Edit a message only if the approved product rules allow it.

### DELETE /messages/{message_id}
Purpose: Delete or unsend a message according to documented rules.

### POST /messages/{message_id}/reactions
Purpose: Add a supported reaction.

### DELETE /messages/{message_id}/reactions
Purpose: Remove a reaction.

### GET /message-requests
Purpose: Retrieve message requests.

### POST /message-requests/{request_id}/accept
Purpose: Accept a message request.

### POST /message-requests/{request_id}/decline
Purpose: Decline a message request.

All conversation operations must validate membership and privacy.
Read receipts and real-time delivery depend on approved design decisions.

## 16. Notifications

### GET /notifications
Purpose: Retrieve paginated notifications.

### POST /notifications/{notification_id}/read
Purpose: Mark one notification as read.

### POST /notifications/read-all
Purpose: Mark eligible notifications as read.

Push notification registration and delivery routes depend on the chosen
notification provider.

## 17. Privacy, Blocking, and Moderation

### GET /settings
Purpose: Retrieve the current user's settings.

### PATCH /settings
Purpose: Update permitted settings.

### POST /users/{user_id}/block
Purpose: Block a user.

### DELETE /users/{user_id}/block
Purpose: Unblock a user.

### POST /users/{user_id}/mute
Purpose: Mute a user.

### DELETE /users/{user_id}/mute
Purpose: Unmute a user.

### POST /reports
Purpose: Report a user, post, reel, story, comment, or message.

Potential inputs:
- target_type
- target_id
- reason_code
- optional details

### POST /account/deactivate
Purpose: Request account deactivation.

### POST /account/delete
Purpose: Request account deletion with the approved confirmation flow.

Do not expose confidential moderation or internal account information.

## 18. Health and Service Status

### GET /health
Purpose: Report basic service health.

Do not expose secrets, private configuration, or detailed internal
infrastructure information through public health responses.

## 19. Pagination

Large lists should use a documented cursor-based pagination format.

The final contract must define:
- Request cursor.
- Page-size limit.
- Next cursor.
- Ordering guarantees.
- Behavior when content is deleted between requests.
- Invalid or expired cursor behavior.

## 20. Idempotency and Retries

Use idempotency protection for operations where duplicate requests
could create duplicate posts, reels, messages, or upload jobs.

The backend must define:
- Which endpoints accept an idempotency key.
- Key scope and expiry.
- Behavior for a repeated key with the same payload.
- Behavior for a repeated key with a different payload.
- Safe retry behavior after timeouts.

## 21. Error Contract

Define stable machine-readable error codes for:
- VALIDATION_ERROR
- AUTH_REQUIRED
- SESSION_EXPIRED
- PERMISSION_DENIED
- RESOURCE_NOT_FOUND
- USERNAME_TAKEN
- DISPLAY_NAME_COOLDOWN
- MEDIA_TOO_LARGE
- UNSUPPORTED_MEDIA
- UPLOAD_FAILED
- UPLOAD_PROCESSING
- DUPLICATE_REQUEST
- RATE_LIMITED
- NETWORK_OR_SERVICE_UNAVAILABLE
- INTERNAL_ERROR

Final codes and payloads must be consistent across the backend and app.

## 22. API Testing Requirements

- Test successful and failed authentication.
- Test unauthorized access.
- Test private-account visibility.
- Test block enforcement across endpoints.
- Test username immutability.
- Test display-name cooldown.
- Test media type, size, and duration validation.
- Test upload retry and duplicate requests.
- Test post and reel publication confirmation.
- Test story expiry.
- Test follow request transitions.
- Test message membership authorization.
- Test pagination and invalid cursors.
- Test rate limiting.
- Test deletion and retention behavior.
- Test consistent error responses.

## 23. Open Decisions

Record decisions in ARCHITECTURE_DECISIONS.md for:
- Backend framework and hosting.
- Authentication and token strategy.
- Database engine.
- Media storage and upload protocol.
- Real-time messaging transport.
- Messaging encryption.
- Push notification provider.
- Search implementation.
- Feed ranking.
- Rate limits and quotas.

## 24. Status

This API contract is a draft inventory.
Routes, request schemas, response schemas, authorization rules, and
tests must be finalized before implementation.
No endpoint is claimed implemented or verified by this document.
