import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMocks = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  addListener: vi.fn(),
  register: vi.fn(),
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: pushMocks,
}))

import { registerPushNotifications } from '../src/lib/native/capacitor'

describe('registerPushNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('warns and continues when Firebase registration is unavailable', async () => {
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => true },
    })
    pushMocks.requestPermissions.mockResolvedValue({ receive: 'granted' })
    pushMocks.addListener.mockResolvedValue({ remove: vi.fn() })
    pushMocks.register.mockRejectedValue(new Error('FirebaseApp is not initialized'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(registerPushNotifications(vi.fn())).resolves.toBe(false)

    expect(pushMocks.register).toHaveBeenCalledOnce()
    expect(warning).toHaveBeenCalledWith(
      '[native-push] Push registration is unavailable; continuing without notifications.',
      'FirebaseApp is not initialized',
    )
  })

  it('registers successfully when native push is available', async () => {
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => true },
    })
    pushMocks.requestPermissions.mockResolvedValue({ receive: 'granted' })
    pushMocks.addListener.mockResolvedValue({ remove: vi.fn() })
    pushMocks.register.mockResolvedValue(undefined)

    await expect(registerPushNotifications(vi.fn())).resolves.toBe(true)
    expect(pushMocks.register).toHaveBeenCalledOnce()
  })
})
