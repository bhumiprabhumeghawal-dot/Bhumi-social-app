# Media object storage setup

The application supports optional multi-provider S3-compatible object storage for
post images/videos, stories, reels, and chat attachments. It preserves the current
local-upload behavior until at least one provider is configured.

## Render environment variable

Add `MEDIA_STORAGE_PROVIDERS` to the Render web service environment. Its value is
a JSON array. Add only providers for which you have created a bucket and S3/API
credentials. Example structure (all values below are placeholders):

```json
[
  {
    "id": "r2",
    "endpoint_url": "https://ACCOUNT_ID.r2.cloudflarestorage.com",
    "bucket": "bhumi-media",
    "access_key": "R2_ACCESS_KEY",
    "secret_key": "R2_SECRET_KEY",
    "region": "auto"
  },
  {
    "id": "b2",
    "endpoint_url": "https://s3.REGION.backblazeb2.com",
    "bucket": "bhumi-media",
    "access_key": "B2_KEY_ID",
    "secret_key": "B2_APPLICATION_KEY",
    "region": "REGION"
  }
]
```

The array can contain more S3-compatible providers. Each provider needs a unique
lowercase `id` (letters, digits, underscore, hyphen; max 24 characters), endpoint,
bucket, access key, and secret key. Never commit real credentials to GitHub or
paste them into chat. Keep the bucket private; the app authorizes media access and
redirects viewers to short-lived signed download URLs.

## Placement and fallback

New objects are distributed deterministically across the configured providers.
If an upload fails at its selected provider, the server tries the remaining
providers. The selected provider and object key are encoded in the internal media
path, so later reads and owner deletions resolve to the correct provider. This is
not cross-provider replication: each uploaded object is stored once. Existing
local uploads remain readable and are not automatically migrated or deleted.

## Current upload caps

- Posts: 50 MB per file
- Stories: 25 MB per file
- Reels: 50 MB per file
- Chat attachments retain their per-type checks, with the server-wide request
  limit currently set to 50 MB plus multipart overhead.

## Important rollout notes

1. Configure and test one provider first, then add the next provider.
2. Confirm each provider's free quota, allowed commercial/app usage, API limits,
   and billing behavior before adding its credentials.
3. Do not assume advertised free quotas can be pooled into one provider quota.
4. Monitor each provider's usage dashboard. This foundation does not yet enforce
   a combined 8 GB cap or automatically migrate old local media.
5. Do not enable this configuration until the provider's bucket and credentials
   have been verified. If no provider is configured, uploads continue using the
   existing local path.
