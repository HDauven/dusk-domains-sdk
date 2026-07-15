import { describe, expect, it } from 'vitest'
import { createLifecycleEventProjector } from './indexer'

const node = `0x${'11'.repeat(32)}`
const seller = `0x${'22'.repeat(32)}`
const bidder = `0x${'33'.repeat(32)}`
const nextBidder = `0x${'44'.repeat(32)}`
const marketplace = `0x${'55'.repeat(32)}`

describe('Dusk Domains marketplace projector', () => {
  it('reconciles escrow after the nested marketplace event arrives before the core owner event', () => {
    const projector = createLifecycleEventProjector()
    projector.apply({
      type: 'name_registered',
      node,
      label: 'aurora',
      actor: seller,
      owner: seller,
      expiresAt: '2028-07-05T00:00:00.000Z',
      graceEndsAt: '2028-08-05T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })
    projector.applyMarketplace({
      type: 'domain_auction_created',
      node,
      name: 'aurora.dusk',
      sellerAuthority: seller,
      reservePriceLux: 50_000_000_000,
      durationBlocks: 8_640,
      startDeadlineBlockHeight: 20_000,
      feeBps: 250,
      createdAtBlockHeight: 1_020,
    }, { txId: 'tx-create', blockHeight: 1_020, contractId: marketplace })

    expect(projector.getMarketplaceAuctionByNode(node)?.escrowed).toBe(false)

    projector.apply({
      type: 'name_owner_changed',
      node,
      actor: seller,
      previousOwner: seller,
      owner: marketplace,
      manager: marketplace,
      resolver: marketplace,
      expiresAt: '2028-07-05T00:00:00.000Z',
    })

    expect(projector.getMarketplaceAuctionByNode(node)?.escrowed).toBe(true)
  })

  it('rejects unsafe event amounts instead of projecting rounded balances', () => {
    const projector = createLifecycleEventProjector()
    registerAndEscrow(projector)

    expect(() => projector.applyMarketplace({
      type: 'domain_fixed_sale_opened',
      node,
      name: 'aurora.dusk',
      sellerAuthority: seller,
      priceLux: 9_007_199_254_740_992,
      privateBuyer: null,
      feeBps: 250,
      expiresAtBlockHeight: 8_000,
      openedAtBlockHeight: 1_000,
    }, { blockHeight: 1_000, contractId: marketplace })).toThrow('unsafe numeric value')

    expect(() => projector.applyMarketplace({
      type: 'domain_fixed_sale_opened',
      node,
      name: 'aurora.dusk',
      sellerAuthority: seller,
      priceLux: '9007199254740993',
      privateBuyer: null,
      feeBps: 250,
      expiresAtBlockHeight: 8_000,
      openedAtBlockHeight: 1_000,
    } as unknown as Parameters<typeof projector.applyMarketplace>[0], {
      blockHeight: 1_000,
      contractId: marketplace,
    })).toThrow('unsafe numeric value')
  })

  it('rejects refund totals that exceed the safe integer range', () => {
    const projector = createLifecycleEventProjector()
    registerAndEscrow(projector)

    const closeOffer = (amountLux: number) => {
      projector.applyMarketplace({
        type: 'domain_offer_closed',
        node,
        buyerAuthority: bidder,
        amountLux,
        expired: false,
        closedAtBlockHeight: 1_000,
      })
    }

    closeOffer(Number.MAX_SAFE_INTEGER)
    expect(() => closeOffer(1)).toThrow('refund balance')
  })

  it('projects fixed sales, reserve auctions, offers and aggregate pull refunds', () => {
    const projector = createLifecycleEventProjector()
    registerAndEscrow(projector)

    projector.applyMarketplace({
      type: 'domain_fixed_sale_opened',
      node,
      name: 'aurora.dusk',
      sellerAuthority: seller,
      priceLux: 25_000_000_000,
      privateBuyer: null,
      feeBps: 250,
      expiresAtBlockHeight: 8_000,
      openedAtBlockHeight: 1_000,
    }, { txId: 'tx-fixed', blockHeight: 1_000, contractId: marketplace })
    expect(projector.getMarketplaceFixedSaleByNode(node)).toMatchObject({
      priceLux: 25_000_000_000,
      escrowed: true,
    })
    projector.applyMarketplace({
      type: 'domain_fixed_sale_closed',
      node,
      sellerAuthority: seller,
      expired: false,
      domainExpired: false,
      closedAtBlockHeight: 1_010,
    })
    expect(projector.getMarketplaceFixedSaleByNode(node)).toBeNull()

    projector.applyMarketplace({
      type: 'domain_auction_created',
      node,
      name: 'aurora.dusk',
      sellerAuthority: seller,
      reservePriceLux: 50_000_000_000,
      durationBlocks: 8_640,
      startDeadlineBlockHeight: 20_000,
      feeBps: 250,
      createdAtBlockHeight: 1_020,
    }, { txId: 'tx-create', blockHeight: 1_020, contractId: marketplace })
    projector.applyMarketplace({
      type: 'domain_bid_placed',
      node,
      bidderAuthority: bidder,
      amountLux: 50_000_000_000,
      previousBidderAuthority: null,
      previousBidLux: 0,
      startBlock: 1_030,
      endBlock: 9_670,
      started: true,
      extended: false,
      bidCount: 1,
      placedAtBlockHeight: 1_030,
    }, { txId: 'tx-bid-one', blockHeight: 1_030 })
    projector.applyMarketplace({
      type: 'domain_bid_placed',
      node,
      bidderAuthority: nextBidder,
      amountLux: 52_500_000_000,
      previousBidderAuthority: bidder,
      previousBidLux: 50_000_000_000,
      startBlock: 1_030,
      endBlock: 9_730,
      started: false,
      extended: true,
      bidCount: 2,
      placedAtBlockHeight: 9_680,
    }, { txId: 'tx-bid-two', blockHeight: 9_680 })

    expect(projector.getMarketplaceAuctionByNode(node)).toMatchObject({
      escrowed: true,
      endBlockHeight: 9_730,
      bidCount: 2,
      highestBid: {
        bidderAuthority: nextBidder,
        amountLux: 52_500_000_000,
      },
    })
    expect(projector.getMarketplaceRefund(bidder)).toMatchObject({
      authority: bidder,
      amountLux: 50_000_000_000,
    })

    projector.applyMarketplace({
      type: 'domain_auction_settled',
      node,
      name: 'aurora.dusk',
      sellerAuthority: seller,
      winnerAuthority: null,
      grossAmountLux: 0,
      protocolFeeLux: 0,
      sellerProceedsLux: 0,
      domainExpired: true,
      settledAtBlockHeight: 9_730,
    }, { txId: 'tx-settle', blockHeight: 9_730 })
    expect(projector.getMarketplaceAuctionByNode(node)).toBeNull()
    expect(projector.getMarketplaceRefund(nextBidder)?.amountLux).toBe(52_500_000_000)

    projector.applyMarketplace({
      type: 'domain_offer_placed',
      node,
      buyerAuthority: bidder,
      amountLux: 20_000_000_000,
      feeBps: 250,
      expiresAtBlockHeight: 12_000,
      placedAtBlockHeight: 10_000,
    }, { txId: 'tx-offer', blockHeight: 10_000 })
    expect(projector.getMarketplaceOffers({ node })).toHaveLength(1)
    projector.applyMarketplace({
      type: 'domain_offer_closed',
      node,
      buyerAuthority: bidder,
      amountLux: 20_000_000_000,
      expired: false,
      closedAtBlockHeight: 10_010,
    }, { txId: 'tx-cancel-offer', blockHeight: 10_010 })
    expect(projector.getMarketplaceOffer(node, bidder)).toBeNull()
    expect(projector.getMarketplaceRefund(bidder)?.amountLux).toBe(70_000_000_000)

    projector.applyMarketplace({
      type: 'marketplace_refund_claimed',
      authority: bidder,
      recipient: 'dusk1bidder',
      amountLux: 70_000_000_000,
      claimedAtBlockHeight: 10_020,
    }, { txId: 'tx-refund', blockHeight: 10_020 })
    expect(projector.getMarketplaceRefund(bidder)).toBeNull()
  })
})

function registerAndEscrow(projector: ReturnType<typeof createLifecycleEventProjector>) {
  projector.apply({
    type: 'name_registered',
    node,
    label: 'aurora',
    actor: seller,
    owner: seller,
    expiresAt: '2028-07-05T00:00:00.000Z',
    graceEndsAt: '2028-08-05T00:00:00.000Z',
    feeLux: 10_000_000_000,
  })
  projector.apply({
    type: 'name_owner_changed',
    node,
    actor: seller,
    previousOwner: seller,
    owner: marketplace,
    manager: marketplace,
    resolver: marketplace,
    expiresAt: '2028-07-05T00:00:00.000Z',
  })
}
