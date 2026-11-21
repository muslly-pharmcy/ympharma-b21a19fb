# YmPharma Android APK — verification build

Build date intent: 2026-11-21.
This file documents a **debug** Android package assembled from the current `main` code on GitHub Actions. It makes no runtime behavior changes and does not merge unreviewed external-agent skills.

## Reproducible build
Workflow: `.github/workflows/ympharma-device-builds.yml`
- Node.js 22, Bun 1.4.3, Java 21
- `bun install --frozen-lockfile`
- `bun run build:android`
- `bunx cap sync android`
- `cd android && ./gradlew :app:assembleDebug --no-daemon`
- output `android/app/build/outputs/apk/debug/app-debug.apk`
- CI artifact: `ympharma-android-debug` (seven-day retention)

## Release limitations
- Debug-signed APK is installable for testing; it is NOT a Play Store release.
- Before distributing widely, configure release signing privately using the existing `YMPHARMA_ANDROID_*` environment variables; never commit a keystore, password, or private signing key.
- Report actual tested source commit, APK SHA-256, app ID `com.ympharma.app`, version, signature verification, and physical-device smoke-test outcome.
- Validate login, RTL UI, barcode scanning, offline queue, permissions, startup and background/foreground behavior on Android devices.
- Preserve tenant isolation, FEFO stock transactions, accounting immutability, and the separate pending Ruflo skills review.
