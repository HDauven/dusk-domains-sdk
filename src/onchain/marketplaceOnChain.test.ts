import { describe, expect, it, vi } from 'vitest'
import { createDuskDomainsMarketplaceOnChainClient } from './marketplaceOnChain'

const node = `0x${'11'.repeat(32)}`
const seller = `0x${'22'.repeat(32)}`
const buyer = `0x${'33'.repeat(32)}`

describe('canonical marketplace reads', () => {
  it('decodes exact-key reads and keeps monetary values as bigint', async () => {
    const read = vi.fn(async (call: { functionName: string }) => ({
      output: call.functionName === 'read_fixed_sale' ? {
        sale: {
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
        offer: { node, buyer_authority: buyer, amount_lux: 15_000_000_000, expires_at: 250 },
      } : {
        refund: { authority: buyer, amount_lux: 3_000_000_000 },
      },
      fnName: call.functionName,
    }))
    const client = createDuskDomainsMarketplaceOnChainClient({ read })

    expect(await client.getFixedSale(node)).toMatchObject({ ok: true, value: { priceLux: 18_446_744_073_709_551_615n } })
    expect(await client.getAuction(node)).toMatchObject({ ok: true, value: { highestBid: { amountLux: 12_000_000_000n } } })
    expect(await client.getOffer(node, buyer)).toMatchObject({ ok: true, value: { amountLux: 15_000_000_000n } })
    expect(await client.getRefund(buyer)).toMatchObject({ ok: true, value: { amountLux: 3_000_000_000n } })
  })

  it('returns null for missing state and fails closed for malformed payloads', async () => {
    const missing = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ sale: null }) })
    expect(await missing.getFixedSale(node)).toEqual({ ok: true, value: null })

    const malformed = createDuskDomainsMarketplaceOnChainClient({ read: async () => ({ sale: { node: 'bad' } }) })
    expect(await malformed.getFixedSale(node)).toMatchObject({ ok: false, error: { code: 'contract_read_failed' } })
  })
})
