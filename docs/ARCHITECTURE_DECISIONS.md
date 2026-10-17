# Architecture Decisions

## ADR-001: Cross-Platform App Framework

- Status: Proposed
- Project: Bhoomi Social
- Target platforms: Android and Apple iPhone (iOS)
- Proposed framework: React Native
- Proposed development tooling: Expo
- Programming language: TypeScript
- App interface language: English only
- Backend: Shared, platform-independent API
- Database: To be selected after reviewing the database schema and security requirements.

### Reasons
- Share application code between Android and iOS.
- Support responsive layouts across different screen sizes.
- Provide access to platform-specific media and permission APIs.
- Keep app UI text in English.
- Preserve approved Instagram-inspired layouts and original Bhoomi Social branding.

### Constraints
- Do not claim iOS or Android compatibility before testing.
- Verify media upload, video playback, camera, gallery, navigation, and permissions on both platforms.
- An iOS build may require macOS or a suitable cloud build service.
- Do not install dependencies or replace existing project files without checking first.
- This decision remains proposed until the project requirements and tooling are verified.

### Next Steps
1. Review the API contract, database schema, and UI specification.
2. Verify the installed Node.js and npm versions.
3. Check Expo project initialization requirements.
4. Approve the architecture before creating application source files.
