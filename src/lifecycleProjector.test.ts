import { describe, expect, it } from 'vitest'
import { createLifecycleEventProjector } from './indexer'
import { createResolverRecord } from './records'

describe('Dusk Domains lifecycle event projector', () => {
  it('projects registrar lifecycle events into name state and activity history', () => {
    const projector = createLifecycleEventProjector()
    const node = `0x${'33'.repeat(32)}`

    projector.apply({
      type: 'name_registered',
      node,
      label: 'aurora',
      actor: `0x${'44'.repeat(32)}`,
      owner: `0x${'44'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    }, { txId: 'tx-register', blockHeight: 10 })
    projector.apply({
      type: 'name_renewed',
      node,
      actor: `0x${'44'.repeat(32)}`,
      expiresAt: '2028-06-17T00:00:00.000Z',
      graceEndsAt: '2028-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    }, { txId: 'tx-renew', blockHeight: 11 })
    projector.apply({
      type: 'name_expired',
      node,
      label: 'aurora',
      actor: `0x${'44'.repeat(32)}`,
      owner: `0x${'44'.repeat(32)}`,
      expiresAt: '2028-06-17T00:00:00.000Z',
      graceEndsAt: '2028-07-17T00:00:00.000Z',
      observedAt: '2028-07-18T00:00:00.000Z',
    }, { txId: 'tx-expire', blockHeight: 12 })
    projector.apply({
      type: 'name_released',
      node,
      label: 'aurora',
      actor: `0x${'44'.repeat(32)}`,
      previousOwner: `0x${'44'.repeat(32)}`,
      releasedAt: '2028-07-19T00:00:00.000Z',
    }, { txId: 'tx-release', blockHeight: 13 })

    expect(projector.getNameByNode(node)).toMatchObject({
      canonicalName: 'aurora.dusk',
      status: 'released',
      owner: null,
      lastEventType: 'name_released',
    })
    expect(projector.getActivity(node).map((entry) => entry.eventType)).toEqual([
      'release',
      'expiry',
      'renewal',
      'registration',
    ])
    expect(projector.getActivity(node)[0]).toMatchObject({
      txId: 'tx-release',
      blockHeight: 13,
    })
  })

  it('projects registry ownership and resolver events with actor and target metadata', () => {
    const projector = createLifecycleEventProjector()
    const node = `0x${'55'.repeat(32)}`
    const owner = `0x${'66'.repeat(32)}`
    const nextOwner = `0x${'77'.repeat(32)}`
    const resolver = `0x${'88'.repeat(32)}`

    projector.apply({
      type: 'name_owner_changed',
      node,
      actor: owner,
      previousOwner: owner,
      owner: nextOwner,
      manager: nextOwner,
      resolver,
      expiresAt: '2027-06-17T00:00:00.000Z',
    }, { txId: 'tx-transfer', blockHeight: 20 })
    projector.apply({
      type: 'resolver_changed',
      node,
      actor: nextOwner,
      resolver: `0x${'99'.repeat(32)}`,
    }, { txId: 'tx-resolver', blockHeight: 21 })

    expect(projector.getNameByNode(node)).toMatchObject({
      owner: nextOwner,
      manager: nextOwner,
      resolverId: `0x${'99'.repeat(32)}`,
    })
    expect(projector.getActivity(node).map((entry) => [entry.eventType, entry.target])).toEqual([
      ['resolver_change', `0x${'99'.repeat(32)}`],
      ['transfer', nextOwner],
    ])
  })

  it('projects controller commitments without exposing the target node before reveal', () => {
    const projector = createLifecycleEventProjector()
    const commitment = `0x${'aa'.repeat(32)}`
    const controller = `0x${'bb'.repeat(32)}`
    const node = `0x${'cc'.repeat(32)}`

    projector.applyController({
      type: 'registration_committed',
      commitment,
      controller,
      createdAt: '2026-06-17T00:00:00.000Z',
    }, { txId: 'tx-commit', blockHeight: 30 })

    expect(projector.getCommitment(commitment)).toMatchObject({
      commitment,
      controller,
      createdAt: '2026-06-17T00:00:00.000Z',
      node: null,
      status: 'committed',
      committedTxId: 'tx-commit',
      committedBlockHeight: 30,
      revealedTxId: null,
      revealedBlockHeight: null,
    })

    projector.applyController({
      type: 'registration_revealed',
      commitment,
      node,
      controller,
    }, { txId: 'tx-reveal', blockHeight: 31 })

    expect(projector.getCommitment(commitment)).toMatchObject({
      commitment,
      controller,
      createdAt: '2026-06-17T00:00:00.000Z',
      node,
      status: 'revealed',
      committedTxId: 'tx-commit',
      committedBlockHeight: 30,
      revealedTxId: 'tx-reveal',
      revealedBlockHeight: 31,
    })
    expect(projector.getActivity(node)).toEqual([])
  })

  it('indexes revealed commitments even if the commit event arrives later', () => {
    const projector = createLifecycleEventProjector()
    const commitment = `0x${'dd'.repeat(32)}`
    const controller = `0x${'ee'.repeat(32)}`
    const node = `0x${'ff'.repeat(32)}`

    projector.applyController({
      type: 'registration_revealed',
      commitment,
      node,
      controller,
    }, { txId: 'tx-reveal', blockHeight: 42 })
    projector.applyController({
      type: 'registration_committed',
      commitment,
      controller,
      createdAt: '2026-06-17T00:01:00.000Z',
    }, { txId: 'tx-commit', blockHeight: 41 })

    expect(projector.getCommitment(commitment)).toMatchObject({
      commitment,
      controller,
      createdAt: '2026-06-17T00:01:00.000Z',
      node,
      status: 'revealed',
      committedTxId: 'tx-commit',
      committedBlockHeight: 41,
      revealedTxId: 'tx-reveal',
      revealedBlockHeight: 42,
    })
  })

  it('projects resolver record changes and clears into node records and activity', () => {
    const projector = createLifecycleEventProjector()
    const node = `0x${'12'.repeat(32)}`
    const controller = `0x${'13'.repeat(32)}`
    const moonlight = createResolverRecord(
      'moonlight_address',
      'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
      '2026-06-17T00:00:00.000Z',
    )

    projector.applyResolver({
      type: 'record_changed',
      node,
      controller,
      record: moonlight,
    }, { txId: 'tx-record', blockHeight: 50 })

    expect(projector.getResolverRecords(node)).toEqual([moonlight])
    expect(projector.getActivity(node)[0]).toMatchObject({
      eventType: 'record_update',
      actor: controller,
      target: 'moonlight_address',
      timestamp: '2026-06-17T00:00:00.000Z',
      txId: 'tx-record',
      blockHeight: 50,
    })

    projector.applyResolver({
      type: 'record_cleared',
      node,
      controller,
      key: 'moonlight_address',
    }, { txId: 'tx-clear', blockHeight: 51 })

    expect(projector.getResolverRecords(node)).toEqual([])
    expect(projector.getActivity(node).map((entry) => entry.target)).toEqual([
      'moonlight_address',
      'moonlight_address',
    ])
  })

  it('clears derived resolver and reverse state when a name is released', () => {
    const projector = createLifecycleEventProjector()
    const node = `0x${'12'.repeat(32)}`
    const owner = `0x${'13'.repeat(32)}`
    const nextOwner = `0x${'14'.repeat(32)}`
    const endpoint = {
      type: 'moonlight_address' as const,
      value: 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
    }
    const moonlight = createResolverRecord(
      'moonlight_address',
      endpoint.value,
      '2026-06-17T00:00:00.000Z',
    )

    projector.apply({
      type: 'name_registered',
      node,
      label: 'aurora',
      actor: owner,
      owner,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })
    projector.applyResolver({
      type: 'record_changed',
      node,
      controller: owner,
      record: moonlight,
    })
    projector.applyReverse({
      type: 'primary_name_changed',
      endpoint,
      controller: owner,
      node,
      name: 'aurora.dusk',
      previousName: null,
      updatedAt: '2026-06-17T00:01:00.000Z',
    })

    expect(projector.getResolverRecords(node)).toEqual([moonlight])
    expect(projector.getPrimaryNameByEndpoint(endpoint)).toMatchObject({
      name: 'aurora.dusk',
      status: 'set',
    })

    projector.apply({
      type: 'name_released',
      node,
      label: 'aurora',
      actor: owner,
      previousOwner: owner,
      releasedAt: '2027-07-18T00:00:00.000Z',
    })
    projector.apply({
      type: 'name_registered',
      node,
      label: 'aurora',
      actor: nextOwner,
      owner: nextOwner,
      expiresAt: '2028-06-17T00:00:00.000Z',
      graceEndsAt: '2028-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })

    expect(projector.getNameByNode(node)).toMatchObject({
      canonicalName: 'aurora.dusk',
      owner: nextOwner,
      status: 'active',
    })
    expect(projector.getResolverRecords(node)).toEqual([])
    expect(projector.getPrimaryNameByEndpoint(endpoint)).toBeNull()
    expect(projector.getActivity(node).map((entry) => entry.eventType)).toEqual([
      'registration',
      'release',
      'primary_name',
      'record_update',
      'registration',
    ])
  })

  it('projects typed reverse primary-name changes by endpoint', () => {
    const projector = createLifecycleEventProjector()
    const node = `0x${'14'.repeat(32)}`
    const endpoint = {
      type: 'moonlight_address' as const,
      value: 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
    }

    projector.applyReverse({
      type: 'primary_name_changed',
      endpoint,
      controller: `0x${'15'.repeat(32)}`,
      node,
      name: 'aurora.dusk',
      previousName: null,
      updatedAt: '2026-06-17T00:00:00.000Z',
    }, { txId: 'tx-primary', blockHeight: 60 })

    expect(projector.getPrimaryNameByEndpoint(endpoint)).toMatchObject({
      endpoint,
      node,
      name: 'aurora.dusk',
      previousName: null,
      status: 'set',
      txId: 'tx-primary',
      blockHeight: 60,
    })

    projector.applyReverse({
      type: 'primary_name_changed',
      endpoint,
      controller: `0x${'15'.repeat(32)}`,
      node,
      name: '',
      previousName: 'aurora.dusk',
      updatedAt: '2026-06-18T00:00:00.000Z',
    }, { txId: 'tx-primary-clear', blockHeight: 61 })

    expect(projector.getPrimaryNameByEndpoint(endpoint)).toBeNull()
    expect(projector.getActivity(node).map((entry) => entry.eventType)).toEqual([
      'primary_name',
      'primary_name',
    ])
  })

  it('does not index non-primary endpoint types as public primary-name identities', () => {
    const projector = createLifecycleEventProjector()
    const endpoints = [
      {
        type: 'phoenix_payment_endpoint' as const,
        value: 'phoenix:payment-endpoint',
      },
      {
        type: 'dusk_contract' as const,
        value: `0x${'18'.repeat(32)}`,
      },
      {
        type: 'dusk_asset' as const,
        value: 'asset-2028',
      },
      {
        type: 'evm_address' as const,
        value: '0x0000000000000000000000000000000000000001',
      },
    ]

    for (const endpoint of endpoints) {
      expect(projector.applyReverse({
        type: 'primary_name_changed',
        endpoint,
        controller: `0x${'16'.repeat(32)}`,
        node: `0x${'17'.repeat(32)}`,
        name: 'private.dusk',
        previousName: null,
        updatedAt: '2026-06-17T00:00:00.000Z',
      })).toBeNull()
      expect(projector.getPrimaryNameByEndpoint(endpoint)).toBeNull()
    }
  })

})
