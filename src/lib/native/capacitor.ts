import { isNativePlatform } from './platform'

/**
 * Native bridge helpers. Every function degrades gracefully on the web build:
 * Capacitor plugins are imported dynamically and only when running natively.
 */

/** Scan a barcode/QR with the native camera. Returns null on web or on cancel. */
export async function scanBarcode(): Promise<string | null> {
  if (!isNativePlatform()) return null
  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
    const permission = await BarcodeScanner.requestPermissions()
    if (permission.camera !== 'granted' && permission.camera !== 'limited') return null
    const available = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
    if (!available.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => undefined)
    }
    const { barcodes } = await BarcodeScanner.scan()
    return barcodes[0]?.rawValue ?? null
  } catch {
    return null
  }
}

/** Register for push notifications and hand the device token to the caller. */
export async function registerPushNotifications(
  onToken: (token: string) => void,
  onNotification?: (payload: unknown) => void,
): Promise<boolean> {
  if (!isNativePlatform()) return false
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const status = await PushNotifications.requestPermissions()
    if (status.receive !== 'granted') return false
    await PushNotifications.addListener('registration', (t) => onToken(t.value))
    await PushNotifications.addListener('pushNotificationReceived', (n) => onNotification?.(n))
    await PushNotifications.addListener('pushNotificationActionPerformed', (n) =>
      onNotification?.(n),
    )
    await PushNotifications.register()
    return true
  } catch (error) {
    console.warn(
      '[native-push] Push registration is unavailable; continuing without notifications.',
      error instanceof Error ? error.message : 'Unknown native push error',
    )
    return false
  }
}
