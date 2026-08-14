import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ShopifyProduct } from '@/lib/shopify/api'
import {
  createShopifyCart,
  addLineToShopifyCart,
  updateShopifyCartLine,
  removeLineFromShopifyCart,
} from '@/lib/shopify/cart-api'
import { enqueueCartOp } from '@/lib/offline/cart-queue'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export interface CartItem {
  lineId: string | null
  product: ShopifyProduct
  variantId: string
  variantTitle: string
  price: { amount: string; currencyCode: string }
  quantity: number
  selectedOptions: Array<{ name: string; value: string }>
}

interface CartStore {
  items: CartItem[]
  cartId: string | null
  checkoutUrl: string | null
  isLoading: boolean
  isSyncing: boolean
  addItem: (item: Omit<CartItem, 'lineId'>) => Promise<void>
  updateQuantity: (variantId: string, quantity: number) => Promise<void>
  removeItem: (variantId: string) => Promise<void>
  clearCart: () => void
  syncCart: () => Promise<void>
  getCheckoutUrl: () => string | null
}

export const useShopifyCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        const { items, cartId, clearCart } = get()
        const existingItem = items.find((i) => i.variantId === item.variantId)

        // Offline: apply locally and replay against Shopify once back online.
        if (isOffline()) {
          enqueueCartOp({
            kind: 'add',
            variantId: item.variantId,
            quantity: item.quantity,
            payload: item,
          })
          set({
            items: existingItem
              ? items.map((i) =>
                  i.variantId === item.variantId
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i,
                )
              : [...items, { ...item, lineId: null }],
          })
          return
        }

        set({ isLoading: true })
        try {
          if (!cartId) {
            const result = await createShopifyCart({ ...item, lineId: null })
            if (result) {
              set({
                cartId: result.cartId,
                checkoutUrl: result.checkoutUrl,
                items: [{ ...item, lineId: result.lineId }],
              })
            }
          } else if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity
            if (!existingItem.lineId) {
              console.error(
                'Cannot update quantity for item without lineId:',
                existingItem,
              )
              return
            }
            const result = await updateShopifyCartLine(
              cartId,
              existingItem.lineId,
              newQuantity,
            )
            if (result.success) {
              const currentItems = get().items
              set({
                items: currentItems.map((i) =>
                  i.variantId === item.variantId
                    ? { ...i, quantity: newQuantity }
                    : i,
                ),
              })
            } else if (result.cartNotFound) {
              clearCart()
            }
          } else {
            const result = await addLineToShopifyCart(cartId, {
              ...item,
              lineId: null,
            })
            if (result.success) {
              const currentItems = get().items
              set({
                items: [
                  ...currentItems,
                  { ...item, lineId: result.lineId ?? null },
                ],
              })
            } else if (result.cartNotFound) {
              clearCart()
            }
          }
        } catch (error) {
          console.error('Failed to add item:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(variantId)
          return
        }

        const { items, cartId, clearCart } = get()
        const item = items.find((i) => i.variantId === variantId)
        if (!item) return

        if (isOffline()) {
          enqueueCartOp({ kind: 'update', variantId, quantity })
          set({ items: items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)) })
          return
        }
        if (!item.lineId || !cartId) return

        set({ isLoading: true })
        try {
          const result = await updateShopifyCartLine(
            cartId,
            item.lineId,
            quantity,
          )
          if (result.success) {
            const currentItems = get().items
            set({
              items: currentItems.map((i) =>
                i.variantId === variantId ? { ...i, quantity } : i,
              ),
            })
          } else if (result.cartNotFound) {
            clearCart()
          }
        } catch (error) {
          console.error('Failed to update quantity:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get()
        const item = items.find((i) => i.variantId === variantId)
        if (!item) return

        if (isOffline()) {
          enqueueCartOp({ kind: 'remove', variantId })
          const remaining = items.filter((i) => i.variantId !== variantId)
          set({ items: remaining })
          return
        }
        if (!item.lineId || !cartId) return

        set({ isLoading: true })
        try {
          const result = await removeLineFromShopifyCart(cartId, item.lineId)
          if (result.success) {
            const currentItems = get().items
            const newItems = currentItems.filter(
              (i) => i.variantId !== variantId,
            )
            if (newItems.length === 0) clearCart()
            else set({ items: newItems })

          } else if (result.cartNotFound) {
            clearCart()
          }
        } catch (error) {
          console.error('Failed to remove item:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      clearCart: () =>
        set({ items: [], cartId: null, checkoutUrl: null, isLoading: false }),

      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get()
        if (!cartId || isSyncing) return

        set({ isSyncing: true })
        try {
          const { storefrontApiRequest } = await import('@/lib/shopify/api')
          const CART_QUERY = `
            query cart($id: ID!) {
              cart(id: $id) { id totalQuantity }
            }
          `
          const data = await storefrontApiRequest(CART_QUERY, { id: cartId })
          const cart = (data.data as { cart?: { totalQuantity?: number } })?.cart
          if (!cart || cart.totalQuantity === 0) clearCart()
        } catch (error) {
          console.error('Failed to sync cart with Shopify:', error)
        } finally {
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'shopify-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
      }),
    },
  ),
)
