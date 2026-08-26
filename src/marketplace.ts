/**
 * Typed call builders, indexed models and protocol constants for the Dusk
 * Domains marketplace.
 *
 * @module
 */

export {
  coreAcceptMarketplaceOfferRuntimeCall,
  coreEscrowAuctionRuntimeCall,
  coreEscrowFixedSaleRuntimeCall,
  marketplaceBuyFixedSaleRuntimeCall,
  marketplaceCancelAuctionRuntimeCall,
  marketplaceCancelFixedSaleRuntimeCall,
  marketplaceCancelOfferRuntimeCall,
  marketplaceClaimRefundRuntimeCall,
  marketplaceExpireAuctionRuntimeCall,
  marketplaceExpireFixedSaleRuntimeCall,
  marketplaceExpireOfferRuntimeCall,
  marketplacePlaceBidRuntimeCall,
  marketplacePlaceOfferRuntimeCall,
  marketplaceReadAuctionCall,
  marketplaceReadConfigCall,
  marketplaceReadFixedSaleCall,
  marketplaceReadOfferCall,
  marketplaceReadRefundCall,
  marketplaceSettleAuctionRuntimeCall,
} from './contracts/callBuilders'

export type {
  CoreAcceptMarketplaceOfferRuntimeArgs,
  CoreEscrowAuctionRuntimeArgs,
  CoreEscrowFixedSaleRuntimeArgs,
  MarketplaceAuctionNodeArgs,
  MarketplaceBuyFixedSaleRuntimeArgs,
  MarketplaceOfferArgs,
  MarketplacePlaceBidRuntimeArgs,
  MarketplacePlaceOfferRuntimeArgs,
  MarketplaceReadRefundArgs,
} from './contracts/callTypes'

export type {
  IndexedMarketplaceAuction,
  IndexedMarketplaceBid,
  IndexedMarketplaceConfig,
  IndexedMarketplaceFixedSale,
  IndexedMarketplaceOffer,
  IndexedMarketplaceRefund,
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

/** Largest exact Lux amount accepted by JavaScript write builders. */
export const MARKETPLACE_MAX_CLIENT_AMOUNT_LUX: bigint = BigInt(Number.MAX_SAFE_INTEGER)

/** Minimum increase over the current highest bid, in basis points. */
export const MARKETPLACE_MIN_BID_INCREMENT_BPS = 500

/** Blocks in the late-bid extension window. */
export const MARKETPLACE_ANTI_SNIPING_BLOCKS = 60

/** Maximum cumulative late-bid extension, in blocks. */
export const MARKETPLACE_MAX_EXTENSION_BLOCKS = 60_480

/** Highest marketplace fee accepted by the contract, in basis points. */
export const MARKETPLACE_MAX_FEE_BPS = 1_000
