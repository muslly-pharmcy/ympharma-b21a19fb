import { describe, expect, it } from 'vitest'
import { shouldPersistPublicQuery } from '@/lib/public-query-cache'

describe('persistent public metadata cache', () => {
  it.each([
    ['storefront', 'products', {}], ['storefront', 'home-products'],
    ['storefront', 'product', 'synthetic-id', 'images'],
    ['storefront', 'product', 'synthetic-id'], ['storefront', 'bundles'],
    ['cart'], ['orders'], ['admin', 'media'], ['storefront', 'unknown'],
  ])('does not persist signed images or non-allowlisted data: %s', (...queryKey) => {
    expect(shouldPersistPublicQuery({ queryKey, state: { status: 'success' } })).toBe(false)
  })
  it.each(['categories', 'shipping-zones', 'payment-methods'])('persists successful stable public %s only', (name) => {
    expect(shouldPersistPublicQuery({ queryKey: ['storefront', name], state: { status: 'success' } })).toBe(true)
    expect(shouldPersistPublicQuery({ queryKey: ['storefront', name], state: { status: 'error' } })).toBe(false)
    expect(shouldPersistPublicQuery({ queryKey: ['private', name], state: { status: 'success' } })).toBe(false)
  })
})
