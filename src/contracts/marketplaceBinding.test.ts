import { describe, expect, it } from 'vitest'
import {
  marketplaceBuyFixedSaleRuntimeCall, marketplaceCancelFixedSaleRuntimeCall,
  marketplaceExpireFixedSaleRuntimeCall, marketplacePlaceBidRuntimeCall,
  marketplaceCancelAuctionRuntimeCall, marketplaceExpireAuctionRuntimeCall,
  marketplaceSettleAuctionRuntimeCall, marketplaceCancelOfferRuntimeCall,
  marketplaceExpireOfferRuntimeCall,
} from './callBuilders'
import { toDuskDomainWireArgs } from './callWireArgs'
import { decodedDuskDomainContext } from './callContext'

const node = `0x${'11'.repeat(32)}`
const calls = [
  marketplaceBuyFixedSaleRuntimeCall({ node, priceLux: 10, expectedSaleId: 7 }),
  marketplaceCancelFixedSaleRuntimeCall({ node, expectedSaleId: 7 }),
  marketplaceExpireFixedSaleRuntimeCall({ node, expectedSaleId: 7 }),
  marketplacePlaceBidRuntimeCall({ node, amountLux: 10, expectedAuctionId: 7 }),
  marketplaceCancelAuctionRuntimeCall({ node, expectedAuctionId: 7 }),
  marketplaceExpireAuctionRuntimeCall({ node, expectedAuctionId: 7 }),
  marketplaceSettleAuctionRuntimeCall({ node, expectedAuctionId: 7 }),
  marketplaceCancelOfferRuntimeCall({ node, expectedOfferId: 7 }),
  marketplaceExpireOfferRuntimeCall({ node, buyerAuthority: node, expectedOfferId: 7 }),
]

describe('marketplace reviewed identity', () => {
  it.each(calls)('encodes and displays the reviewed identity for $functionName', call => {
    const kind = 'expectedSaleId' in call.args ? 'sale' : 'expectedAuctionId' in call.args ? 'auction' : 'offer'
    expect(toDuskDomainWireArgs(call)).toMatchObject({ [`expected_${kind}_id`]: 7 })
    expect(decodedDuskDomainContext(call)?.fields).toContainEqual({ label: `${kind[0].toUpperCase()}${kind.slice(1)} ID`, value: '7' })
  })

  it.each(calls)('rejects missing or inexact identity for $functionName', call => {
    const key = 'expectedSaleId' in call.args ? 'expectedSaleId' : 'expectedAuctionId' in call.args ? 'expectedAuctionId' : 'expectedOfferId'
    for (const value of [undefined, null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '7']) {
      expect(() => toDuskDomainWireArgs({ ...call, args: { ...call.args, [key]: value } })).toThrow('Invalid')
    }
  })

  it('encodes bids with only the reviewed placement and chosen amount', () => {
    expect(toDuskDomainWireArgs(calls[3])).toStrictEqual({
      node: Array(32).fill(0x11), expected_auction_id: 7, amount_lux: 10, bidder_manager: null,
    })
    expect(decodedDuskDomainContext(calls[3])?.fields.map(field => field.label)).toEqual([
      'Domain reference', 'Auction ID', 'Bid', 'Manager',
    ])
  })

  it('encodes settlement with only the reviewed placement', () => {
    expect(toDuskDomainWireArgs(calls[6])).toStrictEqual({ node: Array(32).fill(0x11), expected_auction_id: 7 })
    expect(decodedDuskDomainContext(calls[6])?.fields.map(field => field.label)).toEqual(['Domain reference', 'Auction ID'])
  })
})
