# Bhumi Social AI Monetization Implementation

## User-facing locations

1. Settings → Creator & Professional → existing Creator & Professional hub.
2. Creator account overview → **View Premium & Creator Plans**.
3. Business account overview → **View Premium & Business Plans**.
4. The BHUMI EARNINGS panel shows the available plans and their prices.
5. The **Request Plan** action creates a pending request; the panel shows the user's latest plan requests and order IDs.

The existing SettingsDashboard already owns the CreatorBusinessHub modal. This change adds the plan panel inside that existing hub rather than adding a second settings screen.

## Plans and catalogue IDs

| Plan ID | Display name | Price |
| --- | --- | ---: |
| premium_monthly | Bhumi Premium Membership | ₹99/month |
| creator_boost | Creator Boost - Post | ₹29/post |
| creator_boost_extended | Creator Boost - Extended | ₹49 |
| vip_creator_monthly | VIP Creator Badge | ₹49/month |
| business_promotion_starter | Business Promotion - Starter | ₹199 |
| business_promotion_growth | Business Promotion - Growth | ₹499 |
| business_verified_monthly | Business Verified Profile Application | ₹99/month |
| featured_business_7d | Featured Business Listing - 7 days | ₹99/7 days |

## API routes

- GET /api/monetization/plans — current catalogue, explicitly reports payments_enabled=false.
- POST /api/monetization/orders — authenticated user creates a pending request.
- GET /api/monetization/orders — authenticated user reads only their own requests.
- GET /api/admin/monetization/orders — restricted admin list.
- POST /api/admin/monetization/orders/<order_id>/review — restricted admin rejection/refund recording. Approval is deliberately blocked until payment verification is configured.

## Database tables

- monetization_orders — plan, amount in paise, order reference, status, timestamps and admin note.
- business_verification_requests — separate verification application record. Payment alone does not grant a verified badge.

## Safety / launch gates

- No payment gateway, secret, live charge or paid entitlement is configured by this change.
- Request creation records status payment_not_configured and does not activate benefits.
- Admin routes require SOCIALAPP_ADMIN_USERNAMES to contain authorized usernames. Without this environment variable, access is denied.
- Admin approval is blocked until a real payment verification flow is implemented.
- Business verification requires manual identity/business checks; paying the application fee is not approval.
- Before launch, implement provider order creation, signed webhook verification, idempotency, refunds, receipts, subscription renewal/cancellation, entitlement expiry, and an audit trail. For Android digital subscriptions/features, confirm applicable Google Play Billing requirements before choosing the checkout flow.

## Files changed on this branch

- SettingsDashboard.js — direct entry under Premium Personalization.
- CreatorBusinessHub.js — premium plans UI, request action, user's request history.
- api.js — authenticated client functions for creating and reading requests.
- server/app.py — catalogue, order persistence, verification application records, restricted admin routes.

## Validation status

The source edits are committed on feature/bhumi-premium-earning-hub. No APK build, merge to master, or deployment has been performed. Run Python syntax checks, backend tests, API authorization tests and Android bundling before merge.
