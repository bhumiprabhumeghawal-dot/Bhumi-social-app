# Bhumi Social AI — AI Studio (separate app section)

## Goal
Add a distinct **AI Studio** destination to the existing Bhumi Social AI app. Keep it separate from the existing social feed, messaging, profile, and settings flows. Do not replace or restyle existing screens as part of this feature.

## Navigation
- Add a clearly labeled **AI Studio** item to the app's primary navigation.
- Open a dedicated AI Studio landing screen.
- Keep the screen accessible independently; do not hide it inside Settings or Direct Messages.
- Preserve the existing white chat/app-screen direction and current app branding.

## Initial feature groups
1. **AI Assistant** — conversational help, with explicit loading, error, retry, and empty states.
2. **AI Creator Studio** — tools for post captions, reel scripts, and content ideas.
3. **Translate** — translate user-provided text between supported languages.
4. **Voice** — reserve a distinct entry point; implement only after permissions and provider availability are confirmed.
5. **Image/video generation** — show as unavailable/coming soon until a real provider, limits, and cost controls are configured. Never imply generation works when it does not.

## Safety and reliability
- Keep AI requests behind a backend/provider boundary; do not ship provider secrets in the mobile app.
- Show clear errors and retry controls; do not silently lose user input.
- Do not send private messages or uploaded media to an AI provider without a clear user action and disclosure.
- Respect existing account/session and privacy behavior.
- Add feature flags/configuration so unfinished tools can remain disabled without affecting core app flows.

## Implementation order
1. Inspect current navigation and app state, then add the dedicated AI Studio navigation item and screen shell.
2. Implement the AI Assistant using a verified backend endpoint.
3. Add caption/reel-script/translation tools.
4. Add voice and media generation only after provider, quota, privacy, and free-tier constraints are verified.
5. Test navigation, signed-in/signed-out states, loading/errors, Android layout, and regression of messaging/feed.

## Acceptance criteria
- AI Studio appears as its own navigation option.
- Opening it does not disrupt existing feed, chat, or profile screens.
- Unconfigured tools are visibly marked unavailable/coming soon and do not present fake results.
- No paid service is enabled or subscribed to without explicit approval.
- No APK build or release occurs unless explicitly requested.
