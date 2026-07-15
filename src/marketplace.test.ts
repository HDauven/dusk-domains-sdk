import { describe, expect, it } from 'vitest'
import {
  coreEscrowAuctionRuntimeCall,
  MARKETPLACE_ANTI_SNIPING_BLOCKS,
  MARKETPLACE_MAX_EXTENSION_BLOCKS,
  MARKETPLACE_MAX_FEE_BPS,
  MARKETPLACE_MAX_CLIENT_AMOUNT_LUX,
  MARKETPLACE_MIN_AMOUNT_LUX,
  MARKETPLACE_MIN_BID_INCREMENT_BPS,
  marketplacePlaceOfferRuntimeCall,
  marketplaceSettleAuctionRuntimeCall,
} from './marketplace'

describe('public marketplace SDK surface', () => {
  it('matches the release-pinned economic and auction constants', () => {
    expect(MARKETPLACE_MIN_AMOUNT_LUX).toBe(1_000_000_000n)
    expect(MARKETPLACE_MIN_BID_INCREMENT_BPS).toBe(500)
    expect(MARKETPLACE_ANTI_SNIPING_BLOCKS).toBe(60)
    expect(MARKETPLACE_MAX_EXTENSION_BLOCKS).toBe(60_480)
    expect(MARKETPLACE_MAX_FEE_BPS).toBe(1_000)
    expect(MARKETPLACE_MAX_CLIENT_AMOUNT_LUX).toBe(9_007_199_254_740_991n)
  })

  it('builds transport-neutral core and marketplace calls', () => {
    const node = `0x${'11'.repeat(32)}`
    const marketplaceContract = `0x${'22'.repeat(32)}`
    const auction = coreEscrowAuctionRuntimeCall({
      node,
      marketplaceContract,
      name: 'aurora.dusk',
      reservePriceLux: Number(MARKETPLACE_MIN_AMOUNT_LUX),
      durationBlocks: 8_640,
      sellerRecipient: 'dusk1seller',
    })
    const offer = marketplacePlaceOfferRuntimeCall({
      node,
      amountLux: Number(MARKETPLACE_MIN_AMOUNT_LUX),
      expiresAt: 20_000,
      buyerManager: null,
    })

    expect(auction).toMatchObject({ contract: 'core', functionName: 'escrow_auction_runtime', kind: 'write' })
    expect(offer).toMatchObject({ contract: 'marketplace', functionName: 'place_offer_runtime', kind: 'write' })
    expect(marketplaceSettleAuctionRuntimeCall({ node })).toMatchObject({
      contract: 'marketplace',
      functionName: 'settle_auction_runtime',
      kind: 'write',
    })
  })
})
