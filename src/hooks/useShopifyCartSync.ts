import { useEffect } from 'react'
import { useShopifyCartStore } from '@/stores/shopify-cart'
import { drainQueue, pendingCount, type QueuedCartOp } from '@/lib/offline/cart-queue'
import type { CartItem } from '@/stores/shopify-cart'

/**
 * Keeps the local cart in sync with Shopify and replays any operation that was
 * queued while the device was offline, as soon as connectivity returns.
 */
export function useShopifyCartSync() {
  const syncCart = useShopifyCartStore((state) => state.syncCart)

  useEffect(() => {
    const store = useShopifyCartStore.getState()

    const applyOp = async (op: QueuedCartOp) => {
      const s = useShopifyCartStore.getState()
      if (op.kind === 'add') {
        await s.addItem(op.payload as Omit<CartItem, 'lineId'>)
      } else if (op.kind === 'update') {
        await s.updateQuantity(op.variantId, op.quantity)
      } else {
        await s.removeItem(op.variantId)
      }
    }

    const resync = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      if (pendingCount() > 0) await drainQueue(applyOp)
      await useShopifyCartStore.getState().syncCart()
    }

    void store.syncCart()
    void resync()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void resync()
    }
    const handleOnline = () => void resync()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [syncCart])
}
