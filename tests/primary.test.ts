import { expect, it } from 'vitest'
import { primaryNameStatus } from '../src/core/primary.ts'
import { sample, bytes } from './helpers.ts'
import { nameKey } from '../src/frozen/bytes.ts'
function observation() {
  const name = sample('NameView')
  name.name.key = nameKey('example.dusk')
  name.name.expires_at = 200n
  name.active = true
  const endpoint = bytes(5, 96),
    primary = {
      primary: {
        endpoint,
        name: { key: name.name.key, incarnation: name.name.incarnation },
        mapping_id: 1n,
        updated_at: 50n,
      },
      spelling: 'example.dusk',
    }
  return {
    name,
    primary,
    endpoint,
    record: {
      key: 'moonlight_address',
      value: endpoint,
      ttl_seconds: 1n,
      updated_at: 0n,
    },
    height: 100n,
  }
}
it('verifies raw endpoint equality and does not expire records based on TTL', () =>
  expect(primaryNameStatus(observation())).toEqual({
    status: 'verified',
    verified: true,
  }))
it.each([
  'missing',
  'stale',
  'inactive',
  'forward_missing',
  'forward_mismatch',
] as const)('reports protocol status %s without UI copy', (status) => {
  const o = observation()
  if (status === 'missing') o.primary = null as never
  if (status === 'stale') o.name = null as never
  if (status === 'inactive') o.height = 200n
  if (status === 'forward_missing') o.record = null as never
  if (status === 'forward_mismatch') o.record.value = bytes(6, 96)
  expect(primaryNameStatus(o)).toEqual({ status, verified: false })
})
it.each(['generation', 'serial'] as const)(
  'rejects stale primary %s',
  (part) => {
    const o = observation()
    o.primary.primary.name.incarnation = {
      ...o.name.name.incarnation,
      [part]: 500n,
    }
    expect(primaryNameStatus(o).status).toBe('stale')
  },
)
it('binds spelling, mapping endpoint and record key', () => {
  const o = observation()
  o.primary.spelling = 'other.dusk'
  expect(primaryNameStatus(o).status).toBe('stale')
  const p = observation()
  p.primary.primary.endpoint = bytes(9, 96)
  expect(primaryNameStatus(p).status).toBe('stale')
  const r = observation()
  r.record.key = 'custom'
  expect(primaryNameStatus(r).status).toBe('forward_mismatch')
})
