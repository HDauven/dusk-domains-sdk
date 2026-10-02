import { describe, expect, it, vi } from 'vitest'
import { createLifecycleEventProjector } from './indexer'
import { createResolverRecord } from '../core/records'
import type { SubnameExpiryPolicy } from '../core/subnames'

describe('Dusk Domains lifecycle event projector subnames', () => {
  it('replays fresh children with linear map work and no cleanup', () => {
    const replay = (parents: number) => {
      const projector = createLifecycleEventProjector()
      const work = measureMapWork(() => {
        for (let p = 0; p < parents; p++) {
          const root = `root${p}`
          projector.apply(rootRegistered(root))
          for (let c = 0; c < 64; c++) {
            projector.applySubname(subnameCreated(root, `${root}-child${c}`, `child${c}.acme.dusk`,
              'inherits_parent', '2040-06-17T00:00:00.000Z', 1000))
          }
        }
      })
      expect(projector.getSubnamesByParent(`root${parents - 1}`)).toHaveLength(64)
      return work
    }
    const small = replay(100)
    const large = replay(200)
    expect(large.scanned).toBe(0)
    expect(large.deleted).toBe(0)
    expect(large.lookups).toBeLessThanOrEqual(small.lookups * 2.1)
  }, 60_000)

  it('projects subname creation and expired subtree pruning by parent node', () => {
    const projector = createLifecycleEventProjector()
    const parentNode = `0x${'18'.repeat(32)}`
    const node = `0x${'19'.repeat(32)}`
    const owner = `0x${'20'.repeat(32)}`
    const manager = `0x${'21'.repeat(32)}`

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
      expiresAt: '2027-05-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'fixed_before_parent',
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
      type: 'subname_pruned',
      parentNode,
      node,
      name: 'settlement.acme.dusk',
      actor: owner,
      prunedAt: '2027-05-17T00:00:00.000Z',
    }, { txId: 'tx-prune', blockHeight: 72 })

    expect(projector.getSubnameByNode(node)).toBeNull()
    expect(projector.getSubnamesByParent(parentNode)).toEqual([])
    expect(projector.getActivity(parentNode).map((entry) => [entry.eventType, entry.name])).toEqual([
      ['subname_pruned', 'settlement.acme.dusk'],
      ['subname_created', 'settlement.acme.dusk'],
      ['registration', 'acme.dusk'],
    ])
    expect(projector.getActivity(node).map((entry) => entry.eventType)).toEqual([
      'subname_pruned',
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

  it('reports a subname grace end from its parent', () => {
    const projector = createLifecycleEventProjector()
    const rootNode = `0x${'50'.repeat(32)}`
    const childNode = `0x${'51'.repeat(32)}`
    const nestedNode = `0x${'52'.repeat(32)}`

    projector.apply(rootRegistered(rootNode))
    projector.applySubname(subnameCreated(rootNode, childNode, 'settlement.acme.dusk', 'fixed_before_parent', '2040-03-01T00:00:00.000Z', 900))
    projector.applySubname(subnameCreated(childNode, nestedNode, 'desk.settlement.acme.dusk', 'inherits_parent', '2040-03-01T00:00:00.000Z', 900))

    for (const node of [childNode, nestedNode]) {
      expect(projector.getSubnameByNode(node)).toMatchObject({
        graceEndsAt: '2040-07-17T00:00:00.000Z',
        graceEndsAtBlockHeight: 1_300,
      })
    }
  })

  it('renews subnames that inherit their root expiry, down to a fixed subname', () => {
    const projector = createLifecycleEventProjector()
    const rootNode = `0x${'53'.repeat(32)}`
    const childNode = `0x${'54'.repeat(32)}`
    const grandchildNode = `0x${'55'.repeat(32)}`
    const fixedNode = `0x${'56'.repeat(32)}`
    const belowFixedNode = `0x${'57'.repeat(32)}`

    projector.apply(rootRegistered(rootNode))
    projector.applySubname(subnameCreated(rootNode, childNode, 'settlement.acme.dusk', 'inherits_parent', '2040-06-17T00:00:00.000Z', 1_000))
    projector.applySubname(subnameCreated(childNode, grandchildNode, 'desk.settlement.acme.dusk', 'inherits_parent', '2040-06-17T00:00:00.000Z', 1_000))
    projector.applySubname(subnameCreated(rootNode, fixedNode, 'vault.acme.dusk', 'fixed_before_parent', '2040-03-01T00:00:00.000Z', 900))
    projector.applySubname(subnameCreated(fixedNode, belowFixedNode, 'desk.vault.acme.dusk', 'inherits_parent', '2040-03-01T00:00:00.000Z', 900))
    projector.apply(rootRenewed(rootNode))

    const unchanged = {
      expiresAt: '2040-03-01T00:00:00.000Z',
      graceEndsAt: '2040-07-17T00:00:00.000Z',
      expiresAtBlockHeight: 900,
      graceEndsAtBlockHeight: 1_300,
    }
    expect(projector.getSubnameByNode(childNode)).toMatchObject(renewed)
    expect(projector.getSubnameByNode(grandchildNode)).toMatchObject(renewed)
    expect(projector.getSubnameByNode(fixedNode)).toMatchObject(unchanged)
    expect(projector.getSubnameByNode(belowFixedNode)).toMatchObject(unchanged)
    for (const node of [childNode, grandchildNode, fixedNode]) {
      expect(projector.getSubnameByNode(node)).toMatchObject({
        parentExpiresAt: renewed.expiresAt, parentExpiresAtBlockHeight: renewed.expiresAtBlockHeight,
      })
    }
    expect(projector.getSubnameByNode(belowFixedNode)?.parentExpiresAt).not.toBe(renewed.expiresAt)
  })

  it('renews an inheriting subname after an authority change without creating a root row', () => {
    const projector = createLifecycleEventProjector()
    const rootNode = `0x${'58'.repeat(32)}`
    const childNode = `0x${'59'.repeat(32)}`
    const nestedNode = `0x${'5a'.repeat(32)}`

    projector.apply(rootRegistered(rootNode))
    projector.applySubname(subnameCreated(rootNode, childNode, 'settlement.acme.dusk', 'inherits_parent', '2040-06-17T00:00:00.000Z', 1_000))
    projector.apply(subnameAuthoritiesChanged(childNode, '2040-06-17T00:00:00.000Z', 1_000))
    projector.applySubname(subnameCreated(childNode, nestedNode, 'desk.settlement.acme.dusk', 'inherits_parent', '2040-06-17T00:00:00.000Z', 1_000))

    for (const lifecycle of [projector.getSubnameByNode(childNode), projector.getSubnameByNode(nestedNode)]) {
      expect(lifecycle).toMatchObject({
        graceEndsAt: '2040-07-17T00:00:00.000Z',
        graceEndsAtBlockHeight: 1_300,
      })
    }

    projector.apply(rootRenewed(rootNode))

    expect(projector.getNameByNode(childNode)).toBeNull()
    expect(projector.getSubnameByNode(childNode)).toMatchObject(renewed)
    expect(projector.getSubnameByNode(nestedNode)).toMatchObject(renewed)
  })

  it.each(['recreate', 'prune'])('clears old subname records, authorities, descendants and primary names on %s', (action) => {
    const projector = createLifecycleEventProjector()
    const root = 'root'
    const child = 'child'
    const leaf = 'leaf'
    const oldExpiry = '2020-06-17T00:00:00.000Z'
    projector.apply(rootRegistered(root))
    const created = subnameCreated(root, child, 'pay.acme.dusk', 'fixed_before_parent', oldExpiry, 100)
    projector.applySubname(created)
    projector.applySubname(subnameCreated(child, leaf, 'tip.pay.acme.dusk', 'inherits_parent', oldExpiry, 100))
    const endpoint = { type: 'moonlight_address' as const, value: 'old-account' }
    for (const node of [child, leaf]) {
      projector.apply(subnameAuthoritiesChanged(node, oldExpiry, 100))
      projector.applyResolver({ type: 'record_changed', node, controller: owner,
        record: createResolverRecord('website', 'https://old.example', '2020-01-01T00:00:00.000Z') })
      projector.applyReverse({ type: 'primary_name_changed', node, endpoint: { ...endpoint, value: node },
        controller: owner, name: node, previousName: null, updatedAt: oldExpiry })
    }
    if (action === 'recreate') {
      projector.applySubname({ ...created, owner: 'new-owner', manager: 'new-manager',
        expiresAt: '2040-06-17T00:00:00.000Z', expiresAtBlockHeight: 1000 })
      expect(projector.getSubnameByNode(child)).toMatchObject({ owner: 'new-owner', manager: 'new-manager' })
    } else {
      expect(projector.applySubname({ type: 'subname_pruned', parentNode: root, node: child,
        name: created.name, actor: owner, prunedAt: oldExpiry })).toBeNull()
      expect(projector.getSubnameByNode(child)).toBeNull()
    }
    projector.apply(rootRenewed(root))
    expect(projector.getSubnameByNode(leaf)).toBeNull()
    for (const node of [child, leaf]) {
      expect(projector.getNameByNode(node)).toBeNull()
      expect(projector.getResolverRecords(node)).toEqual([])
      expect(projector.getPrimaryNameByEndpoint({ ...endpoint, value: node })).toBeNull()
    }
  })

  it.each(['recreate', 'prune', 'reregister', 'release'])('cleans only indexed descendants and primary names on %s', (action) => {
    const projector = createLifecycleEventProjector()
    const root = 'root'
    const child = 'child'
    const leaf = 'leaf'
    const sibling = 'sibling'
    const expiry = '2040-06-17T00:00:00.000Z'
    const createChild = () => projector.applySubname(subnameCreated(root, child, 'pay.acme.dusk', 'inherits_parent', expiry, 1000))
    const createLeaf = () => projector.applySubname(subnameCreated(child, leaf, 'tip.pay.acme.dusk', 'inherits_parent', expiry, 1000))
    const primary = (node: string, value: string, name: string | null = node) => projector.applyReverse({
      type: 'primary_name_changed', node, endpoint: { type: 'moonlight_address', value },
      controller: owner, name, previousName: null, updatedAt: expiry,
    })
    const getPrimary = (value: string) => projector.getPrimaryNameByEndpoint({ type: 'moonlight_address', value })
    projector.apply(rootRegistered(root))
    projector.apply(rootRegistered(sibling))
    createChild()
    createLeaf()
    for (const node of [root, child, leaf, sibling]) primary(node, node)
    primary(child, 'moved')
    primary(sibling, 'moved')
    primary(leaf, 'cleared')
    // Clears identify the endpoint; their node need not be the previous node.
    primary(sibling, 'cleared', null)
    const work = measureMapWork(() => {
      if (action === 'recreate') createChild()
      else if (action === 'prune') projector.applySubname({ type: 'subname_pruned', parentNode: root,
        node: child, name: 'pay.acme.dusk', actor: owner, prunedAt: expiry })
      else if (action === 'reregister') projector.apply(rootRegistered(root))
      else projector.apply({ type: 'name_released', node: root, label: 'acme', actor: owner,
        previousOwner: owner, releasedAt: expiry })
    })
    expect(work.scanned).toBe(0)
    expect(getPrimary('child')).toBeNull()
    expect(getPrimary('leaf')).toBeNull()
    expect(getPrimary('cleared')).toBeNull()
    expect(getPrimary('moved')?.node).toBe(sibling)
    expect(getPrimary('sibling')?.node).toBe(sibling)
    expect(getPrimary('root')?.node ?? null).toBe(['recreate', 'prune'].includes(action) ? root : null)
    expect(projector.getSubnamesByParent(child)).toEqual([])
    expect(projector.getSubnamesByParent(root).map((subname) => subname.node)).toEqual(action === 'recreate' ? [child] : [])
    if (action === 'release') projector.apply(rootRegistered(root))
    createChild()
    createLeaf()
    primary(leaf, 'again')
    projector.apply(rootRegistered(root))
    expect(projector.getSubnamesByParent(root)).toEqual([])
    expect(projector.getSubnamesByParent(child)).toEqual([])
    expect(getPrimary('again')).toBeNull()
    projector.apply(rootRegistered(sibling))
    expect(getPrimary('moved')).toBeNull()
  })

  it('drops a lapsed name\'s subnames when the name is registered again', () => {
    const projector = createLifecycleEventProjector()
    const rootNode = `0x${'5b'.repeat(32)}`
    const childNode = `0x${'5c'.repeat(32)}`
    const endpoint = {
      type: 'moonlight_address' as const,
      value: 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
    }
    const lapsedRecord = createResolverRecord('dusk_contract', `0x${'5d'.repeat(32)}`, '2020-01-01T00:00:00.000Z')
    const nextRecord = createResolverRecord('moonlight_address', endpoint.value, '2026-06-17T00:00:00.000Z')

    projector.apply({
      ...rootRegistered(rootNode),
      expiresAt: '2020-06-17T00:00:00.000Z',
      graceEndsAt: '2020-07-17T00:00:00.000Z',
      expiresAtBlockHeight: 100,
      graceEndsAtBlockHeight: 130,
    })
    projector.applySubname(subnameCreated(rootNode, childNode, 'settlement.acme.dusk', 'inherits_parent', '2020-06-17T00:00:00.000Z', 100))
    projector.apply(subnameAuthoritiesChanged(childNode, '2020-06-17T00:00:00.000Z', 100))
    projector.applyResolver({ type: 'record_changed', node: rootNode, controller: owner, record: lapsedRecord })
    projector.applyResolver({ type: 'record_changed', node: childNode, controller: owner, record: lapsedRecord })
    projector.applyReverse({
      type: 'primary_name_changed',
      endpoint,
      controller: owner,
      node: childNode,
      name: 'settlement.acme.dusk',
      previousName: null,
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    // The contract clears the lapsed name without a name_released event, then registers it.
    projector.apply(rootRegistered(rootNode))
    projector.applyResolver({ type: 'record_changed', node: rootNode, controller: owner, record: nextRecord })
    projector.apply(rootRenewed(rootNode))

    expect(projector.getSubnameByNode(childNode)).toBeNull()
    expect(projector.getSubnamesByParent(rootNode)).toEqual([])
    expect(projector.getNameByNode(childNode)).toBeNull()
    expect(projector.getResolverRecords(rootNode)).toEqual([nextRecord])
    expect(projector.getResolverRecords(childNode)).toEqual([])
    expect(projector.getPrimaryNameByEndpoint(endpoint)).toBeNull()
  })
})

const owner = `0x${'4f'.repeat(32)}`
const renewed = {
  expiresAt: '2041-06-17T00:00:00.000Z',
  graceEndsAt: '2041-07-17T00:00:00.000Z',
  expiresAtBlockHeight: 2_000,
  graceEndsAtBlockHeight: 2_300,
}

function rootRegistered(node: string) {
  return {
    type: 'name_registered' as const,
    node,
    label: 'acme',
    actor: owner,
    owner,
    expiresAt: '2040-06-17T00:00:00.000Z',
    graceEndsAt: '2040-07-17T00:00:00.000Z',
    expiresAtBlockHeight: 1_000,
    graceEndsAtBlockHeight: 1_300,
    feeLux: 10_000_000_000,
  }
}

function subnameCreated(
  parentNode: string,
  node: string,
  name: string,
  expiryPolicy: SubnameExpiryPolicy,
  expiresAt: string,
  expiresAtBlockHeight: number,
) {
  const [label, ...parentLabels] = name.split('.')
  return {
    type: 'subname_created' as const,
    parentNode,
    node,
    parentName: parentLabels.join('.'),
    name,
    label,
    actor: owner,
    owner,
    manager: owner,
    resolver: `0x${'4e'.repeat(32)}`,
    expiresAt,
    parentExpiresAt: '2040-06-17T00:00:00.000Z',
    expiresAtBlockHeight,
    parentExpiresAtBlockHeight: 1_000,
    expiryPolicy,
    createdAt: '2026-06-17T00:00:00.000Z',
  }
}

function rootRenewed(node: string) {
  return {
    type: 'name_renewed' as const,
    node,
    actor: owner,
    ...renewed,
    feeLux: 10_000_000_000,
  }
}

// The contract reports a subname's authority change as a name_owner_changed on its node.
function subnameAuthoritiesChanged(node: string, expiresAt: string, expiresAtBlockHeight: number) {
  return {
    type: 'name_owner_changed' as const,
    node,
    actor: owner,
    previousOwner: owner,
    owner,
    manager: `0x${'4d'.repeat(32)}`,
    resolver: `0x${'00'.repeat(32)}`,
    expiresAt,
    expiresAtBlockHeight,
  }
}

// Count map work instead of asserting a machine-dependent wall-clock threshold.
function measureMapWork(action: () => void) {
  const work = { scanned: 0, deleted: 0, lookups: 0 }
  const values = Map.prototype.values
  const entries = Map.prototype[Symbol.iterator]
  const get = Map.prototype.get
  const remove = Map.prototype.delete
  const spies = [
    vi.spyOn(Map.prototype, 'values').mockImplementation(function* (this: Map<unknown, unknown>) {
      for (const value of values.call(this)) { work.scanned++; yield value }
    }),
    vi.spyOn(Map.prototype, Symbol.iterator).mockImplementation(function* (this: Map<unknown, unknown>) {
      for (const entry of entries.call(this)) { work.scanned++; yield entry }
    }),
    vi.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<unknown, unknown>, key: unknown) {
      work.lookups++
      return get.call(this, key)
    }),
    vi.spyOn(Map.prototype, 'delete').mockImplementation(function (this: Map<unknown, unknown>, key: unknown) {
      work.deleted++
      return remove.call(this, key)
    }),
  ]
  try { action() } finally { for (const spy of spies) spy.mockRestore() }
  return work
}
