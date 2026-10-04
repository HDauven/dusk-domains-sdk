import {
  isPauseRuntimeArgs,
  isMarketplaceAuctionNodeArgs,
  isMarketplaceFixedSaleArgs,
  isMarketplaceReviewedAuctionArgs,
  isMarketplaceSettleAuctionRuntimeArgs,
  isMarketplaceCancelOfferRuntimeArgs,
  isMarketplaceExpireOfferRuntimeArgs,

  isMarketplaceBuyFixedSaleRuntimeArgs,
  isMarketplaceClaimRefundRuntimeArgs,
  isMarketplaceInitArgs,
  isMarketplacePlaceBidRuntimeArgs,
  isMarketplacePlaceOfferRuntimeArgs,
  isMarketplaceSetFeeRuntimeArgs,
  isMarketplaceProposeOperatorRuntimeArgs,
} from './callArgGuards'
import { formatLux } from './callContextFormat'
import type { DuskDomainCallMetadata, DuskDomainDecodedContext } from './callTypes'

export function decodedMarketplaceDuskDomainContext(
  call: DuskDomainCallMetadata,
): DuskDomainDecodedContext | null {
  if (call.contract !== 'marketplace') return null
  if (call.functionName === 'set_trading_paused_runtime' && isPauseRuntimeArgs(call.args)) {
    return {
      title: call.args.paused ? 'Pause marketplace trading' : 'Resume marketplace trading',
      description: 'Claims, refunds, settlement and custody release remain available.',
      fields: [{ label: 'Paused', value: String(call.args.paused) }],
    }
  }

  if (call.functionName === 'init' && isMarketplaceInitArgs(call.args)) {
    return {
      title: 'Initialize marketplace',
      description: 'Configure marketplace contracts, operator and fee.',
      fields: [
        { label: 'Router', value: call.args.router },
        { label: 'Treasury contract', value: call.args.treasuryContract },
        { label: 'Operator', value: call.args.operator },
        { label: 'Fee', value: String(call.args.feeBps / 100) + '%' },
      ],
    }
  }
  if (call.functionName === 'set_fee_runtime' && isMarketplaceSetFeeRuntimeArgs(call.args)) {
    return {
      title: 'Update marketplace fee',
      description: 'Apply this fee to new sales, auctions and offers.',
      fields: [{ label: 'Fee', value: String(call.args.feeBps / 100) + '%' }],
    }
  }
  if (call.functionName === 'accept_operator_runtime') {
    return {
      title: 'Accept marketplace operator role',
      description: 'Accept the pending proposal using the proposed operator account.',
      fields: [],
    }
  }
  if (call.functionName === 'cancel_operator_runtime') {
    return {
      title: 'Cancel marketplace operator proposal',
      description: 'Keep the current operator and discard the pending proposal.',
      fields: [],
    }
  }

  if (call.functionName === 'propose_operator_runtime' && isMarketplaceProposeOperatorRuntimeArgs(call.args)) {
    return {
      title: 'Propose marketplace operator',
      description: 'The proposed operator must accept before gaining marketplace configuration authority.',
      fields: [{ label: 'New operator', value: call.args.operator }],
    }
  }
  if (call.functionName === 'buy_fixed_sale_runtime' && isMarketplaceBuyFixedSaleRuntimeArgs(call.args)) {
    return {
      title: 'Buy domain',
      description: 'Pay the listed price and receive the domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Sale ID', value: String(call.args.expectedSaleId) },
        { label: 'Price', value: formatLux(call.args.priceLux) + ' DUSK' },
        { label: 'Manager', value: call.args.buyerManager ?? 'Connected wallet' },
      ],
    }
  }
  if (call.functionName === 'place_bid_runtime' && isMarketplacePlaceBidRuntimeArgs(call.args)) {
    return {
      title: 'Place bid',
      description: 'Deposit this bid in the marketplace contract.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Auction ID', value: String(call.args.expectedAuctionId) },
        { label: 'Bid', value: formatLux(call.args.amountLux) + ' DUSK' },
        { label: 'Manager', value: call.args.bidderManager ?? 'Connected wallet' },
      ],
    }
  }
  if (call.functionName === 'place_offer_runtime' && isMarketplacePlaceOfferRuntimeArgs(call.args)) {
    return {
      title: 'Make offer',
      description: 'Deposit this offer until it is accepted, canceled or expires.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
        { label: 'Offer', value: formatLux(call.args.amountLux) + ' DUSK' },
        { label: 'Expires at block', value: String(call.args.expiresAt) },
      ],
    }
  }
  if (isMarketplaceExpireOfferRuntimeArgs(call.args) && call.functionName === 'expire_offer_runtime') {
    return {
      title: 'Expire offer',
      description: 'Close an expired offer and make its deposit refundable.',
      fields: [{ label: 'Domain reference', value: call.args.node }, { label: 'Offer ID', value: String(call.args.expectedOfferId) }],
    }
  }
  if (isMarketplaceAuctionNodeArgs(call.args)) {
    const contexts: Record<string, DuskDomainDecodedContext> = {
      cancel_fixed_sale_runtime: {
        title: 'Cancel sale',
        description: 'Return the domain from marketplace escrow.',
        fields: [{ label: 'Domain reference', value: call.args.node }],
      },
      expire_fixed_sale_runtime: {
        title: 'Close expired sale',
        description: 'Close this expired fixed-price sale.',
        fields: [{ label: 'Domain reference', value: call.args.node }],
      },
      cancel_auction_runtime: {
        title: 'Cancel auction',
        description: 'Cancel this auction before its first bid.',
        fields: [{ label: 'Domain reference', value: call.args.node }],
      },
      expire_auction_runtime: {
        title: 'Close dormant auction',
        description: 'Close an auction whose first-bid window expired.',
        fields: [{ label: 'Domain reference', value: call.args.node }],
      },
      settle_auction_runtime: {
        title: 'Settle auction',
        description: 'Transfer the domain and release the winning bid.',
        fields: [{ label: 'Domain reference', value: call.args.node }],
      },
      cancel_offer_runtime: {
        title: 'Cancel offer',
        description: 'Close your offer and make its deposit refundable.',
        fields: [{ label: 'Domain reference', value: call.args.node }],
      },
    }
    const context = contexts[call.functionName]
    if (context) {
      if (['cancel_fixed_sale_runtime', 'expire_fixed_sale_runtime'].includes(call.functionName) && isMarketplaceFixedSaleArgs(call.args)) {
        context.fields.push({ label: 'Sale ID', value: String(call.args.expectedSaleId) })
      } else if (['cancel_auction_runtime', 'expire_auction_runtime'].includes(call.functionName) && isMarketplaceReviewedAuctionArgs(call.args)) {
        context.fields.push({ label: 'Auction ID', value: String(call.args.expectedAuctionId) })
      } else if (call.functionName === 'settle_auction_runtime' && isMarketplaceSettleAuctionRuntimeArgs(call.args)) {
        context.fields.push({ label: 'Auction ID', value: String(call.args.expectedAuctionId) })
      } else if (call.functionName === 'cancel_offer_runtime' && isMarketplaceCancelOfferRuntimeArgs(call.args)) {
        context.fields.push({ label: 'Offer ID', value: String(call.args.expectedOfferId) })
      } else return null
      return context
    }
  }
  if (call.functionName === 'claim_refund_runtime' && isMarketplaceClaimRefundRuntimeArgs(call.args)) {
    return {
      title: 'Claim marketplace refund',
      description: 'Return your refundable DUSK to the connected account.',
      fields: [],
    }
  }
  return null
}
