import { describe, expect, it, vi } from 'vitest'
import { createDuskDomainsIndexerClient, type IndexedNameSummary } from '../internal'

const name: IndexedNameSummary = {
  node: `0x${'11'.repeat(32)}`, canonicalName: 'aurora.dusk', owner: 'owner', manager: null,
  resolverId: null, expiresAt: null, graceEndsAt: null, status: 'active', lastEventType: 'name_registered',
  records: [], primaryName: null, primaryStatus: 'no_address', subnameCount: 0, activityCount: 0,
}

function clientFor(body: unknown) {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => Response.json(body))
  return { fetcher, client: createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: fetcher }) }
}

describe('indexer cursor client', () => {
  it('preserves page fields, cursor query encoding, and array convenience methods', async () => {
    const { client, fetcher } = clientFor({ names: [name], nextCursor: 'opaque+/=' })
    expect(await client.getNamesPage({ owner: 'owner', limit: 2, cursor: 'opaque+/=' })).toEqual({ names: [name], nextCursor: 'opaque+/=' })
    expect(String(fetcher.mock.calls[0][0])).toBe('/indexer/names?owner=owner&limit=2&cursor=opaque%2B%2F%3D')
    expect(await client.getNames()).toEqual([name])
  })

  it.each([
    ['records', 'records', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getNodeRecordsPage('node', { limit: 3, cursor: 'next' })],
    ['record-history', 'history', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getRecordHistoryPage('node', 'website', { limit: 3, cursor: 'next' })],
    ['activity', 'activity', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getActivityPage('node', { limit: 3, cursor: 'next' })],
    ['subnames', 'subnames', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getSubnamesPage('node', { limit: 3, cursor: 'next' })],
    ['marketplace/fixed-sales', 'fixedSales', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getMarketplaceFixedSalesPage({ limit: 3, cursor: 'next' })],
    ['marketplace/auctions', 'auctions', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getMarketplaceAuctionsPage({ limit: 3, cursor: 'next' })],
    ['marketplace/offers', 'offers', (client: ReturnType<typeof createDuskDomainsIndexerClient>) => client.getMarketplaceOffersPage({ node: 'node', buyerAuthority: 'buyer', limit: 3, cursor: 'next' })],
  ] as const)('supports %s pages', async (path, field, read) => {
    const { client, fetcher } = clientFor({ [field]: [], nextCursor: null })
    expect(await read(client)).toEqual({ [field]: [], nextCursor: null })
    const url = new URL(String(fetcher.mock.calls[0][0]), 'http://local')
    expect(url.pathname).toBe(`/indexer/${path}`)
    expect(url.searchParams.get('limit')).toBe('3')
    expect(url.searchParams.get('cursor')).toBe('next')
    if (path === 'record-history') expect(url.searchParams.get('key')).toBe('website')
    if (path === 'marketplace/offers') expect(url.searchParams.get('buyerAuthority')).toBe('buyer')
  })

  it.each([
    { names: [name] }, { names: [name], nextCursor: 2 }, { names: [name], nextCursor: '' },
    { names: [{}], nextCursor: null }, { names: Array(201).fill(name), nextCursor: null },
  ])('rejects malformed or oversized pages', async (body) => {
    await expect(clientFor(body).client.getNamesPage()).rejects.toThrow('invalid name list')
  })

  it('accepts legacy arrays during migration', async () => {
    expect(await clientFor([name]).client.getNamesPage()).toEqual({ names: [name], nextCursor: null })
  })

  it('accepts legacy collections over a page while enforcing complete-set caps', async () => {
    const names = Array.from({ length: 201 }, (_, index) => ({ ...name, node: `node-${index}` }))
    const { client } = clientFor(names)
    expect(await client.getNames({ owner: 'owner' })).toEqual(names)
    expect(await client.getAllNames({ owner: 'owner' })).toEqual(names)
    await expect(client.getAllNames({ owner: 'owner', maxItems: 200 })).rejects.toThrow('cap')
    for (const size of [10_001, 150_000]) {
      await expect(clientFor(Array(size).fill(name)).client.getAllNames({ owner: 'owner' })).rejects.toThrow('cap')
    }
    await expect(clientFor([...names, {}]).client.getNames()).rejects.toThrow('invalid name list')
  })

  it('follows cursors for a scoped complete set', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => Response.json(String(url).includes('cursor=second')
      ? { names: [{ ...name, node: 'second' }], nextCursor: null }
      : { names: [name], nextCursor: 'second' }))
    const client = createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: fetcher })
    expect(await client.getAllNames({ owner: 'owner', maxItems: 3 })).toEqual([name, { ...name, node: 'second' }])
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      '/indexer/names?owner=owner&limit=3', '/indexer/names?owner=owner&limit=2&cursor=second',
    ])
  })

  it('fails explicitly at the cap, on cursor cycles, and on empty advancing pages', async () => {
    await expect(clientFor({ names: [name], nextCursor: 'again' }).client.getAllNames({ owner: 'owner', maxItems: 1 })).rejects.toThrow('cap')
    await expect(clientFor({ names: [name], nextCursor: 'again' }).client.getAllNames({ owner: 'owner' })).rejects.toThrow('did not advance')
    await expect(clientFor({ names: [], nextCursor: 'again' }).client.getAllNames({ owner: 'owner' })).rejects.toThrow('did not advance')
    for (const maxItems of [0, -1, 1.5, 10_001]) {
      const { client, fetcher } = clientFor([])
      await expect(client.getAllNames({ owner: 'owner', maxItems })).rejects.toThrow('cap')
      expect(fetcher).not.toHaveBeenCalled()
    }
    await expect(clientFor([]).client.getAllNames({ owner: ' ' })).rejects.toThrow('owner')
  })

  it('passes pagination to health and the single-result search endpoint', async () => {
    const health = { ok: true, generatedAt: '', source: 'test', mode: 'snapshot', currentBlockHeight: null, routes: [], names: 0, warnings: [], nextCursor: 'health-next' }
    const healthClient = clientFor(health)
    expect(await healthClient.client.getHealth({ limit: 3, cursor: 'health-prev' })).toEqual(health)
    expect(String(healthClient.fetcher.mock.calls[0][0])).toBe('/indexer/health?limit=3&cursor=health-prev')
    const search = { canonical: 'aurora.dusk', canonicalRaw: 'aurora.dusk', displayName: 'aurora.dusk', label: 'aurora', status: 'available', price: 50, issues: [], transactionBlocked: false, nextCursor: null }
    const searchClient = clientFor(search)
    expect(await searchClient.client.searchName('aurora', { limit: 1 })).toEqual(search)
    expect(String(searchClient.fetcher.mock.calls[0][0])).toBe('/indexer/search?query=aurora&limit=1')
  })

  it('passes warning pagination to forward resolution without losing resolution fields', async () => {
    const response = { canonicalName: 'aurora.dusk', node: 'node', records: [], resolver: {}, expiry: {}, cache: {}, warnings: [], errors: [], verificationStatus: 'unverified', nextCursor: 'more-warnings' }
    const { client, fetcher } = clientFor(response)
    expect(await client.resolveForward('aurora.dusk', { cursor: 'previous', limit: 4 })).toEqual(response)
    expect(String(fetcher.mock.calls[0][0])).toBe('/indexer/resolve?name=aurora.dusk&cursor=previous&limit=4')
  })

  it('caps complete subname reads too', async () => {
    const { client, fetcher } = clientFor({ subnames: [], nextCursor: null })
    expect(await client.getAllSubnames('parent')).toEqual([])
    expect(String(fetcher.mock.calls[0][0])).toBe('/indexer/subnames?parentNode=parent&limit=200')
    await expect(client.getAllSubnames('')).rejects.toThrow('parent')
  })
})
