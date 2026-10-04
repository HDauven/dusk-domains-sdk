import { describe, expect, it, vi } from 'vitest'
import { createDuskDomainsMarketplaceOnChainClient } from './marketplaceOnChain'

const node = `0x${'11'.repeat(32)}`
const seller = `0x${'22'.repeat(32)}`
const buyer = `0x${'33'.repeat(32)}`

describe('canonical marketplace reads', () => {
  it.each([false, true])('decodes exact-key reads with string integers %s and keeps monetary values as bigint', async strings => {
    const read = vi.fn(async (call: { functionName: string }) => JSON.parse(JSON.stringify({
      output: call.functionName === 'read_fixed_sale' ? {
        sale: {
          sale_id: 1, fee_bps: 250, opened_at: 50,
          node,
          name: 'example.dusk',
          seller_authority: seller,
          price_lux: '18446744073709551615',
          private_buyer: null,
          expires_at: 200,
          domain_expires_at: 300,
        },
      } : call.functionName === 'read_auction' ? {
        auction: {
          auction_id: 1, fee_bps: 250, duration_blocks: 100, start_deadline: 150, created_at: 50,
          node,
          name: 'example.dusk',
          seller_authority: seller,
          reserve_price_lux: 10_000_000_000,
          start_block: 100,
          end_block: 200,
          highest_bid: { bidder_authority: buyer, amount_lux: 12_000_000_000, placed_at: 101 },
          bid_count: 2,
        },
      } : call.functionName === 'read_offer' ? {
        offer: { offer_id: 42, fee_bps: 250, node, buyer_authority: buyer, amount_lux: 15_000_000_000, expires_at: 250 },
      } : {
        refund: { authority: buyer, amount_lux: 3_000_000_000 },
      },
      fnName: call.functionName,
    }, function (_key, value) {
      return strings && typeof value === 'number' && !Array.isArray(this) ? String(value) : value
    })))
    const client = createDuskDomainsMarketplaceOnChainClient({ read })

    expect(await client.getFixedSale(node)).toMatchObject({ ok: true, value: { priceLux: 18_446_744_073_709_551_615n } })
    expect(await client.getAuction(node)).toMatchObject({ ok: true, value: { highestBid: { amountLux: 12_000_000_000n } } })
    expect(await client.getOffer(node, buyer)).toMatchObject({ ok: true, value: { offerId: 42, feeBps: 250, amountLux: 15_000_000_000n } })
    expect(await client.getRefund(buyer)).toMatchObject({ ok: true, value: { amountLux: 3_000_000_000n } })
  })

  it('returns null for missing state and fails closed for malformed payloads', async () => {
    const missing = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ sale: null }) })
    expect(await missing.getFixedSale(node)).toEqual({ ok: true, value: null })

    const malformed = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ sale: { node: 'bad' } }) })
    expect(await malformed.getFixedSale(node)).toMatchObject({ ok: false, error: { code: 'contract_read_failed' } })
  })
})

it.each([{ offer_id: undefined }, { offer_id: 0 }, { offer_id: Number.MAX_SAFE_INTEGER + 1 }, { fee_bps: undefined }, { fee_bps: 1_001 }, { fee_bps: 1.5 }])('requires valid offer identity and fee: %j', async (changed) => {
  const client = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ offer: {
    node, buyer_authority: buyer, amount_lux: 10, expires_at: 100, offer_id: 1, fee_bps: 250, ...changed,
  } }) })
  expect(await client.getOffer(node, buyer)).toMatchObject({ ok: false, error: { code: 'contract_read_failed' } })
})

it('retains auction identity and every immutable reviewed term', async () => {
  const auction = {
    auction_id: '42', node, name: 'example.dusk', seller_authority: seller,
    reserve_price_lux: 10, duration_blocks: '8640', start_deadline: '900', created_at: '100',
    fee_bps: 250, start_block: null, end_block: null, highest_bid: null, bid_count: 0,
  }
  const client = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ auction }) })
  expect(await client.getAuction(node)).toMatchObject({ ok: true, value: {
    auctionId: 42, durationBlocks: 8640, startDeadlineBlockHeight: 900, createdAtBlockHeight: 100, feeBps: 250,
  } })
  for (const field of ['auction_id', 'duration_blocks', 'start_deadline', 'created_at', 'fee_bps']) {
    const malformed = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ auction: { ...auction, [field]: undefined } }) })
    expect(await malformed.getAuction(node)).toMatchObject({ ok: false })
  }
})

it.each([undefined, 0, -1, 1.5, '9007199254740993', true])('rejects malformed listing identity %s', async id => {
  const client = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({
    sale: { sale_id: id, node, name: 'example.dusk', seller_authority: seller, price_lux: 10, private_buyer: null, expires_at: 200, domain_expires_at: 300, fee_bps: 250, opened_at: 100 },
    auction: { auction_id: id, node, name: 'example.dusk', seller_authority: seller, reserve_price_lux: 10, duration_blocks: 100, start_deadline: 200, created_at: 100, fee_bps: 250, start_block: null, end_block: null, highest_bid: null, bid_count: 0 },
  }) })
  expect(await client.getAuction(node)).toMatchObject({ ok: false })
  expect(await client.getFixedSale(node)).toMatchObject({ ok: false })
})
