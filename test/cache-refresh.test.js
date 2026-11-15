/* global describe, it, expect, jest, beforeEach */
jest.mock('node-fetch')

const fetch = require('node-fetch')
const Cache = require('../lib/cache')

const asset = (id, name) => ({
  id,
  name,
  updated_at: '2026-11-15T00:00:00Z',
  url: `https://api.github.com/assets/${id}`,
  browser_download_url: `https://github.com/acme/app/releases/download/1.0.0/${name}`,
  content_type: 'application/octet-stream',
  size: 1000000
})

const respondWith = assets => {
  fetch.mockImplementation(async () => ({
    status: 200,
    json: async () => [
      {
        tag_name: '1.0.0',
        draft: false,
        prerelease: false,
        body: '',
        published_at: '2026-11-15T00:00:00Z',
        assets
      }
    ]
  }))
}

describe('Cache refresh', () => {
  beforeEach(() => fetch.mockReset())

  it('picks up files added to a release that is already cached', async () => {
    const cache = new Cache({ account: 'acme', repository: 'app' })
    const windowsOnly = [asset(1, 'app-setup-1.0.0.exe')]

    respondWith(windowsOnly)
    let latest = await cache.loadCache()
    expect(Object.keys(latest.platforms)).toEqual(['exe'])

    // The Mac build is uploaded later, to the same version.
    respondWith([...windowsOnly, asset(2, 'App-1.0.0-mac.zip')])
    cache.clearCache()
    latest = await cache.loadCache()
    expect(latest.version).toBe('1.0.0')
    expect(Object.keys(latest.platforms).sort()).toEqual(['darwin', 'exe'])
    expect(latest.platforms.darwin.name).toBe('App-1.0.0-mac.zip')
  })

  it('does not rebuild the cache when nothing changed', async () => {
    const cache = new Cache({ account: 'acme', repository: 'app' })
    respondWith([asset(1, 'app-setup-1.0.0.exe')])

    const first = await cache.loadCache()
    cache.clearCache()
    const second = await cache.loadCache()

    // Same object: refreshCache returned early instead of clearing it.
    expect(second.platforms).toBe(first.platforms)
  })
})
