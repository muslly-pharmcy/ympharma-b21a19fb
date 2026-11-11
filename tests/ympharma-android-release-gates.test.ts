import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('Android owner-controlled release path', () => {
  const gradle = readFileSync('android/app/build.gradle', 'utf8')
  const workflow = readFileSync('.github/workflows/ympharma-android-release.yml', 'utf8')
  it('keeps signing credentials out of source files', () => {
    expect(gradle).toContain('System.getenv("YMPHARMA_ANDROID_KEYSTORE_PATH")')
    expect(gradle).toContain('System.getenv("YMPHARMA_ANDROID_KEY_PASSWORD")')
    expect(gradle).toContain('signingConfig signingConfigs.release')
    expect(gradle).not.toContain('storePassword "password"')
  })
  it('gates release behind owner environment, manual dispatch and secret readiness', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toContain('push:')
    expect(workflow).toContain("vars.YMPHARMA_ANDROID_RELEASE_READY == 'true'")
    expect(workflow).toContain('environment: ympharma-android-release')
    expect(workflow).toContain('apksigner')
  })
  it('retains debug build as separate path', () => {
    expect(gradle).toContain('applicationId "com.ympharma.app"')
    expect(gradle).toContain('buildTypes {')
    expect(gradle).toContain('release {')
  })
})
