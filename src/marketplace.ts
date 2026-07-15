/**
 * Typed call builders, indexed models and protocol constants for the Dusk
 * Domains marketplace.
 *
 * The builders produce transport-neutral call metadata. Applications still
 * choose how to read, prepare and submit calls through Dusk tooling.
 *
 * @module
 */

import {
  coreAcceptMarketplaceOfferRuntimeCall as coreAcceptMarketplaceOfferRuntimeCallImpl,
  coreEscrowAuctionRuntimeCall as coreEscrowAuctionRuntimeCallImpl,
  coreEscrowFixedSaleRuntimeCall as coreEscrowFixedSaleRuntimeCallImpl,
  marketplaceBuyFixedSaleRuntimeCall as marketplaceBuyFixedSaleRuntimeCallImpl,
  marketplaceCancelAuctionRuntimeCall as marketplaceCancelAuctionRuntimeCallImpl,
  marketplaceCancelFixedSaleRuntimeCall as marketplaceCancelFixedSaleRuntimeCallImpl,
  marketplaceCancelOfferRuntimeCall as marketplaceCancelOfferRuntimeCallImpl,
  marketplaceClaimRefundRuntimeCall as marketplaceClaimRefundRuntimeCallImpl,
  marketplaceExpireAuctionRuntimeCall as marketplaceExpireAuctionRuntimeCallImpl,
  marketplaceExpireFixedSaleRuntimeCall as marketplaceExpireFixedSaleRuntimeCallImpl,
  marketplaceExpireOfferRuntimeCall as marketplaceExpireOfferRuntimeCallImpl,
  marketplacePlaceBidRuntimeCall as marketplacePlaceBidRuntimeCallImpl,
  marketplacePlaceOfferRuntimeCall as marketplacePlaceOfferRuntimeCallImpl,
  marketplaceReadAuctionCall as marketplaceReadAuctionCallImpl,
  marketplaceReadConfigCall as marketplaceReadConfigCallImpl,
  marketplaceReadFixedSaleCall as marketplaceReadFixedSaleCallImpl,
  marketplaceReadOfferCall as marketplaceReadOfferCallImpl,
  marketplaceReadRefundCall as marketplaceReadRefundCallImpl,
  marketplaceSettleAuctionRuntimeCall as marketplaceSettleAuctionRuntimeCallImpl,
} from './contracts/callBuilders'
import type {
  CoreAcceptMarketplaceOfferRuntimeArgs as CoreAcceptMarketplaceOfferRuntimeArgsType,
  CoreEscrowAuctionRuntimeArgs as CoreEscrowAuctionRuntimeArgsType,
  CoreEscrowFixedSaleRuntimeArgs as CoreEscrowFixedSaleRuntimeArgsType,
  MarketplaceAuctionNodeArgs as MarketplaceAuctionNodeArgsType,
  MarketplaceBuyFixedSaleRuntimeArgs as MarketplaceBuyFixedSaleRuntimeArgsType,
  MarketplaceOfferArgs as MarketplaceOfferArgsType,
  MarketplacePlaceBidRuntimeArgs as MarketplacePlaceBidRuntimeArgsType,
  MarketplacePlaceOfferRuntimeArgs as MarketplacePlaceOfferRuntimeArgsType,
  MarketplaceReadRefundArgs as MarketplaceReadRefundArgsType,
} from './contracts/callTypes'
import type {
  IndexedMarketplaceAuction as IndexedMarketplaceAuctionType,
  IndexedMarketplaceBid as IndexedMarketplaceBidType,
  IndexedMarketplaceConfig as IndexedMarketplaceConfigType,
  IndexedMarketplaceFixedSale as IndexedMarketplaceFixedSaleType,
  IndexedMarketplaceOffer as IndexedMarketplaceOfferType,
  IndexedMarketplaceRefund as IndexedMarketplaceRefundType,
} from './indexer/indexerStateTypes'

export {
  createDuskDomainsMarketplaceOnChainClient,
  type DuskDomainsMarketplaceOnChainClient,
  type DuskDomainsMarketplaceReadTransport,
  type DuskDomainsOnChainAuction,
  type DuskDomainsOnChainAuctionBid,
  type DuskDomainsOnChainFixedSale,
  type DuskDomainsOnChainOffer,
  type DuskDomainsOnChainRefund,
} from './onchain/marketplaceOnChain'

/** One DUSK, the minimum fixed price, auction reserve and offer value. */
export const MARKETPLACE_MIN_AMOUNT_LUX = 1_000_000_000n

/**
 * Largest exact Lux amount accepted by the JavaScript write builders.
 *
 * The contracts use `u64`, but contract-call JSON must not silently round an
 * integer. Applications needing larger orders must use a future bigint-safe
 * transport rather than coercing the value to `number`.
 */
export const MARKETPLACE_MAX_CLIENT_AMOUNT_LUX: bigint = BigInt(Number.MAX_SAFE_INTEGER)

/** Minimum increase over the current highest bid, in basis points. */
export const MARKETPLACE_MIN_BID_INCREMENT_BPS = 500

/** Blocks in the late-bid extension window at the ten-second protocol cadence. */
export const MARKETPLACE_ANTI_SNIPING_BLOCKS = 60

/** Maximum cumulative late-bid extension, in blocks. */
export const MARKETPLACE_MAX_EXTENSION_BLOCKS = 60_480

/** Highest marketplace fee accepted by the contract, in basis points. */
export const MARKETPLACE_MAX_FEE_BPS = 1_000

/** Creates one core call that escrows a domain and opens a fixed-price sale. */
export const coreEscrowFixedSaleRuntimeCall: typeof coreEscrowFixedSaleRuntimeCallImpl =
  coreEscrowFixedSaleRuntimeCallImpl

/** Creates one core call that escrows a domain and opens a reserve auction. */
export const coreEscrowAuctionRuntimeCall: typeof coreEscrowAuctionRuntimeCallImpl =
  coreEscrowAuctionRuntimeCallImpl

/** Creates one core call that accepts an offer and transfers the domain. */
export const coreAcceptMarketplaceOfferRuntimeCall: typeof coreAcceptMarketplaceOfferRuntimeCallImpl =
  coreAcceptMarketplaceOfferRuntimeCallImpl

/** Creates a paid call that fills a fixed-price sale. */
export const marketplaceBuyFixedSaleRuntimeCall: typeof marketplaceBuyFixedSaleRuntimeCallImpl =
  marketplaceBuyFixedSaleRuntimeCallImpl

/** Creates a seller-authorized call that cancels an unfilled fixed-price sale. */
export const marketplaceCancelFixedSaleRuntimeCall: typeof marketplaceCancelFixedSaleRuntimeCallImpl =
  marketplaceCancelFixedSaleRuntimeCallImpl

/** Creates a permissionless call that closes an expired fixed-price sale. */
export const marketplaceExpireFixedSaleRuntimeCall: typeof marketplaceExpireFixedSaleRuntimeCallImpl =
  marketplaceExpireFixedSaleRuntimeCallImpl

/** Creates a paid bid call for a live or dormant reserve auction. */
export const marketplacePlaceBidRuntimeCall: typeof marketplacePlaceBidRuntimeCallImpl =
  marketplacePlaceBidRuntimeCallImpl

/** Creates a seller-authorized call that cancels an auction before its first bid. */
export const marketplaceCancelAuctionRuntimeCall: typeof marketplaceCancelAuctionRuntimeCallImpl =
  marketplaceCancelAuctionRuntimeCallImpl

/** Creates a permissionless call that closes a dormant expired auction. */
export const marketplaceExpireAuctionRuntimeCall: typeof marketplaceExpireAuctionRuntimeCallImpl =
  marketplaceExpireAuctionRuntimeCallImpl

/** Creates a permissionless call that settles an ended auction. */
export const marketplaceSettleAuctionRuntimeCall: typeof marketplaceSettleAuctionRuntimeCallImpl =
  marketplaceSettleAuctionRuntimeCallImpl

/** Creates a paid offer call for a registered domain. */
export const marketplacePlaceOfferRuntimeCall: typeof marketplacePlaceOfferRuntimeCallImpl =
  marketplacePlaceOfferRuntimeCallImpl

/** Creates a buyer-authorized call that cancels an active offer. */
export const marketplaceCancelOfferRuntimeCall: typeof marketplaceCancelOfferRuntimeCallImpl =
  marketplaceCancelOfferRuntimeCallImpl

/** Creates a permissionless call that closes an expired offer. */
export const marketplaceExpireOfferRuntimeCall: typeof marketplaceExpireOfferRuntimeCallImpl =
  marketplaceExpireOfferRuntimeCallImpl

/** Creates a call that claims all refunds belonging to the connected authority. */
export const marketplaceClaimRefundRuntimeCall: typeof marketplaceClaimRefundRuntimeCallImpl =
  marketplaceClaimRefundRuntimeCallImpl

/** Creates a canonical marketplace configuration read. */
export const marketplaceReadConfigCall: typeof marketplaceReadConfigCallImpl = marketplaceReadConfigCallImpl

/** Creates a fixed-price sale read by domain node. */
export const marketplaceReadFixedSaleCall: typeof marketplaceReadFixedSaleCallImpl = marketplaceReadFixedSaleCallImpl

/** Creates an auction read by domain node. */
export const marketplaceReadAuctionCall: typeof marketplaceReadAuctionCallImpl = marketplaceReadAuctionCallImpl

/** Creates an offer read by domain node and buyer authority. */
export const marketplaceReadOfferCall: typeof marketplaceReadOfferCallImpl = marketplaceReadOfferCallImpl

/** Creates an aggregate refund read by authority. */
export const marketplaceReadRefundCall: typeof marketplaceReadRefundCallImpl = marketplaceReadRefundCallImpl

/** Arguments for opening a fixed-price sale through the core contract. */
export type CoreEscrowFixedSaleRuntimeArgs = CoreEscrowFixedSaleRuntimeArgsType

/** Arguments for opening a reserve auction through the core contract. */
export type CoreEscrowAuctionRuntimeArgs = CoreEscrowAuctionRuntimeArgsType

/** Arguments for accepting an offer through the core contract. */
export type CoreAcceptMarketplaceOfferRuntimeArgs = CoreAcceptMarketplaceOfferRuntimeArgsType

/** Arguments for filling a fixed-price sale. */
export type MarketplaceBuyFixedSaleRuntimeArgs = MarketplaceBuyFixedSaleRuntimeArgsType

/** Domain-node arguments shared by order actions. */
export type MarketplaceAuctionNodeArgs = MarketplaceAuctionNodeArgsType

/** Arguments for placing an auction bid. */
export type MarketplacePlaceBidRuntimeArgs = MarketplacePlaceBidRuntimeArgsType

/** Arguments for placing a domain offer. */
export type MarketplacePlaceOfferRuntimeArgs = MarketplacePlaceOfferRuntimeArgsType

/** Domain and buyer-authority arguments identifying an offer. */
export type MarketplaceOfferArgs = MarketplaceOfferArgsType

/** Arguments for reading an authority's aggregate refund. */
export type MarketplaceReadRefundArgs = MarketplaceReadRefundArgsType

/** Marketplace configuration projected by an indexer. */
export type IndexedMarketplaceConfig = IndexedMarketplaceConfigType

/** Active fixed-price sale projected by an indexer. */
export type IndexedMarketplaceFixedSale = IndexedMarketplaceFixedSaleType

/** Highest-bid data projected by an indexer. */
export type IndexedMarketplaceBid = IndexedMarketplaceBidType

/** Active reserve auction projected by an indexer. */
export type IndexedMarketplaceAuction = IndexedMarketplaceAuctionType

/** Active domain offer projected by an indexer. */
export type IndexedMarketplaceOffer = IndexedMarketplaceOfferType

/** Aggregate claimable refund projected by an indexer. */
export type IndexedMarketplaceRefund = IndexedMarketplaceRefundType
