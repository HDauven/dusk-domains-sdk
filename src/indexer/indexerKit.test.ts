import { describe, expect, it } from 'vitest'
import {
  applyDuskDomainsIndexedEvent,
  createDuskDomainsProjector,
  duskDomainsIndexedEventTypes,
  isDuskDomainsIndexedEventEnvelope,
  isDuskDomainsIndexedEventType,
  normalizeDuskDomainsIndexedEventEnvelope,
} from './indexerKit'

describe('Dusk Domains indexer kit', () => {
  it('follows the contract pool as the router adds members', () => {
    const projector = createDuskDomainsProjector()
    const router = `0x${'c0'.repeat(32)}`
    const treasury = `0x${'c1'.repeat(32)}`
    const [registry1, registry2, resolver1] = ['11', '12', '21'].map((byte) => `0x${byte.repeat(32)}`)
    const operator = { kind: 'Phoenix' as const, bytes: Array(32).fill(3) }
    const feeConfig = {
      threeCharYearLux: 150_000_000_000,
      fourCharYearLux: 50_000_000_000,
      fivePlusYearLux: 10_000_000_000,
      referralRewardBps: 1_500,
      renewalReferralRewardBps: 1_000,
      premiumReferralRewardBps: 0,
      version: 1,
      updatedAt: 0,
    }

    applyDuskDomainsIndexedEvent(projector, {
      event: { type: 'router_initialized', operator, treasury, marketplace: `0x${'00'.repeat(32)}`, feeConfig },
      meta: { txId: 'tx-router', blockHeight: 10, contractId: router },
    })
    for (const [kind, member, blockHeight] of [
      ['registry', registry1, 11],
      ['resolver', resolver1, 12],
      ['registry', registry2, 500],
      ['registry', registry2, 501],
    ] as const) {
      applyDuskDomainsIndexedEvent(projector, {
        event: { type: 'pool_member_added', kind, member, index: 0, operator },
        meta: { blockHeight },
      })
    }
    const moved = applyDuskDomainsIndexedEvent(projector, {
      event: {
        type: 'records_moved',
        node: `0x${'07'.repeat(32)}`,
        controller: '0xowner',
        fromResolver: resolver1,
        toResolver: resolver1,
        recordCount: 2,
      },
    })

    expect(projector.getPoolState()).toEqual({
      registrationsPaused: false,
      pendingOperator: null,
      initialized: true,
      router,
      operator,
      treasury,
      marketplace: null,
      registries: [registry1, registry2],
      resolvers: [resolver1],
      txId: 'tx-router',
      blockHeight: 500,
    })
    expect(moved).toEqual(projector.getPoolState())
    expect(projector.getFeeConfig()).toMatchObject({ referralRewardBps: 1_500, operator, blockHeight: 10 })
  })

  it('points a name or subname at the resolver its records moved to', () => {
    const projector = createDuskDomainsProjector()
    const [node, subnode, owner, fromResolver, toResolver] = ['12', '13', '14', '21', '22'].map((byte) => `0x${byte.repeat(32)}`)
    const record = {
      key: 'moonlight_address',
      value: 'dusk1public',
      visibility: 'public' as const,
      updatedAt: '2026-06-27T00:00:00.000Z',
      ttlSeconds: 300,
    }
    const expiresAt = '2099-06-27T00:00:00.000Z'
    const events = [
      { type: 'name_owner_changed', node, actor: owner, owner, manager: owner, resolver: fromResolver, expiresAt },
      { type: 'record_changed', node, controller: owner, record },
      {
        type: 'subname_created',
        parentNode: node,
        node: subnode,
        parentName: 'aurora.dusk',
        name: 'pay.aurora.dusk',
        label: 'pay',
        actor: owner,
        owner,
        manager: owner,
        resolver: fromResolver,
        expiresAt,
        parentExpiresAt: expiresAt,
        expiryPolicy: 'inherits_parent',
        createdAt: '2026-06-27T00:00:00.000Z',
      },
      ...[node, subnode].map((moved) => ({ type: 'records_moved', node: moved, controller: owner, fromResolver, toResolver, recordCount: 1 })),
    ] as const
    for (const event of events) applyDuskDomainsIndexedEvent(projector, { event, meta: { txId: `tx-${event.type}` } })

    expect(projector.getNameByNode(node)?.resolverId).toBe(toResolver)
    expect(projector.getResolverRecords(node)).toEqual([record])
    expect(projector.getActivity(node)[0]).toMatchObject({ eventType: 'resolver_change', target: toResolver })
    expect(projector.getSubnameByNode(subnode)?.resolver).toBe(toResolver)
    // A subname is not indexed as a name of its own.
    expect(projector.getNameByNode(subnode)).toBeNull()
  })

  it('moves the subname resolver after an authority change', () => {
    const projector = createDuskDomainsProjector()
    const [node, subnode, owner, manager, fromResolver, toResolver] = ['12', '13', '14', '15', '21', '22'].map((byte) => `0x${byte.repeat(32)}`)
    const expiresAt = '2099-06-27T00:00:00.000Z'
    const events = [
      { type: 'name_owner_changed', node, actor: owner, previousOwner: null, owner, manager: owner, resolver: fromResolver, expiresAt },
      {
        type: 'subname_created',
        parentNode: node,
        node: subnode,
        parentName: 'aurora.dusk',
        name: 'pay.aurora.dusk',
        label: 'pay',
        actor: owner,
        owner,
        manager: owner,
        resolver: fromResolver,
        expiresAt,
        parentExpiresAt: expiresAt,
        expiryPolicy: 'inherits_parent',
        createdAt: '2026-06-27T00:00:00.000Z',
      },
      // The contract reports a subname's authority change as a name_owner_changed on its node.
      { type: 'name_owner_changed', node: subnode, actor: owner, previousOwner: owner, owner, manager, resolver: `0x${'00'.repeat(32)}`, expiresAt },
      { type: 'records_moved', node: subnode, controller: manager, fromResolver, toResolver, recordCount: 1 },
    ] as const
    for (const event of events) applyDuskDomainsIndexedEvent(projector, { event, meta: { txId: `tx-${event.type}` } })

    expect(projector.getNameByNode(subnode)).toBeNull()
    expect(projector.getSubnameByNode(subnode)?.resolver).toBe(toResolver)
    expect(projector.getSubnamesByParent(node)).toMatchObject([{ node: subnode, resolver: toResolver }])
  })

  it('replays normalized JSON events into projector state', () => {
    const projector = createDuskDomainsProjector()
    const node = `0x${'12'.repeat(32)}`

    applyDuskDomainsIndexedEvent(projector, {
      event: {
        type: 'name_registered',
        node,
        label: 'aurora',
        actor: '0xactor',
        owner: '0xowner',
        expiresAt: '2027-06-27T00:00:00.000Z',
        graceEndsAt: '2027-07-27T00:00:00.000Z',
        feeLux: 10_000_000_000,
      },
      meta: {
        txId: 'tx-register',
        blockHeight: 100,
      },
    })

    applyDuskDomainsIndexedEvent(projector, {
      event: {
        type: 'record_changed',
        node,
        controller: '0xowner',
        record: {
          key: 'moonlight_address',
          value: 'dusk1public',
          visibility: 'public',
          updatedAt: '2026-06-27T00:00:00.000Z',
          ttlSeconds: 300,
        },
      },
      meta: {
        txId: 'tx-record',
        blockHeight: 101,
      },
    })

    expect(projector.getNameByNode(node)).toMatchObject({
      canonicalName: 'aurora.dusk',
      owner: '0xowner',
      status: 'active',
    })
    expect(projector.getResolverRecords(node)).toEqual([{
      key: 'moonlight_address',
      value: 'dusk1public',
      visibility: 'public',
      updatedAt: '2026-06-27T00:00:00.000Z',
      ttlSeconds: 300,
    }])
    expect(projector.getActivity(node)).toHaveLength(2)
  })

  it('rejects unsupported normalized event envelopes before projection', () => {
    expect(isDuskDomainsIndexedEventType('name_registered')).toBe(true)
    expect(isDuskDomainsIndexedEventType('unknown_event')).toBe(false)
    expect(duskDomainsIndexedEventTypes.every((type) => isDuskDomainsIndexedEventType(type))).toBe(true)
    expect(isDuskDomainsIndexedEventEnvelope({
      event: { type: 'unknown_event' },
    })).toBe(false)
    expect(() => normalizeDuskDomainsIndexedEventEnvelope({
      event: { type: 'unknown_event' },
    })).toThrow('Unsupported Dusk Domains indexed event type')
  })

  it('rejects malformed normalized event envelopes', () => {
    expect(isDuskDomainsIndexedEventEnvelope(null)).toBe(false)
    expect(isDuskDomainsIndexedEventEnvelope({})).toBe(false)
    expect(isDuskDomainsIndexedEventEnvelope({
      event: { type: 'name_registered' },
      meta: [],
    })).toBe(false)
  })
})
