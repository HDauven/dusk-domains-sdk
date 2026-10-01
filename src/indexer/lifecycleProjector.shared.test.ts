import { describe, expect, it } from 'vitest'
import { createLifecycleEventProjector } from './indexer'
import type { NameLifecycleEvent, MarketplaceEvent, ReferralEvent, TreasuryEvent } from './indexerTypes'

const node = `0x${'aa'.repeat(32)}`
const owner = `0x${'bb'.repeat(32)}`
const expiry = '2040-01-01T00:00:00.000Z'
const registered: NameLifecycleEvent = {
  type: 'name_registered', node, label: 'aurora', actor: owner, owner,
  expiresAt: expiry, graceEndsAt: expiry, feeLux: 1,
}

describe('shared projection behavior', () => {
  it('preserves observation times and distinct event identities within a transaction', () => {
    const projector = createLifecycleEventProjector()
    const observedAt = '2026-06-27T12:00:00.000Z'
    const event: NameLifecycleEvent = { type: 'resolver_changed', node, actor: owner, resolver: owner }
    for (const eventId of ['archive:1', 'archive:2']) projector.apply(event, { eventId, observedAt, txId: 'same-tx' })
    const activity = projector.getActivity(node)
    expect(activity.map(entry => entry.timestamp)).toEqual([observedAt, observedAt])
    expect(new Set(activity.map(entry => entry.id)).size).toBe(2)
  })

  it('uses canonical hex keys for nodes, commitments, pool members and marketplace authorities', () => {
    const projector = createLifecycleEventProjector()
    projector.apply({ ...registered, node: node.slice(2).toUpperCase() })
    expect(projector.getNameByNode(node)?.node).toBe(node)
    projector.applyController({ type: 'registration_committed', controller: owner, commitment: node.slice(2).toUpperCase(), createdAt: expiry })
    expect(projector.getCommitment(node)?.commitment).toBe(node)
    const operator = { kind: 'Contract' as const, bytes: Array(32).fill(1) }
    for (const member of [node, node.slice(2).toUpperCase()]) projector.applyPool({ type: 'pool_member_added', kind: 'registry', member, index: 0, operator })
    expect(projector.getPoolState().registries).toEqual([node])
    projector.applyMarketplace({ type: 'marketplace_operator_proposed', operator: owner, pendingOperator: node.slice(2).toUpperCase() })
    expect(projector.getMarketplaceConfig().pendingOperator).toBe(node)
  })

  it('keeps newest subnames first and supplies their canonical names', () => {
    const projector = createLifecycleEventProjector()
    projector.apply(registered)
    for (const label of ['first', 'second']) projector.applySubname({
      type: 'subname_created', parentNode: node, node: label, parentName: 'aurora.dusk', name: `${label}.aurora.dusk`, label,
      actor: owner, owner, manager: owner, resolver: owner, expiresAt: expiry, parentExpiresAt: expiry,
      expiryPolicy: 'inherits_parent', createdAt: expiry,
    })
    expect(projector.getSubnamesByParent(node).map(row => row.label)).toEqual(['second', 'first'])
    expect(projector.getSubnameByNode('second')).toMatchObject({ canonicalName: 'second.aurora.dusk' })
  })

  it('keeps legacy economic totals and operator metadata when optional fields are absent', () => {
    const projector = createLifecycleEventProjector()
    const operator = { kind: 'Phoenix' as const, bytes: Array(32).fill(1) }
    projector.applyTreasury({ type: 'treasury_initialized', operator, operatorRecipient: 'recipient', allowedFeeSources: [] })
    projector.applyTreasury({ type: 'treasury_claimed', amountLux: 1, remainingLux: 2 } as TreasuryEvent)
    expect(projector.getTreasuryState()).toMatchObject({ operator, operatorRecipient: 'recipient', availableLux: 2 })
    projector.applyReferral({ type: 'referral_reward_accrued', referrer: owner, buyer: node, amountLux: 3 } as ReferralEvent)
    expect(projector.getReferralState(owner)).toMatchObject({ claimableLux: 3, claimedLux: 0, referralCount: 1 })
  })

  it('rejects unsafe amounts outside the marketplace too', () => {
    const projector = createLifecycleEventProjector()
    expect(() => projector.apply({ ...registered, feeLux: Number.MAX_SAFE_INTEGER + 1 })).toThrow('unsafe numeric value')
    expect(projector.getNameByNode(node)).toBeNull()
  })

  it('normalizes legacy numeric marketplace values and records bids from partial histories', () => {
    const projector = createLifecycleEventProjector()
    projector.applyMarketplace({ type: 'domain_offer_placed', node, buyerAuthority: owner, amountLux: '5', feeBps: 0,
      expiresAtBlockHeight: 100, placedAtBlockHeight: 1 } as unknown as MarketplaceEvent)
    expect(projector.getMarketplaceOffer(node, owner)?.amountLux).toBe(5)
    projector.applyMarketplace({ type: 'domain_bid_placed', node, bidderAuthority: owner, amountLux: 10,
      previousBidderAuthority: null, previousBidLux: 0, startBlock: 1, endBlock: 100, started: true, extended: false,
      bidCount: 1, placedAtBlockHeight: 1 })
    expect(projector.getActivity(node)[0].eventType).toBe('domain_bid_placed')
  })
})

it('preserves distinct archive identities even when observation and transaction match', () => {
  const projector = createLifecycleEventProjector()
  for (const eventId of ['first', 'second']) projector.apply(registered, { eventId, observedAt: expiry, txId: 'same' })
  expect(new Set(projector.getActivity(node).map(row => row.id)).size).toBe(2)
})

it('normalizes commitment lookup independently of controller-qualified lookup', () => {
  const projector = createLifecycleEventProjector()
  projector.applyController({ type: 'registration_committed', controller: owner, commitment: node.slice(2).toUpperCase(), createdAt: expiry })
  expect(projector.getCommitment(node)?.commitment).toBe(node)
})

it('deduplicates pool members across hex encodings', () => {
  const projector = createLifecycleEventProjector()
  const operator = { kind: 'Contract' as const, bytes: Array(32).fill(1) }
  for (const member of [node, node.slice(2).toUpperCase()]) projector.applyPool({ type: 'pool_member_added', kind: 'registry', member, index: 0, operator })
  expect(projector.getPoolState().registries).toEqual([node])
})

it('normalizes marketplace authorities and preserves listing names for offers', () => {
  const projector = createLifecycleEventProjector()
  projector.applyMarketplace({ type: 'domain_fixed_sale_opened', node, name: 'aurora.dusk', sellerAuthority: owner,
    privateBuyer: null, priceLux: 10, feeBps: 0, expiresAtBlockHeight: 100, openedAtBlockHeight: 1 })
  projector.applyMarketplace({ type: 'domain_offer_placed', node, buyerAuthority: owner.slice(2).toUpperCase(),
    amountLux: 5, feeBps: 0, expiresAtBlockHeight: 100, placedAtBlockHeight: 1 })
  expect(projector.getMarketplaceOffer(node, owner)).toMatchObject({ buyerAuthority: owner, name: 'aurora.dusk' })
})

it('derives legacy referral totals when the payload omits aggregate counters', () => {
  const projector = createLifecycleEventProjector()
  projector.applyReferral({ type: 'referral_reward_accrued', referrer: owner, buyer: node, amountLux: 3 } as ReferralEvent)
  expect(projector.getReferralState(owner)).toMatchObject({ claimableLux: 3, claimedLux: 0, referralCount: 1 })
})

it('records observed bids even if replay starts after auction creation', () => {
  const projector = createLifecycleEventProjector()
  projector.applyMarketplace({ type: 'domain_bid_placed', node, bidderAuthority: owner, amountLux: 10,
    previousBidderAuthority: null, previousBidLux: 0, startBlock: 1, endBlock: 100, started: true, extended: false,
    bidCount: 1, placedAtBlockHeight: 1 })
  expect(projector.getActivity(node).map(row => row.eventType)).toEqual(['domain_bid_placed'])
})

it('uses lifecycle event timestamps when observation metadata is absent', () => {
  const projector = createLifecycleEventProjector()
  projector.apply({ ...registered, type: 'name_expired', observedAt: '2020-01-01T00:00:00.000Z' })
  projector.apply({ type: 'name_released', node, label: 'aurora', actor: owner, previousOwner: owner,
    releasedAt: '2020-02-01T00:00:00.000Z' })
  expect(projector.getActivity(node).map(row => row.timestamp)).toEqual(['2020-02-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'])
})

it('leaves offers and activity intact when a refund cannot be represented safely', () => {
  const projector = createLifecycleEventProjector()
  projector.applyMarketplace({ type: 'domain_offer_closed', node, buyerAuthority: owner,
    amountLux: Number.MAX_SAFE_INTEGER, expired: false, closedAtBlockHeight: 1 })
  projector.applyMarketplace({ type: 'domain_offer_placed', node, buyerAuthority: owner,
    amountLux: 1, feeBps: 0, expiresAtBlockHeight: 100, placedAtBlockHeight: 2 })
  const activity = projector.getActivity(node)
  expect(() => projector.applyMarketplace({ type: 'domain_offer_closed', node, buyerAuthority: owner,
    amountLux: 1, expired: false, closedAtBlockHeight: 3 })).toThrow('safe integer range')
  expect(projector.getMarketplaceOffer(node, owner)?.amountLux).toBe(1)
  expect(projector.getActivity(node)).toEqual(activity)
  expect(projector.getMarketplaceRefund(owner)?.amountLux).toBe(Number.MAX_SAFE_INTEGER)
})

it('does not invent observation timestamps for replayed events without one', () => {
  const projector = createLifecycleEventProjector()
  projector.apply(registered, { eventId: 'archive:1' })
  expect(projector.getActivity(node)[0].timestamp).toBe('')
})
