import { storefrontApiRequest } from './api'
import type { CartItem } from '@/stores/shopify-cart'

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`

const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`

const CART_LINES_UPDATE_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id }
      userErrors { field message }
    }
  }
`

const CART_LINES_REMOVE_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id }
      userErrors { field message }
    }
  }
`

function formatCheckoutUrl(checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl)
    url.searchParams.set('channel', 'online_store')
    return url.toString()
  } catch {
    return checkoutUrl
  }
}

function isCartNotFoundError(
  userErrors: Array<{ field: string[] | null; message: string }>,
): boolean {
  return userErrors.some(
    (e) =>
      e.message.toLowerCase().includes('cart not found') ||
      e.message.toLowerCase().includes('does not exist'),
  )
}

export async function createShopifyCart(
  item: CartItem,
): Promise<{ cartId: string; checkoutUrl: string; lineId: string } | null> {
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { lines: [{ quantity: item.quantity, merchandiseId: item.variantId }] },
  })

  const userErrors =
    (data.data as { cartCreate?: { userErrors?: Array<{ field: string[] | null; message: string }> } })?.cartCreate?.userErrors ??
    []
  if (userErrors.length > 0) {
    console.error('Cart creation failed:', userErrors)
    return null
  }

  const cart = (data.data as { cartCreate?: { cart?: { id: string; checkoutUrl: string; lines: { edges: Array<{ node: { id: string; merchandise: { id: string } } }> } } } })?.cartCreate?.cart
  if (!cart?.checkoutUrl) return null

  const lineId = cart.lines.edges[0]?.node?.id
  if (!lineId) return null

  return {
    cartId: cart.id,
    checkoutUrl: formatCheckoutUrl(cart.checkoutUrl),
    lineId,
  }
}

export async function addLineToShopifyCart(
  cartId: string,
  item: CartItem,
): Promise<{ success: boolean; lineId?: string; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [{ quantity: item.quantity, merchandiseId: item.variantId }],
  })

  const userErrors =
    (data.data as { cartLinesAdd?: { userErrors?: Array<{ field: string[] | null; message: string }> } })?.cartLinesAdd?.userErrors ??
    []
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true }
  if (userErrors.length > 0) {
    console.error('Add line failed:', userErrors)
    return { success: false }
  }

  const lines =
    (data.data as { cartLinesAdd?: { cart?: { lines?: { edges: Array<{ node: { id: string; merchandise: { id: string } } }> } } } })?.cartLinesAdd?.cart?.lines?.edges ??
    []
  const newLine = lines.find(
    (l: { node: { merchandise: { id: string } } }) =>
      l.node.merchandise.id === item.variantId,
  )
  return { success: true, lineId: newLine?.node?.id }
}

export async function updateShopifyCartLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_UPDATE_MUTATION, {
    cartId,
    lines: [{ id: lineId, quantity }],
  })

  const userErrors =
    (data.data as { cartLinesUpdate?: { userErrors?: Array<{ field: string[] | null; message: string }> } })?.cartLinesUpdate?.userErrors ??
    []
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true }
  if (userErrors.length > 0) {
    console.error('Update line failed:', userErrors)
    return { success: false }
  }
  return { success: true }
}

export async function removeLineFromShopifyCart(
  cartId: string,
  lineId: string,
): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, {
    cartId,
    lineIds: [lineId],
  })

  const userErrors =
    (data.data as { cartLinesRemove?: { userErrors?: Array<{ field: string[] | null; message: string }> } })?.cartLinesRemove?.userErrors ??
    []
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true }
  if (userErrors.length > 0) {
    console.error('Remove line failed:', userErrors)
    return { success: false }
  }
  return { success: true }
}
