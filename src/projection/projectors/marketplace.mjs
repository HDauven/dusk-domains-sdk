import { activityEntry } from '../activity.mjs'
import { normalizeNode } from '../keys.mjs'
import { assertSafeNumericTree, checkedSafeSum, safeNonNegativeInteger } from '../safe-numbers.mjs'

export function applyMarketplaceEvent(store, event, meta, fallbackTimestamp) {
  assertSafeNumericTree(event, 'marketplace event')
  assertSafeNumericTree(meta, 'marketplace event metadata')
  if (event.type === 'marketplace_initialized') {
    store.marketplaceConfig = {
      tradingPaused: false,
      initialized: true,
      router: normalizedHex(event.router),
      treasuryContract: normalizedHex(event.treasuryContract),
      marketplaceAuthority: normalizedHex(event.marketplaceAuthority),
      operator: normalizedHex(event.operator),
      pendingOperator: null,
      feeBps: Number(event.feeBps ?? 0),
      updatedAtBlockHeight: meta.blockHeight ?? null,
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
    }
    return { ...store.marketplaceConfig }
  }

  if (event.type === 'marketplace_operator_proposed' || event.type === 'marketplace_operator_cancelled' || event.type === 'marketplace_operator_changed') {
    const current = store.marketplaceConfig ?? emptyMarketplaceConfig()
    store.marketplaceConfig = {
      ...current,
      operator: event.type === 'marketplace_operator_changed' ? normalizedHex(event.operator) : current.operator,
      pendingOperator: event.type === 'marketplace_operator_proposed' ? normalizedHex(event.pendingOperator) : null,
      updatedAtBlockHeight: meta.blockHeight ?? null,
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
    }
    return { ...store.marketplaceConfig }
  }

  if (event.type === 'trading_paused_changed') {
    store.marketplaceConfig = {
      ...emptyMarketplaceConfig(),
      ...store.marketplaceConfig,
      tradingPaused: event.paused,
      updatedAtBlockHeight: event.updatedAtBlockHeight,
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
    }
    return { ...store.marketplaceConfig }
  }

  if (event.type === 'marketplace_config_updated') {
    store.marketplaceConfig = {
      ...emptyMarketplaceConfig(),
      ...store.marketplaceConfig,
      initialized: true,
      operator: normalizedHex(event.operator),
      feeBps: Number(event.feeBps ?? 0),
      updatedAtBlockHeight: numberOrNull(event.updatedAtBlockHeight),
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
    }
    return { ...store.marketplaceConfig }
  }

  if (event.type === 'marketplace_refund_claimed') {
    store.marketplaceRefundsByAuthority.delete(normalizedHex(event.authority))
    return null
  }

  const node = normalizeNode(event.node)
  const name = event.name
    ?? store.marketplaceFixedSalesByNode.get(node)?.name
    ?? store.marketplaceAuctionsByNode.get(node)?.name
    ?? store.namesByNode.get(node)?.canonicalName
    ?? node
  const entry = activityEntry({
    eventType: event.type,
    node,
    name,
    actor: marketplaceActor(event),
    target: marketplaceTarget(event),
    timestamp: fallbackTimestamp,
    meta,
  })
  const finish = (result) => {
    store.activityByNode.set(node, [entry, ...(store.activityByNode.get(node) ?? [])])
    return result
  }

  const buyer = event.type === 'domain_auction_settled' && !event.domainExpired ? event.winnerAuthority
    : ['domain_fixed_sale_filled', 'domain_offer_accepted'].includes(event.type) ? event.buyerAuthority : null
  if (buyer && store.namesByNode.has(node)) {
    const current = store.namesByNode.get(node)
    store.namesByNode.set(node, {
      ...current, namespacePurchase: { seller: normalizedHex(event.sellerAuthority), buyer: normalizedHex(buyer) },
    })
  }

  if (event.type === 'domain_fixed_sale_opened') {
    const marketplaceContractId = normalizedHex(meta.contractId)
    store.marketplaceFixedSalesByNode.set(node, {
      node,
      name: event.name,
      sellerAuthority: normalizedHex(event.sellerAuthority),
      priceLux: Number(event.priceLux ?? 0),
      privateBuyer: normalizedHex(event.privateBuyer),
      feeBps: Number(event.feeBps ?? 0),
      expiresAtBlockHeight: Number(event.expiresAtBlockHeight ?? 0),
      openedAtBlockHeight: Number(event.openedAtBlockHeight ?? 0),
      marketplaceContractId,
      escrowed: marketplaceOrderIsEscrowed(store.namesByNode.get(node), marketplaceContractId),
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
      lastEventType: event.type,
    })
    return finish(store.marketplaceFixedSalesByNode.get(node))
  }

  if (event.type === 'domain_fixed_sale_closed' || event.type === 'domain_fixed_sale_filled') {
    store.marketplaceFixedSalesByNode.delete(node)
    return finish(null)
  }

  if (event.type === 'domain_auction_created') {
    const marketplaceContractId = normalizedHex(meta.contractId)
    store.marketplaceAuctionsByNode.set(node, {
      node,
      name: event.name,
      sellerAuthority: normalizedHex(event.sellerAuthority),
      reservePriceLux: Number(event.reservePriceLux ?? 0),
      durationBlocks: Number(event.durationBlocks ?? 0),
      startDeadlineBlockHeight: Number(event.startDeadlineBlockHeight ?? 0),
      feeBps: Number(event.feeBps ?? 0),
      startBlockHeight: null,
      endBlockHeight: null,
      highestBid: null,
      bidCount: 0,
      createdAtBlockHeight: Number(event.createdAtBlockHeight ?? 0),
      marketplaceContractId,
      escrowed: marketplaceOrderIsEscrowed(store.namesByNode.get(node), marketplaceContractId),
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
      lastEventType: event.type,
    })
    return finish(store.marketplaceAuctionsByNode.get(node))
  }

  if (event.type === 'domain_bid_placed') {
    const current = store.marketplaceAuctionsByNode.get(node)
    if (!current) return finish(null)
    if (event.previousBidderAuthority && Number(event.previousBidLux ?? 0) > 0) {
      creditRefund(store, event.previousBidderAuthority, Number(event.previousBidLux), event.type, meta)
    }
    store.marketplaceAuctionsByNode.set(node, {
      ...current,
      startBlockHeight: Number(event.startBlock ?? 0),
      endBlockHeight: Number(event.endBlock ?? 0),
      highestBid: {
        bidderAuthority: normalizedHex(event.bidderAuthority),
        amountLux: Number(event.amountLux ?? 0),
        placedAtBlockHeight: Number(event.placedAtBlockHeight ?? 0),
      },
      bidCount: Number(event.bidCount ?? 0),
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
      lastEventType: event.type,
    })
    return finish(store.marketplaceAuctionsByNode.get(node))
  }

  if (event.type === 'domain_auction_cancelled' || event.type === 'domain_auction_settled') {
    const current = store.marketplaceAuctionsByNode.get(node)
    if (event.type === 'domain_auction_settled' && event.domainExpired && current?.highestBid) {
      creditRefund(store, current.highestBid.bidderAuthority, current.highestBid.amountLux, event.type, meta)
    }
    store.marketplaceAuctionsByNode.delete(node)
    return finish(null)
  }

  const buyerAuthority = normalizedHex(event.buyerAuthority)
  const offerKey = marketplaceOfferKey(node, buyerAuthority)
  if (event.type === 'domain_offer_placed') {
    store.marketplaceOffersByKey.set(offerKey, {
      node,
      name,
      buyerAuthority,
      amountLux: Number(event.amountLux ?? 0),
      feeBps: Number(event.feeBps ?? 0),
      expiresAtBlockHeight: Number(event.expiresAtBlockHeight ?? 0),
      placedAtBlockHeight: Number(event.placedAtBlockHeight ?? 0),
      txId: meta.txId ?? null,
      blockHeight: meta.blockHeight ?? null,
      lastEventType: event.type,
    })
    return finish(store.marketplaceOffersByKey.get(offerKey))
  }

  if (event.type === 'domain_offer_closed') {
    creditRefund(store, buyerAuthority, Number(event.amountLux ?? 0), event.type, meta)
    store.marketplaceOffersByKey.delete(offerKey)
    return finish(null)
  }

  store.marketplaceOffersByKey.delete(offerKey)
  return finish(null)
}

export function emptyMarketplaceConfig() {
  return {
    tradingPaused: false,
    initialized: false,
    router: null,
    treasuryContract: null,
    marketplaceAuthority: null,
    operator: null,
    pendingOperator: null,
    feeBps: 0,
    updatedAtBlockHeight: null,
    txId: null,
    blockHeight: null,
  }
}

export function marketplaceOfferKey(node, buyerAuthority) {
  return `${normalizeNode(node)}:${normalizedHex(buyerAuthority)}`
}

function creditRefund(store, authorityValue, amountLux, eventType, meta) {
  const authority = normalizedHex(authorityValue)
  const current = store.marketplaceRefundsByAuthority.get(authority)
  const nextAmount = checkedSafeSum(current?.amountLux ?? 0, amountLux, 'marketplace refund balance')
  store.marketplaceRefundsByAuthority.set(authority, {
    authority,
    recipient: current?.recipient ?? null,
    amountLux: nextAmount,
    txId: meta.txId ?? null,
    blockHeight: meta.blockHeight ?? null,
    lastEventType: eventType,
  })
}

function marketplaceActor(event) {
  if (event.type === 'domain_bid_placed') return normalizedHex(event.bidderAuthority)
  if (event.type === 'domain_offer_placed' || event.type === 'domain_offer_closed') {
    return normalizedHex(event.buyerAuthority)
  }
  return normalizedHex(event.sellerAuthority) ?? 'marketplace'
}

function marketplaceTarget(event) {
  if (event.type === 'domain_fixed_sale_opened') return String(event.priceLux ?? 0)
  if (event.type === 'domain_fixed_sale_filled') return String(event.grossAmountLux ?? 0)
  if (event.type === 'domain_auction_created') return String(event.reservePriceLux ?? 0)
  if (event.type === 'domain_bid_placed') return String(event.amountLux ?? 0)
  if (event.type === 'domain_auction_settled') return String(event.grossAmountLux ?? 0)
  if (event.type === 'domain_offer_placed' || event.type === 'domain_offer_closed') return String(event.amountLux ?? 0)
  if (event.type === 'domain_offer_accepted') return String(event.grossAmountLux ?? 0)
  return event.expired ? 'expired' : 'cancelled'
}

export function marketplaceOrderIsEscrowed(name, marketplaceContractId) {
  if (!name || !marketplaceContractId) return false
  return sameHex(name.owner, marketplaceContractId) && sameHex(name.manager, marketplaceContractId)
}

function sameHex(left, right) {
  if (!left || !right) return false
  return stripHexPrefix(left) === stripHexPrefix(right)
}

function normalizedHex(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  return normalizeNode(value)
}

function stripHexPrefix(value) {
  return String(value).trim().toLowerCase().replace(/^0x/, '')
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null
  return safeNonNegativeInteger(value, 'marketplace value')
}
