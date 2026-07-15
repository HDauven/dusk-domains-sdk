import type { DuskDomainsResult } from '../client/sdkTypes'
import {
  marketplaceReadAuctionCall,
  marketplaceReadFixedSaleCall,
  marketplaceReadOfferCall,
  marketplaceReadRefundCall,
} from '../contracts/callBuilders'
import type { DuskDomainCallMetadata } from '../contracts/callTypes'
import { failure, success } from '../client/sdkResults'
import { unwrapReadOutput } from './sdkOnChainDecoders'

/** Canonical contract-read transport used by the marketplace read client. */
export type DuskDomainsMarketplaceReadTransport = {
  read: (call: DuskDomainCallMetadata) => Promise<unknown>
}

/** Canonical fixed-price sale stored by the marketplace contract. */
export type DuskDomainsOnChainFixedSale = {
  node: string
  name: string
  sellerAuthority: string
  priceLux: bigint
  privateBuyer: string | null
  expiresAtBlock: number
  domainExpiresAtBlock: number
}

/** Canonical highest bid stored inside an active auction. */
export type DuskDomainsOnChainAuctionBid = {
  bidderAuthority: string
  amountLux: bigint
  placedAtBlock: number
}

/** Canonical reserve auction stored by the marketplace contract. */
export type DuskDomainsOnChainAuction = {
  node: string
  name: string
  sellerAuthority: string
  reservePriceLux: bigint
  startBlock: number | null
  endBlock: number | null
  highestBid: DuskDomainsOnChainAuctionBid | null
  bidCount: number
}

/** Canonical domain offer stored by the marketplace contract. */
export type DuskDomainsOnChainOffer = {
  node: string
  buyerAuthority: string
  amountLux: bigint
  expiresAtBlock: number
}

/** Canonical aggregate pull-payment refund stored for one authority. */
export type DuskDomainsOnChainRefund = {
  authority: string
  amountLux: bigint
}

/** Exact-key marketplace reads used to verify indexer state before signing. */
export type DuskDomainsMarketplaceOnChainClient = {
  getFixedSale: (node: string) => Promise<DuskDomainsResult<DuskDomainsOnChainFixedSale | null>>
  getAuction: (node: string) => Promise<DuskDomainsResult<DuskDomainsOnChainAuction | null>>
  getOffer: (node: string, buyerAuthority: string) => Promise<DuskDomainsResult<DuskDomainsOnChainOffer | null>>
  getRefund: (authority: string) => Promise<DuskDomainsResult<DuskDomainsOnChainRefund | null>>
}

/** Creates a fail-closed canonical marketplace reader over a Dusk transport. */
export function createDuskDomainsMarketplaceOnChainClient(
  read: DuskDomainsMarketplaceReadTransport,
): DuskDomainsMarketplaceOnChainClient {
  return {
    getFixedSale: (node) => readOptional(read, marketplaceReadFixedSaleCall({ node }), 'sale', decodeFixedSale),
    getAuction: (node) => readOptional(read, marketplaceReadAuctionCall({ node }), 'auction', decodeAuction),
    getOffer: (node, buyerAuthority) => readOptional(
      read,
      marketplaceReadOfferCall({ node, buyerAuthority }),
      'offer',
      decodeOffer,
    ),
    getRefund: (authority) => readOptional(read, marketplaceReadRefundCall({ authority }), 'refund', decodeRefund),
  }
}

async function readOptional<T>(
  transport: DuskDomainsMarketplaceReadTransport,
  call: DuskDomainCallMetadata,
  key: string,
  decode: (value: Record<string, unknown>) => T,
): Promise<DuskDomainsResult<T | null>> {
  try {
    const response = record(unwrapReadOutput(await transport.read(call)), 'marketplace response')
    const value = response[key]
    return success(value == null ? null : decode(record(value, key)))
  } catch (error) {
    return failure('contract_read_failed', error instanceof Error ? error.message : String(error))
  }
}

function decodeFixedSale(value: Record<string, unknown>): DuskDomainsOnChainFixedSale {
  return {
    node: bytes32(value.node, 'sale node'),
    name: text(value.name, 'sale name'),
    sellerAuthority: bytes32(value.seller_authority, 'seller authority'),
    priceLux: u64(value.price_lux, 'sale price'),
    privateBuyer: value.private_buyer == null ? null : bytes32(value.private_buyer, 'private buyer'),
    expiresAtBlock: safeNumber(value.expires_at, 'sale expiry'),
    domainExpiresAtBlock: safeNumber(value.domain_expires_at, 'domain expiry'),
  }
}

function decodeAuction(value: Record<string, unknown>): DuskDomainsOnChainAuction {
  const bid = value.highest_bid == null ? null : record(value.highest_bid, 'highest bid')
  return {
    node: bytes32(value.node, 'auction node'),
    name: text(value.name, 'auction name'),
    sellerAuthority: bytes32(value.seller_authority, 'seller authority'),
    reservePriceLux: u64(value.reserve_price_lux, 'reserve price'),
    startBlock: nullableSafeNumber(value.start_block, 'auction start'),
    endBlock: nullableSafeNumber(value.end_block, 'auction end'),
    highestBid: bid ? {
      bidderAuthority: bytes32(bid.bidder_authority, 'bidder authority'),
      amountLux: u64(bid.amount_lux, 'bid amount'),
      placedAtBlock: safeNumber(bid.placed_at, 'bid block'),
    } : null,
    bidCount: safeNumber(value.bid_count, 'bid count'),
  }
}

function decodeOffer(value: Record<string, unknown>): DuskDomainsOnChainOffer {
  return {
    node: bytes32(value.node, 'offer node'),
    buyerAuthority: bytes32(value.buyer_authority, 'buyer authority'),
    amountLux: u64(value.amount_lux, 'offer amount'),
    expiresAtBlock: safeNumber(value.expires_at, 'offer expiry'),
  }
}

function decodeRefund(value: Record<string, unknown>): DuskDomainsOnChainRefund {
  return {
    authority: bytes32(value.authority, 'refund authority'),
    amountLux: u64(value.amount_lux, 'refund amount'),
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is malformed.`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is malformed.`)
  return value
}

function bytes32(value: unknown, label: string): string {
  if (typeof value === 'string' && /^0x[0-9a-f]{64}$/iu.test(value)) return value.toLowerCase()
  if (Array.isArray(value) && value.length === 32 && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return `0x${value.map((byte) => Number(byte).toString(16).padStart(2, '0')).join('')}`
  }
  throw new Error(`${label} is malformed.`)
}

function u64(value: unknown, label: string): bigint {
  try {
    const parsed = typeof value === 'bigint'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? BigInt(value)
        : typeof value === 'string' && /^\d+$/u.test(value)
          ? BigInt(value)
          : null
    if (parsed == null || parsed < 0n || parsed > 18_446_744_073_709_551_615n) throw new Error()
    return parsed
  } catch {
    throw new Error(`${label} is malformed.`)
  }
}

function safeNumber(value: unknown, label: string): number {
  const parsed = u64(value, label)
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the JavaScript safe range.`)
  return Number(parsed)
}

function nullableSafeNumber(value: unknown, label: string): number | null {
  return value == null ? null : safeNumber(value, label)
}
