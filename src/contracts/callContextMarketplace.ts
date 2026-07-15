import {
  isMarketplaceAuctionNodeArgs,
  isMarketplaceBuyFixedSaleRuntimeArgs,
  isMarketplaceClaimRefundRuntimeArgs,
  isMarketplaceInitArgs,
  isMarketplaceOfferArgs,
  isMarketplacePlaceBidRuntimeArgs,
  isMarketplacePlaceOfferRuntimeArgs,
  isMarketplaceSetFeeRuntimeArgs,
  isMarketplaceUpdateOperatorRuntimeArgs,
} from './callArgGuards'
import { formatLux } from './callContextFormat'
import type { DuskDomainCallMetadata, DuskDomainDecodedContext } from './callTypes'

export function decodedMarketplaceDuskDomainContext(
  call: DuskDomainCallMetadata,
): DuskDomainDecodedContext | null {
  if (call.contract !== 'marketplace') return null

  if (call.functionName === 'init' && isMarketplaceInitArgs(call.args)) {
    return {
      title: 'Initialize marketplace',
      description: 'Configure marketplace contracts, operator and fee.',
      fields: [
        { label: 'Core contract', value: call.args.coreContract },
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
  if (call.functionName === 'update_operator_runtime' && isMarketplaceUpdateOperatorRuntimeArgs(call.args)) {
    return {
      title: 'Update marketplace operator',
      description: 'Transfer marketplace configuration authority.',
      fields: [{ label: 'New operator', value: call.args.operator }],
    }
  }
  if (call.functionName === 'buy_fixed_sale_runtime' && isMarketplaceBuyFixedSaleRuntimeArgs(call.args)) {
    return {
      title: 'Buy domain',
      description: 'Pay the listed price and receive the domain.',
      fields: [
        { label: 'Domain reference', value: call.args.node },
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
  if (isMarketplaceOfferArgs(call.args) && call.functionName === 'expire_offer_runtime') {
    return {
      title: 'Expire offer',
      description: 'Close an expired offer and make its deposit refundable.',
      fields: [{ label: 'Domain reference', value: call.args.node }],
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
    if (contexts[call.functionName]) return contexts[call.functionName]
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
