import { describe, expect, it } from 'vitest'
import { normalizeObservedEvent, bytesToBase58 } from '../projection.mjs'

const observedAt = '2026-06-27T12:00:00.000Z'
const contract = {
  key: 'core',
  contractId: '77'.repeat(32),
}
const treasuryContract = {
  key: 'treasury',
  contractId: '66'.repeat(32),
}
const marketplaceContract = {
  key: 'marketplace',
  contractId: '55'.repeat(32),
}
const routerContract = {
  key: 'router',
  contractId: '44'.repeat(32),
}

describe('Dusk Domains indexer event decoder', () => {
  it('decodes creation, expired pruning, removal and take-back payloads', () => {
    const args = {
      parent_node: bytes(1), node: bytes(2), parent_name: 'acme.dusk', name: 'pay.acme.dusk',
      label: 'pay', actor: bytes(3), owner: bytes(3), manager: bytes(4), resolver: bytes(0),
      expires_at: 100, parent_expires_at: 200, expiry_policy: 'FixedBeforeParent', created_at: 10,
    }
    const created = normalizeObservedEvent({ contract, observedAt, eventName: 'subname_created', event: args })
    expect(created.event).toMatchObject({ expiryPolicy: 'fixed_before_parent', expiresAtBlockHeight: 100, parentExpiresAtBlockHeight: 200 })
    expect(created.event).not.toHaveProperty('revocationPolicy')
    const pruned = normalizeObservedEvent({ contract, observedAt, eventName: 'subname_pruned', event: { ...args, created_at: undefined, pruned_at: 100 } })
    expect(pruned).toMatchObject({ event: { type: 'subname_pruned', node: hex(2), parentNode: hex(1), prunedAt: observedAt }, meta: { blockHeight: 100 } })
    const removed = normalizeObservedEvent({ contract, observedAt, eventName: 'subname_removed', event: { ...args, created_at: undefined, removed_at: 100 } })
    expect(removed.event).toMatchObject({ type: 'subname_removed', node: hex(2), parentNode: hex(1), removedAt: observedAt })
    const taken = normalizeObservedEvent({ contract, observedAt, eventName: 'name_owner_changed', event: { ...args, data_cleared: true, previous_owner: bytes(4) } })
    expect(taken.event).toMatchObject({ type: 'name_owner_changed', dataCleared: true })
    for (const eventName of ['subname_revoked', 'subname_delegated']) {
      expect(normalizeObservedEvent({ contract, observedAt, eventName, event: args })).toBeNull()
    }
  })

  it.each([undefined, false, true])('decodes root transfer clearing %s', clear => {
    const result = normalizeObservedEvent({ contract, observedAt, eventName: 'name_owner_changed', event: {
      node: bytes(1), actor: bytes(2), previous_owner: bytes(2), owner: bytes(3), manager: bytes(3),
      resolver: bytes(0), expires_at: 100, ...(clear === undefined ? {} : { data_cleared: clear }),
    } })
    expect(result.event).toMatchObject({ type: 'name_owner_changed', owner: hex(3), manager: hex(3), dataCleared: clear === true })
  })

  it('rejects u64 values that JavaScript cannot represent exactly', () => {
    expect(() => normalizeObservedEvent({
      contract: marketplaceContract,
      eventName: 'domain_offer_placed',
      observedAt,
      event: {
        node: bytes(0x11),
        buyer_authority: bytes(0x22),
        amount_lux: 9_007_199_254_740_993n,
        fee_bps: 250,
        expires_at: 100,
        placed_at: 50,
      },
    })).toThrow('unsafe numeric value')

    expect(() => normalizeObservedEvent({
      contract: marketplaceContract,
      eventName: 'domain_offer_placed',
      observedAt,
      event: {
        node: bytes(0x11),
        buyer_authority: bytes(0x22),
        amount_lux: '9007199254740993',
        fee_bps: 250,
        expires_at: 100,
        placed_at: 50,
      },
    })).toThrow('unsafe numeric value')
  })

  it('normalizes block-based registration timing into ISO timestamps and block heights', () => {
    const normalized = normalizeObservedEvent({
      contract,
      eventName: 'name_registered',
      observedAt,
      targetBlockSeconds: 10,
      observedBlockHeight: 2,
      event: {
        node: bytes(0x11),
        label: 'aurora',
        actor: bytes(0x22),
        owner: bytes(0x33),
        expires_at: 5,
        grace_ends_at: 8,
        fee_lux: 10_000_000_000,
      },
    })

    expect(normalized).toEqual({
      event: {
        type: 'name_registered',
        node: hex(0x11),
        label: 'aurora',
        actor: hex(0x22),
        owner: hex(0x33),
        expiresAt: '2026-06-27T12:00:30.000Z',
        graceEndsAt: '2026-06-27T12:01:00.000Z',
        expiresAtBlockHeight: 5,
        graceEndsAtBlockHeight: 8,
        feeLux: 10_000_000_000,
      },
      meta: {
        txId: null,
        blockHeight: null,
        observedBlockHeight: 2,
        timeSource: 'observation',
        source: 'w3sper-live-subscription',
        observedAt,
        contractKey: 'core',
        contractId: `0x${'77'.repeat(32)}`,
      },
    })
  })

  it('normalizes every collected protocol event into an envelope', () => {
    for (const [eventName, event, expectedType, targetContract = contract] of collectedEventFixtures()) {
      const normalized = normalizeObservedEvent({
        contract: targetContract,
        eventName,
        event,
        observedAt,
      })

      expect(normalized?.event?.type, eventName).toBe(expectedType)
      expect(normalized?.meta?.contractKey, eventName).toBe(targetContract.key)
      expect(normalized?.meta?.contractId, eventName).toMatch(/^0x[0-9a-f]{64}$/u)
    }
  })

  it('keeps polled height separate and uses event heights only when present', () => {
    const bid = normalizeObservedEvent({
      contract: marketplaceContract, eventName: 'domain_bid_placed', observedAt,
      observedBlockHeight: 95, event: { node: bytes(1), placed_at: 100 },
    })
    expect(bid.meta).toMatchObject({ blockHeight: 100, observedBlockHeight: 95, timeSource: 'observation' })
    const record = normalizeObservedEvent({
      contract, eventName: 'record_changed', observedAt,
      observedBlockHeight: 95, event: { node: bytes(1), record: { updated_at: 100 } },
    })
    expect(record.meta.blockHeight).toBe(100)
    expect(record.event.record.updatedAt).toBe(observedAt)
    const cleared = normalizeObservedEvent({
      contract, eventName: 'record_cleared', observedAt,
      observedBlockHeight: 95, event: { node: bytes(1), key: 'text.description' },
    })
    expect(cleared.meta.blockHeight).toBeNull()
  })

  it('decodes the contract pool events', () => {
    const operator = principal(0x77)
    const decode = (contract, eventName, event) => normalizeObservedEvent({ contract, eventName, event, observedAt }).event
    expect(decode(routerContract, 'router_initialized', {
      operator,
      treasury: bytes(0x21),
      marketplace: bytes(0),
      fee_config: feeConfig(1),
    })).toMatchObject({
      type: 'router_initialized',
      treasury: `0x${'21'.repeat(32)}`,
      marketplace: `0x${'00'.repeat(32)}`,
      feeConfig: { threeCharYearLux: 1 },
    })
    expect(decode(routerContract, 'pool_member_added', { kind: 'Resolver', member: bytes(0x31), index: 2, operator })).toMatchObject({
      type: 'pool_member_added',
      kind: 'resolver',
      member: `0x${'31'.repeat(32)}`,
      index: 2,
    })
    expect(decode(contract, 'records_moved', {
      node: bytes(0x11),
      controller: bytes(0x22),
      from_resolver: bytes(0x31),
      to_resolver: bytes(0x32),
      record_count: 3,
    })).toEqual({
      type: 'records_moved',
      node: `0x${'11'.repeat(32)}`,
      controller: `0x${'22'.repeat(32)}`,
      fromResolver: `0x${'31'.repeat(32)}`,
      toResolver: `0x${'32'.repeat(32)}`,
      recordCount: 3,
    })
    expect(decode(marketplaceContract, 'marketplace_initialized', { router: bytes(0x41) }).router).toBe(`0x${'41'.repeat(32)}`)
    expect(decode(treasuryContract, 'treasury_initialized', { operator, operator_recipient: [1], router: bytes(0x41) }).router)
      .toBe(`0x${'41'.repeat(32)}`)
  })

  it('fails closed for unsupported event names', () => {
    expect(normalizeObservedEvent({
      contract,
      eventName: 'unknown_event',
      observedAt,
      event: {},
    })).toBeNull()
  })

  it('normalizes raw Moonlight endpoint bytes to Dusk account strings', () => {
    const node = bytes(0x11)
    const actor = bytes(0x22)
    const publicKey = bytes(0x2a, 96)
    const expectedAddress = bytesToBase58(publicKey)

    expect(normalizeObservedEvent({
      contract,
      eventName: 'record_changed',
      observedAt,
      event: {
        node,
        controller: actor,
        record: {
          key: 'moonlight_address',
          value: publicKey,
          updated_at: 40,
          ttl_seconds: 300,
        },
      },
    })?.event).toMatchObject({
      record: {
        value: expectedAddress,
      },
    })

    expect(normalizeObservedEvent({
      contract,
      eventName: 'primary_name_changed',
      observedAt,
      event: {
        endpoint: { kind: 'MoonlightAddress', value: publicKey },
        controller: actor,
        node,
        name: 'aurora.dusk',
        previous_name: null,
        updated_at: 41,
      },
    })?.event).toMatchObject({
      endpoint: {
        value: expectedAddress,
      },
    })
  })
})

function collectedEventFixtures() {
  const node = bytes(0x11)
  const parentNode = bytes(0x12)
  const actor = bytes(0x22)
  const owner = bytes(0x33)
  const manager = bytes(0x44)
  const resolver = bytes(0x55)
  const commitment = bytes(0x66)
  const operator = principal(0x77)

  return [
    ['registration_committed', { commitment, controller: actor, created_at: 19 }, 'registration_committed'],
    ['registration_revealed', { commitment, node, controller: actor }, 'registration_revealed'],
    ['name_registered', { node, label: 'aurora', actor, owner, expires_at: 10, grace_ends_at: 13, fee_lux: 1 }, 'name_registered'],
    ['name_renewed', { node, actor, expires_at: 20, grace_ends_at: 23, fee_lux: 2 }, 'name_renewed'],
    ['name_expired', { node, label: 'aurora', actor, owner, expires_at: 10, grace_ends_at: 13, observed_at: 14 }, 'name_expired'],
    ['name_released', { node, label: 'aurora', actor, previous_owner: owner, released_at: 15 }, 'name_released'],
    ['name_owner_changed', { node, actor, previous_owner: owner, owner, manager, resolver, expires_at: 30 }, 'name_owner_changed'],
    ['resolver_changed', { node, actor, resolver }, 'resolver_changed'],
    ['record_changed', {
      node,
      controller: actor,
      record: {
        key: 'moonlight_address',
        value: utf8Bytes('dusk1publicaddress'),
        updated_at: 40,
        ttl_seconds: 300,
      },
    }, 'record_changed'],
    ['record_cleared', { node, controller: actor, key: 'moonlight_address' }, 'record_cleared'],
    ['primary_name_changed', {
      endpoint: { kind: 'MoonlightAddress', value: utf8Bytes('dusk1publicaddress') },
      controller: actor,
      node,
      name: 'aurora.dusk',
      previous_name: null,
      updated_at: 41,
    }, 'primary_name_changed'],
    ['subname_created', {
      parent_node: parentNode,
      node,
      parent_name: 'aurora.dusk',
      name: 'pay.aurora.dusk',
      label: 'pay',
      actor,
      owner,
      manager,
      resolver,
      expires_at: 50,
      parent_expires_at: 60,
      expiry_policy: 'FixedBeforeParent',
      created_at: 42,
    }, 'subname_created'],
    ['subname_pruned', { parent_node: parentNode, node, name: 'pay.aurora.dusk', actor, pruned_at: 44 }, 'subname_pruned'],
    ['core_referral_config_changed', {
      operator,
      previous_referral_reward_bps: 2_000,
      referral_reward_bps: 1_000,
    }, 'core_referral_config_changed'],
    ['fee_config_updated', {
      operator,
      previous_config: feeConfig(1),
      config: feeConfig(2),
    }, 'fee_config_updated', routerContract],
    ['router_initialized', {
      operator,
      treasury: node,
      marketplace: parentNode,
      fee_config: feeConfig(1),
    }, 'router_initialized', routerContract],
    ['pool_member_added', { kind: 'Registry', member: node, index: 0, operator }, 'pool_member_added', routerContract],
    ['router_operator_changed', { previous_operator: principal(0x76), operator }, 'router_operator_changed', routerContract],
    ['records_moved', {
      node,
      controller: actor,
      from_resolver: node,
      to_resolver: parentNode,
      record_count: 2,
    }, 'records_moved'],
    ['treasury_initialized', {
      operator,
      operator_recipient: [1, 2, 3],
      allowed_fee_sources: [node],
      router: parentNode,
    }, 'treasury_initialized', treasuryContract],
    ['treasury_operator_changed', {
      previous_operator: principal(0x76),
      operator,
      operator_recipient: [1, 2, 3],
    }, 'treasury_operator_changed', treasuryContract],
    ['treasury_fee_received', {
      source_contract: node,
      reason: 1,
      node,
      amount_lux: 1,
      total_received_lux: 2,
      available_lux: 3,
      registration_received_lux: 4,
      renewal_received_lux: 5,
      other_received_lux: 6,
    }, 'treasury_fee_received', treasuryContract],
    ['treasury_claimed', {
      operator,
      operator_recipient: [1, 2, 3],
      amount_lux: 1,
      remaining_lux: 2,
    }, 'treasury_claimed', treasuryContract],
    ['referral_reward_accrued', {
      referrer: principal(0x88),
      buyer: principal(0x89),
      node,
      amount_lux: 1,
      claimable_lux: 2,
      claimed_lux: 3,
      referral_count: 4,
    }, 'referral_reward_accrued', treasuryContract],
    ['referral_reward_claimed', {
      referrer: principal(0x88),
      referrer_recipient: [1, 2, 3],
      amount_lux: 1,
      remaining_lux: 2,
      claimed_lux: 3,
      referral_count: 4,
    }, 'referral_reward_claimed', treasuryContract],
    ['marketplace_initialized', {
      router: node,
      treasury_contract: parentNode,
      marketplace_authority: actor,
      operator: owner,
      fee_bps: 250,
    }, 'marketplace_initialized', marketplaceContract],
    ['marketplace_config_updated', {
      operator: owner,
      previous_operator: actor,
      previous_fee_bps: 250,
      fee_bps: 300,
      updated_at: 45,
    }, 'marketplace_config_updated', marketplaceContract],
    ['domain_fixed_sale_opened', {
      node,
      name: 'aurora.dusk',
      seller_authority: owner,
      price_lux: 10,
      private_buyer: null,
      fee_bps: 300,
      expires_at: 100,
      opened_at: 46,
    }, 'domain_fixed_sale_opened', marketplaceContract],
    ['domain_fixed_sale_closed', {
      node,
      seller_authority: owner,
      expired: false,
      domain_expired: false,
      closed_at: 47,
    }, 'domain_fixed_sale_closed', marketplaceContract],
    ['domain_fixed_sale_filled', {
      node,
      name: 'aurora.dusk',
      seller_authority: owner,
      buyer_authority: actor,
      gross_amount_lux: 10,
      protocol_fee_lux: 1,
      seller_proceeds_lux: 9,
      filled_at: 48,
    }, 'domain_fixed_sale_filled', marketplaceContract],
    ['domain_auction_created', {
      node,
      name: 'aurora.dusk',
      seller_authority: owner,
      reserve_price_lux: 10,
      duration_blocks: 100,
      start_deadline: 500,
      fee_bps: 300,
      created_at: 49,
    }, 'domain_auction_created', marketplaceContract],
    ['domain_bid_placed', {
      node,
      bidder_authority: actor,
      amount_lux: 10,
      previous_bidder_authority: null,
      previous_bid_lux: 0,
      start_block: 50,
      end_block: 150,
      started: true,
      extended: false,
      bid_count: 1,
      placed_at: 50,
    }, 'domain_bid_placed', marketplaceContract],
    ['domain_auction_cancelled', {
      node,
      seller_authority: owner,
      expired: true,
      domain_expired: false,
      cancelled_at: 51,
    }, 'domain_auction_cancelled', marketplaceContract],
    ['domain_auction_settled', {
      node,
      name: 'aurora.dusk',
      seller_authority: owner,
      winner_authority: actor,
      gross_amount_lux: 10,
      protocol_fee_lux: 1,
      seller_proceeds_lux: 9,
      domain_expired: false,
      settled_at: 52,
    }, 'domain_auction_settled', marketplaceContract],
    ['domain_offer_placed', {
      node,
      buyer_authority: actor,
      amount_lux: 10,
      fee_bps: 300,
      expires_at: 100,
      placed_at: 53,
    }, 'domain_offer_placed', marketplaceContract],
    ['domain_offer_closed', {
      node,
      buyer_authority: actor,
      amount_lux: 10,
      expired: false,
      closed_at: 54,
    }, 'domain_offer_closed', marketplaceContract],
    ['domain_offer_accepted', {
      node,
      seller_authority: owner,
      buyer_authority: actor,
      gross_amount_lux: 10,
      protocol_fee_lux: 1,
      seller_proceeds_lux: 9,
      accepted_at: 55,
    }, 'domain_offer_accepted', marketplaceContract],
    ['marketplace_refund_claimed', {
      authority: actor,
      recipient: bytes(0x99, 96),
      amount_lux: 10,
      claimed_at: 56,
    }, 'marketplace_refund_claimed', marketplaceContract],
  ]
}

function feeConfig(seed) {
  return {
    three_char_year_lux: seed,
    four_char_year_lux: seed + 1,
    five_plus_year_lux: seed + 2,
    referral_reward_bps: seed + 3,
    renewal_referral_reward_bps: seed + 4,
    premium_referral_reward_bps: seed + 5,
    version: seed + 6,
    updated_at: seed + 7,
  }
}

function principal(seed) {
  return {
    kind: 'Phoenix',
    bytes: bytes(seed),
  }
}

function bytes(byte, length = 32) {
  return Array.from({ length }, () => byte)
}

function utf8Bytes(value) {
  return [...new TextEncoder().encode(value)]
}

function hex(byte) {
  return `0x${byte.toString(16).padStart(2, '0').repeat(32)}`
}
