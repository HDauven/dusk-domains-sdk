import { describe, expect, it } from 'vitest'
import { createLifecycleEventProjector } from './indexer'
import { createResolverRecord } from '../core/records'

describe('Dusk Domains lifecycle event projector subnames', () => {
  it('projects subname creation, delegation, and revocation by parent node', () => {
    const projector = createLifecycleEventProjector()
    const parentNode = `0x${'18'.repeat(32)}`
    const node = `0x${'19'.repeat(32)}`
    const owner = `0x${'20'.repeat(32)}`
    const manager = `0x${'21'.repeat(32)}`
    const nextManager = `0x${'22'.repeat(32)}`

    projector.apply({
      type: 'name_registered',
      node: parentNode,
      label: 'acme',
      actor: owner,
      owner,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })
    projector.applySubname({
      type: 'subname_created',
      parentNode,
      node,
      parentName: 'acme.dusk',
      name: 'settlement.acme.dusk',
      label: 'settlement',
      actor: owner,
      owner,
      manager,
      resolver: `0x${'23'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'inherits_parent',
      revocationPolicy: 'parent_revocable',
      createdAt: '2026-06-17T00:00:00.000Z',
    }, { txId: 'tx-subname', blockHeight: 70 })

    expect(projector.getSubnamesByParent(parentNode)).toHaveLength(1)
    expect(projector.getSubnameByNode(node)).toMatchObject({
      parentNode,
      node,
      parentName: 'acme.dusk',
      name: 'settlement.acme.dusk',
      label: 'settlement',
      manager,
      status: 'active',
      lastEventType: 'subname_created',
      txId: 'tx-subname',
      blockHeight: 70,
    })

    projector.applySubname({
      type: 'subname_delegated',
      parentNode,
      node,
      name: 'settlement.acme.dusk',
      actor: owner,
      manager: nextManager,
      delegatedAt: '2026-06-17T00:10:00.000Z',
    }, { txId: 'tx-delegate', blockHeight: 71 })
    projector.applySubname({
      type: 'subname_revoked',
      parentNode,
      node,
      name: 'settlement.acme.dusk',
      actor: owner,
      revokedAt: '2026-06-17T00:20:00.000Z',
    }, { txId: 'tx-revoke', blockHeight: 72 })

    expect(projector.getSubnameByNode(node)).toBeNull()
    expect(projector.getSubnamesByParent(parentNode)).toEqual([])
    expect(projector.getActivity(parentNode).map((entry) => [entry.eventType, entry.name])).toEqual([
      ['subname_revoked', 'settlement.acme.dusk'],
      ['subname_delegated', 'settlement.acme.dusk'],
      ['subname_created', 'settlement.acme.dusk'],
      ['registration', 'acme.dusk'],
    ])
    expect(projector.getActivity(node).map((entry) => entry.eventType)).toEqual([
      'subname_revoked',
      'subname_delegated',
      'subname_created',
    ])

    projector.apply({
      type: 'name_released',
      node: parentNode,
      label: 'acme',
      actor: owner,
      previousOwner: owner,
      releasedAt: '2027-07-18T00:00:00.000Z',
    })

    expect(projector.getSubnamesByParent(parentNode)).toEqual([])
    expect(projector.getSubnameByNode(node)).toBeNull()
  })

  it('keeps subname resolver records on the subname node', () => {
    const projector = createLifecycleEventProjector()
    const parentNode = `0x${'28'.repeat(32)}`
    const subnameNode = `0x${'29'.repeat(32)}`
    const owner = `0x${'30'.repeat(32)}`
    const manager = `0x${'31'.repeat(32)}`
    const parentRecord = createResolverRecord(
      'moonlight_address',
      'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
      '2026-06-17T00:00:00.000Z',
    )
    const subnameRecord = createResolverRecord(
      'dusk_contract',
      `0x${'32'.repeat(32)}`,
      '2026-06-17T00:01:00.000Z',
    )

    projector.apply({
      type: 'name_registered',
      node: parentNode,
      label: 'acme',
      actor: owner,
      owner,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })
    projector.applySubname({
      type: 'subname_created',
      parentNode,
      node: subnameNode,
      parentName: 'acme.dusk',
      name: 'settlement.acme.dusk',
      label: 'settlement',
      actor: owner,
      owner,
      manager,
      resolver: `0x${'33'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'inherits_parent',
      revocationPolicy: 'parent_revocable',
      createdAt: '2026-06-17T00:00:30.000Z',
    })
    projector.applyResolver({
      type: 'record_changed',
      node: parentNode,
      controller: owner,
      record: parentRecord,
    })
    projector.applyResolver({
      type: 'record_changed',
      node: subnameNode,
      controller: manager,
      record: subnameRecord,
    })

    expect(projector.getResolverRecords(parentNode)).toEqual([parentRecord])
    expect(projector.getResolverRecords(subnameNode)).toEqual([subnameRecord])
    expect(projector.getSubnamesByParent(parentNode)).toMatchObject([{
      node: subnameNode,
      name: 'settlement.acme.dusk',
      status: 'active',
    }])
    expect(projector.getActivity(subnameNode).map((entry) => [entry.eventType, entry.target])).toEqual([
      ['record_update', 'dusk_contract'],
      ['subname_created', manager],
    ])
  })

  it('does not list expired subnames under active parents', () => {
    const projector = createLifecycleEventProjector()
    const parentNode = `0x${'38'.repeat(32)}`
    const subnameNode = `0x${'39'.repeat(32)}`
    const owner = `0x${'40'.repeat(32)}`

    projector.apply({
      type: 'name_registered',
      node: parentNode,
      label: 'acme',
      actor: owner,
      owner,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })
    projector.applySubname({
      type: 'subname_created',
      parentNode,
      node: subnameNode,
      parentName: 'acme.dusk',
      name: 'settlement.acme.dusk',
      label: 'settlement',
      actor: owner,
      owner,
      manager: owner,
      resolver: `0x${'41'.repeat(32)}`,
      expiresAt: '2025-06-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'fixed_before_parent',
      revocationPolicy: 'parent_revocable',
      createdAt: '2025-05-17T00:00:00.000Z',
    })

    expect(projector.getSubnameByNode(subnameNode)).toBeNull()
    expect(projector.getSubnamesByParent(parentNode)).toEqual([])
  })

  it('clears known descendant subname routing state when a parent is released', () => {
    const projector = createLifecycleEventProjector()
    const parentNode = `0x${'42'.repeat(32)}`
    const subnameNode = `0x${'43'.repeat(32)}`
    const nestedNode = `0x${'44'.repeat(32)}`
    const owner = `0x${'45'.repeat(32)}`
    const endpoint = {
      type: 'moonlight_address' as const,
      value: 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
    }
    const subnameRecord = createResolverRecord(
      'dusk_contract',
      `0x${'46'.repeat(32)}`,
      '2026-06-17T00:01:00.000Z',
    )

    projector.apply({
      type: 'name_registered',
      node: parentNode,
      label: 'acme',
      actor: owner,
      owner,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      feeLux: 10_000_000_000,
    })
    projector.applySubname({
      type: 'subname_created',
      parentNode,
      node: subnameNode,
      parentName: 'acme.dusk',
      name: 'settlement.acme.dusk',
      label: 'settlement',
      actor: owner,
      owner,
      manager: owner,
      resolver: `0x${'47'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'inherits_parent',
      revocationPolicy: 'parent_revocable',
      createdAt: '2026-06-17T00:00:30.000Z',
    })
    projector.applySubname({
      type: 'subname_created',
      parentNode: subnameNode,
      node: nestedNode,
      parentName: 'settlement.acme.dusk',
      name: 'desk.settlement.acme.dusk',
      label: 'desk',
      actor: owner,
      owner,
      manager: owner,
      resolver: `0x${'48'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'inherits_parent',
      revocationPolicy: 'parent_revocable',
      createdAt: '2026-06-17T00:01:30.000Z',
    })
    projector.applyResolver({
      type: 'record_changed',
      node: nestedNode,
      controller: owner,
      record: subnameRecord,
    })
    projector.applyReverse({
      type: 'primary_name_changed',
      endpoint,
      controller: owner,
      node: nestedNode,
      name: 'desk.settlement.acme.dusk',
      previousName: null,
      updatedAt: '2026-06-17T00:02:00.000Z',
    })

    expect(projector.getSubnameByNode(subnameNode)).toMatchObject({ name: 'settlement.acme.dusk' })
    expect(projector.getSubnameByNode(nestedNode)).toMatchObject({ name: 'desk.settlement.acme.dusk' })
    expect(projector.getSubnamesByParent(subnameNode)).toMatchObject([{
      name: 'desk.settlement.acme.dusk',
    }])
    expect(projector.getResolverRecords(nestedNode)).toEqual([subnameRecord])
    expect(projector.getPrimaryNameByEndpoint(endpoint)).toMatchObject({
      name: 'desk.settlement.acme.dusk',
    })

    projector.apply({
      type: 'name_released',
      node: parentNode,
      label: 'acme',
      actor: owner,
      previousOwner: owner,
      releasedAt: '2027-07-18T00:00:00.000Z',
    })

    expect(projector.getSubnameByNode(subnameNode)).toBeNull()
    expect(projector.getSubnameByNode(nestedNode)).toBeNull()
    expect(projector.getSubnamesByParent(parentNode)).toEqual([])
    expect(projector.getResolverRecords(nestedNode)).toEqual([])
    expect(projector.getPrimaryNameByEndpoint(endpoint)).toBeNull()
  })
})
