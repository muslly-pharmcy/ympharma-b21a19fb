# YmPharma Android updated APK — build record

Build requested on 2026-11-21 after main branch updates.
Pinned source commit: `b68970f71576aa9824fa4a890ab0fd4976cdbe3f`.
Build source: current merged `main` only; do **not** include unmerged Ruflo skills staging PR #84 or APK build PR #86.
App ID: `com.ympharma.app` ; display name in existing settings: `صيدلية المصلي`.

CI pipeline: `.github/workflows/ympharma-device-builds.yml`.
Steps: install dependencies with frozen Bun lockfile, build Android web assets, synchronize Capacitor, build Android debug APK via Gradle.
Expected artifact: `ympharma-android-debug/app-debug.apk`.

This file triggers the already-present CI on this isolated PR branch. It makes no application, database, or release-signing changes.

Acceptance:
- CI Android job successful and artifact uploaded.
- Verify APK archive integrity and source SHA.
- Provide SHA-256 and explicitly mark APK as debug testing build, not signed production release.
- Verify device camera/barcode, login, offline queue, tenant isolation and real-device installation separately.
