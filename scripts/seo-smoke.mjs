#!/usr/bin/env node
// Public-only production SEO contract checks; no credentials or patient data.
const base = new URL((process.env.SEO_BASE_URL || process.argv[2] || 'https://muslly.com').replace(/\/+$/, '') + '/')
const checks = []
const problems = []

async function page(path) {
  const response = await fetch(new URL(path.replace(/^\//, ''), base), {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'Muslly-Public-SEO-Monitor/1.0' },
  })
  return {
    path,
    status: response.status,
    url: response.url,
    type: response.headers.get('content-type') || '',
    body: await response.text(),
  }
}

function assert(name, condition, detail) {
  checks.push({ name, success: Boolean(condition), detail })
  if (!condition) problems.push(name + ': ' + detail)
}

function canonical(body, url) {
  const matches = body.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi) || []
  return matches.length === 1 && matches[0].includes('href="' + url + '"')
}

function hasNoindex(body) {
  return /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(body)
}

const paths = ['/', '/shop', '/sitemap.xml', '/robots.txt', '/search', '/auth', '/product/00000000-0000-4000-8000-000000000000']
let results
try {
  results = await Promise.all(paths.map(page))
} catch (error) {
  console.error('Site unavailable during SEO smoke:', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
const byPath = Object.fromEntries(results.map((r) => [r.path, r]))
const home = byPath['/']
const shop = byPath['/shop']
const sitemap = byPath['/sitemap.xml']
const robots = byPath['/robots.txt']
const missing = byPath['/product/00000000-0000-4000-8000-000000000000']

for (const p of ['/', '/shop']) {
  const result = byPath[p]
  assert(p + ' HTTP 200', result.status === 200, String(result.status))
  assert(p + ' single H1', (result.body.match(/<h1(?:\s|>)/gi) || []).length === 1,
    String((result.body.match(/<h1(?:\s|>)/gi) || []).length))
}
assert('HTTPS canonical home', canonical(home.body, base.href), base.href)
assert('HTTPS canonical shop', canonical(shop.body, new URL('shop', base).href), new URL('shop', base).href)
assert('Sitemap XML response', sitemap.status === 200 && /(?:xml)/i.test(sitemap.type),
  sitemap.status + ' ' + sitemap.type)
assert('Sitemap includes the public shop', sitemap.body.includes('<loc>' + new URL('shop', base).href + '</loc>'), '/shop')
for (const p of ['/auth', '/search', '/ai-chat', '/cart']) {
  assert('Sitemap excludes ' + p, !sitemap.body.includes('<loc>' + new URL(p.slice(1), base).href + '</loc>'), p)
}
assert('Robots response', robots.status === 200 && /text\/plain/i.test(robots.type), robots.status + ' ' + robots.type)
assert('Robots references sitemap', robots.body.includes('Sitemap: ' + new URL('sitemap.xml', base).href), '/sitemap.xml')
assert('Robots avoids API crawling', robots.body.includes('Disallow: /api/'), '/api/')
for (const p of ['/auth', '/search']) {
  assert('Noindex ' + p, hasNoindex(byPath[p].body), byPath[p].status + ' ' + p)
}
assert('Unknown product is HTTP 404', missing.status === 404, String(missing.status))
assert('Unknown product is noindex', hasNoindex(missing.body), String(missing.status))

for (const item of checks) {
  console.log((item.success ? 'PASS ' : 'FAIL ') + item.name + ' — ' + item.detail)
}
console.log(JSON.stringify({ base: base.href, checked: checks.length, passed: checks.length - problems.length, failed: problems.length }, null, 2))
if (problems.length) process.exitCode = 1
