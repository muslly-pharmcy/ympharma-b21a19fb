import { retryAsync } from '@/lib/net/retry'
import {

  SHOPIFY_STOREFRONT_URL,
  SHOPIFY_STOREFRONT_TOKEN,
} from './config'

export interface ShopifyProduct {
  node: {
    id: string
    title: string
    description: string
    handle: string
    priceRange: {
      minVariantPrice: {
        amount: string
        currencyCode: string
      }
    }
    images: {
      edges: Array<{
        node: {
          url: string
          altText: string | null
        }
      }>
    }
    variants: {
      edges: Array<{
        node: {
          id: string
          title: string
          price: {
            amount: string
            currencyCode: string
          }
          availableForSale: boolean
          selectedOptions: Array<{
            name: string
            value: string
          }>
        }
      }>
    }
    options: Array<{
      name: string
      values: string[]
    }>
  }
}

const STOREFRONT_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          description
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    }
  }
`

export async function storefrontApiRequest(
  query: string,
  variables: Record<string, unknown> = {},
) {
  // Transient failures (network drop, 429, 5xx) retry with exponential backoff.
  return retryAsync(async () => {
    const response = await fetch(SHOPIFY_STOREFRONT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (response.status === 402) {
      throw new Error(
        'Shopify: Payment required. The store needs an active Shopify billing plan.',
      )
    }

    if (!response.ok) {
      const err = new Error(`Shopify HTTP error! status: ${response.status}`) as Error & {
        status?: number
      }
      err.status = response.status
      throw err
    }

    const data = (await response.json()) as {
      errors?: Array<{ message: string }>
      data?: unknown
    }

    if (data.errors) {
      throw new Error(
        `Error calling Shopify: ${data.errors.map((e) => e.message).join(', ')}`,
      )
    }

    return data
  })
}


export async function fetchShopifyProducts(
  first = 50,
  query?: string,
): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(STOREFRONT_QUERY, {
    first,
    query: query ?? null,
  })
  const edges =
    (data.data as { products?: { edges?: ShopifyProduct[] } })?.products?.edges ??
    []
  return edges
}

export async function fetchShopifyProductByHandle(
  handle: string,
): Promise<ShopifyProduct['node'] | null> {
  const products = await fetchShopifyProducts(10, `handle:${handle}`)
  return products[0]?.node ?? null
}
