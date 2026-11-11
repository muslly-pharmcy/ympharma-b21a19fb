# YmPharma Android owner-signed Release gate

The repository contains an Android Capacitor project. GitHub Actions previously built a debug APK and successfully ran a Windows web/PWA regression suite. A debug APK is not a signed Release and must not be shipped as such.

## Activation (owner action, not yet complete)

1. Establish a **permanent, owner-controlled Android release signing keystore** offline (prefer a strong private storage/backup policy), with a unique alias and passwords. The keystore **must never** enter GitHub source, PR files, comments or client build assets. Keep an independent offline recovery copy. Do not share the key with ChatGPT.
2. In GitHub repository Settings, create a protected Environment named \`ympharma-android-release\` with required reviewer(s). Add Environment secrets:
   - \`YMPHARMA_ANDROID_KEYSTORE_B64\`: base64 of the existing keystore file (not key text in public logs).
   - \`YMPHARMA_ANDROID_STORE_PASSWORD\`
   - \`YMPHARMA_ANDROID_KEY_ALIAS\`
   - \`YMPHARMA_ANDROID_KEY_PASSWORD\`
3. Add repository/environment variable \`YMPHARMA_ANDROID_RELEASE_READY=true\` only when the secret set and review policy are ready. Until then, the release job is **skipped** by design.
4. Run the manual workflow \`YmPharma Android owner-signed Release (manual only)\` with an increasing \`version_code\` and semver \`version_name\`. The workflow builds via Bun+Capacitor, signs APK/AAB using Gradle, checks the APK with \`apksigner\`, computes SHA256 hashes and uploads 14-day artifacts. No Play Store upload, auto-install or deployment occurs.
5. Verify the signing certificate fingerprint against the independently recorded owner fingerprint and test installing/upgrading on real Android phones before commercial use.
6. **Do not enable the release workflow for production until offline 12-hour POS quotas, financial transactions, RLS and the 500-way last-stock test are certified.**

No signing credentials were generated, stored, accessed or exposed by this PR. The actual release remains blocked on owner-managed credentials and device acceptance. The Windows native installer is a separate workstream.
