import { expect, it } from 'vitest'
import { createDuskDomainsIndexerClient } from './indexerClient'
import { createLifecycleEventProjector } from './lifecycleProjector'
import { isLifecycleEventType, isDuskDomainsIndexedEventType } from './events/indexerEventCatalog'
import type { NameLifecycleEvent } from './indexerTypes'

it('projects reserved issuance provenance through renewal and transfer, resetting it on registration', () => {
  const projector = createLifecycleEventProjector()
  const registration: NameLifecycleEvent = { type: 'name_registered', node: 'node', label: 'wallet', actor: 'router', owner: 'owner', expiresAt: '2027-01-01T00:00:00Z', graceEndsAt: '2027-02-01T00:00:00Z', feeLux: 0 }
  const issuance: NameLifecycleEvent = { type: 'reserved_name_issued', node: 'node', label: 'wallet', actor: 'operator', owner: 'owner', manager: 'manager', registry: 'registry', operator: { kind: 'Contract', bytes: Array(32).fill(1) }, issuedAt: '2026-01-01T00:00:00Z', issuedAtBlockHeight: 100 }
  expect(isLifecycleEventType(issuance.type)).toBe(true)
  expect(isDuskDomainsIndexedEventType(issuance.type)).toBe(true)
  projector.apply(registration)
  projector.apply(issuance)
  expect(projector.getNameByNode('node')).toMatchObject({ issuedAsReserved: true, reservedIssuance: { operator: issuance.operator, registry: 'registry', issuedAtBlockHeight: 100 }, owner: 'owner' })
  projector.apply({ type: 'name_renewed', node: 'node', actor: 'owner', expiresAt: '2028-01-01T00:00:00Z', graceEndsAt: '2028-02-01T00:00:00Z', feeLux: 10 })
  projector.apply({ type: 'name_owner_changed', node: 'node', actor: 'owner', previousOwner: 'owner', owner: 'next', manager: 'next', resolver: 'resolver', expiresAt: '2028-01-01T00:00:00Z' })
  expect(projector.getNameByNode('node')).toMatchObject({ issuedAsReserved: true, owner: 'next', reservedIssuance: { operator: issuance.operator } })
  projector.apply(registration)
  expect(projector.getNameByNode('node')).toMatchObject({ issuedAsReserved: false, reservedIssuance: null })
})

it('reads issuance provenance and rejects malformed provenance while accepting older name responses', async () => {
  const name = { node: 'node', canonicalName: 'wallet.dusk', owner: 'owner', manager: 'manager', resolverId: null, expiresAt: null, graceEndsAt: null, status: 'active', lastEventType: 'name_registered' }
  const provenance = { operator: { kind: 'Contract', bytes: Array(32).fill(1) }, registry: 'registry', issuedAt: '2026-01-01T00:00:00Z', issuedAtBlockHeight: 100 }
  let response: object = name
  const client = createDuskDomainsIndexerClient({ baseUrl: '/indexer', fetch: async () => Response.json(response) })
  await expect(client.getNameState('node')).resolves.toEqual(name)
  response = { ...name, issuedAsReserved: true, reservedIssuance: provenance }
  await expect(client.getNameState('node')).resolves.toMatchObject({ issuedAsReserved: true, reservedIssuance: provenance })
  for (const invalid of [{ issuedAsReserved: 'yes' }, { reservedIssuance: { ...provenance, operator: 'invalid' } }, { reservedIssuance: { ...provenance, issuedAtBlockHeight: '100' } }]) {
    response = { ...name, ...invalid }
    await expect(client.getNameState('node')).rejects.toThrow('invalid name-state response')
  }
})
