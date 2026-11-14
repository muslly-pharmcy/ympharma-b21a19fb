import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('YmPharma Cloudflare build boundaries', () => {
  const wrangler = JSON.parse(readFileSync(resolve('wrangler.jsonc'), 'utf8'))
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  const viteConfig = readFileSync(resolve('vite.config.ts'), 'utf8')

  it('binds the intended Worker name and TanStack server entry', () => {
    expect(wrangler.name).toBe('ympharma-b21a19fb')
    expect(wrangler.main).toBe('@tanstack/react-start/server-entry')
  })

  it('defines Preview settings to prevent preview deployments using implicit production bindings', () => {
    expect(wrangler).toHaveProperty('previews')
    expect(wrangler.previews).toEqual({})
    expect(wrangler.previews).not.toHaveProperty('vars.SUPABASE_SERVICE_ROLE_KEY')
  })

  it('keeps the Cloudflare build separate from the Node/Nitro build', () => {
    expect(pkg.scripts['build:cloudflare']).toContain('cloudflare-target.mjs build')
    expect(pkg.scripts['validate:cloudflare']).toContain('cloudflare-target.mjs validate')
    expect(viteConfig).toContain('CLOUDFLARE_BUILD')
    expect(viteConfig).toContain('WORKERS_CI')
    expect(viteConfig).toContain('nitro: isCapacitorBuild || isCloudflareBuild')
    expect(viteConfig).toContain('cloudflare({')
  })

  it('pins a Wrangler supporting Worker Previews', () => {
    const [major, minor] = pkg.devDependencies.wrangler.split('.').map(Number)
    expect(major).toBeGreaterThanOrEqual(4)
    expect(minor).toBeGreaterThanOrEqual(135)
  })
})
