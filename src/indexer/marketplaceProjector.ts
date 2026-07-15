import { createActivityEntry, type ActivityEntry } from './activity'
import type {
  IndexedLifecycleName,
  IndexedMarketplaceAuction,
  IndexedMarketplaceConfig,
  IndexedMarketplaceFixedSale,
  IndexedMarketplaceOffer,
  IndexedMarketplaceRefund,
  IndexerEventMeta,
  MarketplaceEvent,
} from './indexerTypes'

type MarketplaceProjectorOptions = {
  getName: (node: string) => IndexedLifecycleName | undefined
  addActivity: (node: string, entry: ActivityEntry) => void
}

export function createMarketplaceProjector(options: MarketplaceProjectorOptions) {
  const fixedSales = new Map<string, IndexedMarketplaceFixedSale>()
  const auctions = new Map<string, IndexedMarketplaceAuction>()
  const offers = new Map<string, IndexedMarketplaceOffer>()
  const refunds = new Map<string, IndexedMarketplaceRefund>()
  let config: IndexedMarketplaceConfig = emptyMarketplaceConfig()

  function apply(event: MarketplaceEvent, meta: IndexerEventMeta = {}) {
    assertSafeNumericTree(event, 'marketplace event')
    assertSafeNumericTree(meta, 'marketplace event metadata')
    if (event.type === 'marketplace_initialized') {
      config = {
        initialized: true,
        coreContract: event.coreContract,
        treasuryContract: event.treasuryContract,
        marketplaceAuthority: event.marketplaceAuthority,
        operator: event.operator,
        feeBps: event.feeBps,
        updatedAtBlockHeight: meta.blockHeight ?? null,
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
      }
      return { ...config }
    }

    if (event.type === 'marketplace_config_updated') {
      config = {
        ...config,
        initialized: true,
        operator: event.operator,
        feeBps: event.feeBps,
        updatedAtBlockHeight: event.updatedAtBlockHeight,
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
      }
      return { ...config }
    }

    if (event.type === 'marketplace_refund_claimed') {
      refunds.delete(authorityKey(event.authority))
      return null
    }

    const currentName = options.getName(event.node)
    const knownName = 'name' in event
      ? event.name
      : fixedSales.get(event.node)?.name
        ?? auctions.get(event.node)?.name
        ?? currentName?.canonicalName
        ?? event.node
    const entry = createActivityEntry({
      eventType: event.type,
      node: event.node,
      name: knownName,
      actor: marketplaceActor(event),
      target: marketplaceTarget(event),
      txId: meta.txId,
      blockHeight: meta.blockHeight ?? null,
    })

    if (event.type === 'domain_fixed_sale_opened') {
      const sale: IndexedMarketplaceFixedSale = {
        node: event.node,
        name: event.name,
        sellerAuthority: event.sellerAuthority,
        priceLux: event.priceLux,
        privateBuyer: event.privateBuyer,
        feeBps: event.feeBps,
        expiresAtBlockHeight: event.expiresAtBlockHeight,
        openedAtBlockHeight: event.openedAtBlockHeight,
        marketplaceContractId: meta.contractId ?? null,
        escrowed: isEscrowed(currentName, meta.contractId ?? null),
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
        lastEventType: event.type,
      }
      fixedSales.set(event.node, sale)
      options.addActivity(event.node, entry)
      return sale
    }

    if (event.type === 'domain_fixed_sale_closed' || event.type === 'domain_fixed_sale_filled') {
      fixedSales.delete(event.node)
      options.addActivity(event.node, entry)
      return null
    }

    if (event.type === 'domain_auction_created') {
      const auction: IndexedMarketplaceAuction = {
        node: event.node,
        name: event.name,
        sellerAuthority: event.sellerAuthority,
        reservePriceLux: event.reservePriceLux,
        durationBlocks: event.durationBlocks,
        startDeadlineBlockHeight: event.startDeadlineBlockHeight,
        feeBps: event.feeBps,
        startBlockHeight: null,
        endBlockHeight: null,
        highestBid: null,
        bidCount: 0,
        createdAtBlockHeight: event.createdAtBlockHeight,
        marketplaceContractId: meta.contractId ?? null,
        escrowed: isEscrowed(currentName, meta.contractId ?? null),
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
        lastEventType: event.type,
      }
      auctions.set(event.node, auction)
      options.addActivity(event.node, entry)
      return auction
    }

    if (event.type === 'domain_bid_placed') {
      const current = auctions.get(event.node)
      if (!current) return null
      if (event.previousBidderAuthority && event.previousBidLux > 0) {
        creditRefund(event.previousBidderAuthority, event.previousBidLux, event.type, meta)
      }
      const auction: IndexedMarketplaceAuction = {
        ...current,
        startBlockHeight: event.startBlock,
        endBlockHeight: event.endBlock,
        highestBid: {
          bidderAuthority: event.bidderAuthority,
          amountLux: event.amountLux,
          placedAtBlockHeight: event.placedAtBlockHeight,
        },
        bidCount: event.bidCount,
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
        lastEventType: event.type,
      }
      auctions.set(event.node, auction)
      options.addActivity(event.node, entry)
      return auction
    }

    if (event.type === 'domain_auction_cancelled' || event.type === 'domain_auction_settled') {
      const current = auctions.get(event.node)
      if (event.type === 'domain_auction_settled' && event.domainExpired && current?.highestBid) {
        creditRefund(current.highestBid.bidderAuthority, current.highestBid.amountLux, event.type, meta)
      }
      auctions.delete(event.node)
      options.addActivity(event.node, entry)
      return null
    }

    const offerKey = marketplaceOfferKey(event.node, event.buyerAuthority)
    if (event.type === 'domain_offer_placed') {
      const offer: IndexedMarketplaceOffer = {
        node: event.node,
        name: currentName?.canonicalName ?? event.node,
        buyerAuthority: event.buyerAuthority,
        amountLux: event.amountLux,
        feeBps: event.feeBps,
        expiresAtBlockHeight: event.expiresAtBlockHeight,
        placedAtBlockHeight: event.placedAtBlockHeight,
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
        lastEventType: event.type,
      }
      offers.set(offerKey, offer)
      options.addActivity(event.node, entry)
      return offer
    }

    if (event.type === 'domain_offer_closed') {
      offers.delete(offerKey)
      creditRefund(event.buyerAuthority, event.amountLux, event.type, meta)
      options.addActivity(event.node, entry)
      return null
    }

    offers.delete(offerKey)
    options.addActivity(event.node, entry)
    return null
  }

  function creditRefund(
    authority: string,
    amountLux: number,
    lastEventType: MarketplaceEvent['type'],
    meta: IndexerEventMeta,
  ) {
    const key = authorityKey(authority)
    const current = refunds.get(key)
    const amount = checkedSafeSum(current?.amountLux ?? 0, amountLux, 'marketplace refund balance')
    refunds.set(key, {
      authority,
      recipient: current?.recipient ?? null,
      amountLux: amount,
      lastEventType,
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
    })
  }

  function currentEscrow<T extends { node: string; marketplaceContractId: string | null }>(value: T): T & { escrowed: boolean } {
    return {
      ...value,
      escrowed: isEscrowed(options.getName(value.node), value.marketplaceContractId),
    }
  }

  return {
    apply,
    getConfig: () => ({ ...config }),
    getFixedSaleByNode: (node: string) => fixedSales.has(node) ? currentEscrow(fixedSales.get(node)!) : null,
    getFixedSales: () => [...fixedSales.values()].map(currentEscrow),
    getAuctionByNode: (node: string) => auctions.has(node) ? currentEscrow(auctions.get(node)!) : null,
    getAuctions: () => [...auctions.values()].map(currentEscrow),
    getOffer: (node: string, buyerAuthority: string) => offers.get(marketplaceOfferKey(node, buyerAuthority)) ?? null,
    getOffers: (filters: { node?: string; buyerAuthority?: string } = {}) => [...offers.values()].filter((offer) => (
      (!filters.node || offer.node === filters.node)
      && (!filters.buyerAuthority || authorityKey(offer.buyerAuthority) === authorityKey(filters.buyerAuthority))
    )),
    getRefund: (authority: string) => refunds.get(authorityKey(authority)) ?? null,
  }
}

export function marketplaceOfferKey(node: string, buyerAuthority: string) {
  return `${node.trim().toLowerCase()}:${authorityKey(buyerAuthority)}`
}

function emptyMarketplaceConfig(): IndexedMarketplaceConfig {
  return {
    initialized: false,
    coreContract: null,
    treasuryContract: null,
    marketplaceAuthority: null,
    operator: null,
    feeBps: 0,
    updatedAtBlockHeight: null,
    txId: null,
    blockHeight: null,
  }
}

function isEscrowed(name: IndexedLifecycleName | undefined, marketplaceContractId: string | null) {
  if (!name || !marketplaceContractId) return false
  return authorityKey(name.owner ?? '') === authorityKey(marketplaceContractId)
    && authorityKey(name.manager ?? '') === authorityKey(marketplaceContractId)
}

function authorityKey(value: string) {
  return value.trim().toLowerCase().replace(/^0x/, '')
}

function checkedSafeSum(left: number, right: number, label: string) {
  const result = left + right
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} exceeds the JavaScript safe integer range.`)
  }
  return result
}

function assertSafeNumericTree(value: unknown, label: string, key = ''): void {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} contains an unsafe numeric value.`)
    }
    return
  }
  if (typeof value === 'string') {
    if (numericField(key) && /^\d+$/u.test(value)) {
      if (BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`${label} contains an unsafe numeric value.`)
      }
      throw new Error(`${label} contains a string where a numeric value is required.`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeNumericTree(item, label, key))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, item]) => assertSafeNumericTree(item, label, childKey))
  }
}

function numericField(key: string) {
  return /(?:Lux|Bps|At|Block|Blocks|Height|Count|Seconds|Years)$/u.test(key)
}

function marketplaceActor(event: Exclude<MarketplaceEvent, { type: 'marketplace_initialized' | 'marketplace_config_updated' | 'marketplace_refund_claimed' }>) {
  if (event.type === 'domain_bid_placed') return event.bidderAuthority
  if (event.type === 'domain_offer_placed' || event.type === 'domain_offer_closed') return event.buyerAuthority
  return event.sellerAuthority
}

function marketplaceTarget(event: Exclude<MarketplaceEvent, { type: 'marketplace_initialized' | 'marketplace_config_updated' | 'marketplace_refund_claimed' }>) {
  if (event.type === 'domain_fixed_sale_opened') return `${event.priceLux}`
  if (event.type === 'domain_fixed_sale_filled') return `${event.grossAmountLux}`
  if (event.type === 'domain_auction_created') return `${event.reservePriceLux}`
  if (event.type === 'domain_bid_placed') return `${event.amountLux}`
  if (event.type === 'domain_auction_settled') return `${event.grossAmountLux}`
  if (event.type === 'domain_offer_placed' || event.type === 'domain_offer_closed') return `${event.amountLux}`
  if (event.type === 'domain_offer_accepted') return `${event.grossAmountLux}`
  return event.expired ? 'expired' : 'cancelled'
}
