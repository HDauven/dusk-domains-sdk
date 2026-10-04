import { namehashHex } from '../core/namehash'
import type { DuskDomainsIndexerClient } from './indexerClient'
import { forwardResponse } from '../client/client.test-fixtures'
import { describe, expect, it } from 'vitest'
import {
  createDuskDomainsIndexerClient,
} from '../internal'

describe('Dusk Domains indexer client validation', () => {
  it('rejects malformed lifecycle and subname read models', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async (url) => {
        if (String(url).includes('/name?')) return Response.json({ node: '0x1' })
        return Response.json([{ node: '0x2' }])
      },
    })

    await expect(client.getNameState(`0x${'11'.repeat(32)}`)).rejects.toThrow('invalid name-state response')
    await expect(client.getSubnames('0x1')).rejects.toThrow('invalid subname list response')
  })

  it('rejects name summaries without primary status', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json([nameSummaryPayload({ primaryStatus: undefined })]),
    })

    await expect(client.getNames({ owner: 'dusk1owner' })).rejects.toThrow('invalid name list response')
  })

  it('rejects name summaries with invalid count fields', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json([nameSummaryPayload({
        subnameCount: 1.5,
        activityCount: -1,
      })]),
    })

    await expect(client.getNames({ owner: 'dusk1owner' })).rejects.toThrow('invalid name list response')
  })

  it('throws on invalid forward resolution responses', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json({ canonicalName: 'aurora.dusk' }),
    })

    await expect(client.resolveForward('aurora.dusk')).rejects.toThrow('invalid forward-resolution response')
  })

  it('rejects malformed marketplace auction responses', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async (url) => Response.json(String(url).includes('/auction?') ? { node: '0x1' } : [{ node: '0x1' }]),
    })

    await expect(client.getMarketplaceAuctions()).rejects.toThrow('invalid marketplace auction response')
    await expect(client.getMarketplaceAuction(`0x${'11'.repeat(32)}`)).rejects.toThrow('invalid marketplace auction response')
  })

  it('rejects marketplace amounts outside JavaScript safe integers', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json([marketplaceAuctionPayload({
        reservePriceLux: 9_007_199_254_740_992,
      })]),
    })

    await expect(client.getMarketplaceAuctions()).rejects.toThrow('invalid marketplace auction response')
  })

  it('includes structured indexer error payloads in failed request messages', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json({ error: 'not_found' }, { status: 404 }),
    })

    await expect(client.getNames()).rejects.toThrow('Dusk Domains indexer request failed with HTTP 404: not_found.')
  })

  it('includes bounded text details in failed request messages', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => new Response(` ${'indexer unavailable '.repeat(20)}`, { status: 503 }),
    })

    await expect(client.getNames()).rejects.toThrow(/^Dusk Domains indexer request failed with HTTP 503: indexer unavailable/)
    await expect(client.getNames()).rejects.toThrow(/\.\.\.\.$/)
  })

  it('binds a fixed-sale lookup to the requested node', async () => {
    const requestedNode = `0x${'10'.repeat(32)}`
    const substitutedNode = `0x${'20'.repeat(32)}`
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json(marketplaceFixedSalePayload({
        node: substitutedNode,
        name: 'attacker.dusk',
      })),
    })

    await expect(client.getMarketplaceFixedSale(requestedNode))
      .rejects.toThrow(/does not match|invalid marketplace fixed-sale response/i)
  })

  it('binds an offer lookup to the requested node and buyer', async () => {
    const requestedNode = `0x${'10'.repeat(32)}`
    const requestedBuyer = `0x${'30'.repeat(32)}`
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async () => Response.json(marketplaceOfferPayload({
        node: `0x${'20'.repeat(32)}`,
        buyerAuthority: `0x${'40'.repeat(32)}`,
        name: 'attacker.dusk',
      })),
    })

    await expect(client.getMarketplaceOffer(requestedNode, requestedBuyer))
      .rejects.toThrow(/does not match|invalid marketplace offer response/i)
  })
})

function nameSummaryPayload(overrides: Record<string, unknown> = {}) {
  return {
    node: `0x${'18'.repeat(32)}`,
    canonicalName: 'aurora.dusk',
    owner: 'dusk1owner',
    manager: 'dusk1manager',
    resolverId: `0x${'44'.repeat(32)}`,
    expiresAt: '2027-06-17T00:00:00.000Z',
    graceEndsAt: '2027-07-17T00:00:00.000Z',
    status: 'active',
    lastEventType: 'name_registered',
    records: [],
    primaryName: 'aurora.dusk',
    primaryStatus: 'verified',
    subnameCount: 1,
    activityCount: 1,
    ...overrides,
  }
}

function marketplaceAuctionPayload(overrides: Record<string, unknown> = {}) {
  return {
    node: `0x${'18'.repeat(32)}`,
    name: 'aurora.dusk',
    sellerAuthority: `0x${'22'.repeat(32)}`,
    reservePriceLux: 25_000_000_000,
    durationBlocks: 8_640,
    startDeadlineBlockHeight: 20_000,
    feeBps: 250,
    startBlockHeight: null,
    endBlockHeight: null,
    highestBid: null,
    bidCount: 0,
    createdAtBlockHeight: 1_000,
    marketplaceContractId: `0x${'33'.repeat(32)}`,
    escrowed: true,
    txId: null,
    blockHeight: 1_000,
    auctionId: 1, lastEventType: 'domain_auction_created',
    ...overrides,
  }
}

function marketplaceFixedSalePayload(overrides: Record<string, unknown> = {}) {
  return {
    node: `0x${'18'.repeat(32)}`,
    name: 'aurora.dusk',
    sellerAuthority: `0x${'22'.repeat(32)}`,
    priceLux: 25_000_000_000,
    privateBuyer: null,
    feeBps: 250,
    expiresAtBlockHeight: 20_000,
    openedAtBlockHeight: 1_000,
    marketplaceContractId: `0x${'33'.repeat(32)}`,
    escrowed: true,
    txId: null,
    blockHeight: 1_000,
    saleId: 1, lastEventType: 'domain_fixed_sale_opened',
    ...overrides,
  }
}

function marketplaceOfferPayload(overrides: Record<string, unknown> = {}) {
  return {
    node: `0x${'18'.repeat(32)}`,
    name: 'aurora.dusk',
    buyerAuthority: `0x${'22'.repeat(32)}`,
    amountLux: 25_000_000_000,
    feeBps: 250,
    expiresAtBlockHeight: 20_000,
    placedAtBlockHeight: 1_000,
    txId: null,
    blockHeight: 1_000,
    lastEventType: 'domain_offer_placed',
    ...overrides,
  }
}

describe('exact indexer request binding', () => {
  const node = namehashHex('aurora.dusk')
  const other = namehashHex('another.dusk')
  const buyer = `0x${'ab'.repeat(32)}`
  const subname = { node, name: 'aurora.dusk', parentNode: other, parentName: 'another.dusk', label: 'aurora', owner: buyer, manager: buyer, resolver: buyer, expiresAt: '', parentExpiresAt: '', expiryPolicy: 'inherits_parent', status: 'active', createdAt: '', lastEventType: 'subname_created', txId: null, blockHeight: null }
  const cases = [
    { method: 'name', payload: nameSummaryPayload({ node }), read: (c: DuskDomainsIndexerClient) => c.getNameState(node), wrong: { canonicalName: 'another.dusk' } },
    { method: 'subname', payload: subname, read: (c: DuskDomainsIndexerClient) => c.getSubname(node), wrong: { node: other } },
    { method: 'sale', payload: marketplaceFixedSalePayload({ node }), read: (c: DuskDomainsIndexerClient) => c.getMarketplaceFixedSale(node), wrong: { name: 'another.dusk' } },
    { method: 'auction', payload: marketplaceAuctionPayload({ node }), read: (c: DuskDomainsIndexerClient) => c.getMarketplaceAuction(node), wrong: { node: other } },
    { method: 'offer buyer', payload: marketplaceOfferPayload({ node, buyerAuthority: buyer }), read: (c: DuskDomainsIndexerClient) => c.getMarketplaceOffer(node, buyer), wrong: { buyerAuthority: other } },
    { method: 'record', payload: { key: 'website', value: 'https://example.com', visibility: 'public', ttlSeconds: 60, updatedAt: '' }, read: (c: DuskDomainsIndexerClient) => c.getNodeRecord(node, 'website'), wrong: { key: 'avatar' } },
    { method: 'refund', payload: { authority: buyer, recipient: null, amountLux: 10, lastEventType: '', txId: null, blockHeight: null }, read: (c: DuskDomainsIndexerClient) => c.getMarketplaceRefund(buyer), wrong: { authority: other } },
    { method: 'referral', payload: { supported: true, referrer: buyer, claimableLux: 0, claimedLux: 0, referralCount: 0, recentActivity: [] }, read: (c: DuskDomainsIndexerClient) => c.getReferralState(buyer), wrong: { referrer: other } },
    ...['commitment', 'controller'].map((field) => ({ method: field, payload: { commitment: node, controller: buyer, createdAt: null, node: null, status: 'committed', committedTxId: null, committedBlockHeight: null, revealedTxId: null, revealedBlockHeight: null, lastEventType: 'registration_committed' }, read: (c: DuskDomainsIndexerClient) => c.getCommitment(node, buyer), wrong: { [field]: other } })),
    { method: 'search', payload: { canonical: 'aurora.dusk', canonicalRaw: 'aurora.dusk', displayName: 'aurora.dusk', label: 'aurora', status: 'available', price: 50, issues: [], transactionBlocked: false }, read: (c: DuskDomainsIndexerClient) => c.searchName('Aurora'), wrong: { canonical: 'another.dusk' } },
  ]
  it.each(cases)('rejects a mismatched $method response after accepting the matching response', async ({ payload, read, wrong }) => {
    let response = payload
    const client = createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: async () => Response.json(response) })
    await expect(read(client)).resolves.toEqual(payload)
    response = { ...payload, ...wrong }
    await expect(read(client)).rejects.toThrow('does not match the request')
  })

  it('normalizes requested names and keys while checking canonical namehashes', async () => {
    const payload = marketplaceOfferPayload({ node: node.toUpperCase(), buyerAuthority: buyer.toUpperCase() })
    const client = createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: async () => Response.json(payload) })
    await expect(client.getMarketplaceOffer(node.slice(2).toUpperCase(), buyer.slice(2))).resolves.toEqual(payload)
    payload.name = 'another.dusk'
    await expect(client.getMarketplaceOffer(node, buyer)).rejects.toThrow('does not match')
  })

  it('checks forward name and node independently against the normalized request', async () => {
    let payload = forwardResponse('address')
    const client = createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: async () => Response.json(payload) })
    await expect(client.resolveForward(' Aurora ')).resolves.toEqual(payload)
    for (const changed of [{ node: other }, { canonicalName: 'another.dusk' }]) {
      payload = { ...forwardResponse('address'), ...changed }
      await expect(client.resolveForward('aurora.dusk')).rejects.toThrow('does not match')
    }
  })

  it('rejects reverse endpoint substitution and requires a matching legacy forward record', async () => {
    let payload: unknown = { name: 'aurora.dusk', node, endpoint: { type: 'moonlight_address', value: 'other' } }
    const client = createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: async (url) => Response.json(String(url).includes('/resolve?') ? forwardResponse('other') : payload) })
    await expect(client.getPrimaryName({ type: 'moonlight_address', value: 'address' })).rejects.toThrow('does not match')
    payload = 'aurora.dusk'
    await expect(client.getPrimaryName({ type: 'moonlight_address', value: 'address' })).rejects.toThrow('does not match')
  })
})
