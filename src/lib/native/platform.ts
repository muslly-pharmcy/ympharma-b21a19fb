/** Lightweight native-platform detection shared by web and Capacitor code. */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean }
  }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}
