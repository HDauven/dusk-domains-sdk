import { expect, it } from 'vitest'
import { createLifecycleEventProjector } from './lifecycleProjector'
import { activityLabel } from './activity'
import { createRecentChangeWarnings } from './indexerWarnings'
import { collectSnapshotControllers } from '../projection/projectors/records.mjs'

it('distinguishes setting, replacing and clearing a primary name while keeping its address', () => {
  const projector = createLifecycleEventProjector()
  const node = `0x${'14'.repeat(32)}`
  const endpoint = { type: 'moonlight_address' as const, value: 'dusk1abcdefghijklmnopqrst' }
  const updatedAt = '2026-06-18T00:00:00.000Z'
  for (const [name, previousName] of [['aurora.dusk', null], ['other.dusk', 'aurora.dusk'], ['', 'other.dusk']] as const) {
    projector.applyReverse({ type: 'primary_name_changed', endpoint, node, controller: 'owner', name, previousName, updatedAt })
  }
  const activity = projector.getActivity(node)
  expect(activity.map(entry => [entry.eventType, entry.name, entry.target])).toEqual([
    ['primary_name_cleared', 'other.dusk', `moonlight_address:${endpoint.value}`],
    ['primary_name_set', 'other.dusk', `moonlight_address:${endpoint.value}`],
    ['primary_name_set', 'aurora.dusk', `moonlight_address:${endpoint.value}`],
  ])
  expect(projector.getPrimaryNameByEndpoint(endpoint)).toBeNull()
  expect(activity.map(entry => activityLabel(entry.eventType))).toEqual(['Primary name cleared', 'Primary name set', 'Primary name set'])
  expect(createRecentChangeWarnings(activity, { now: new Date(updatedAt) }).map(warning => warning.code)).toEqual([
    'recent_primary_name_change', 'recent_primary_name_change', 'recent_primary_name_change',
  ])
  expect(collectSnapshotControllers({ activity })).toEqual(new Set(['owner']))
})

it.each(['address.btc', 'address.eth', 'address.sol', 'address.evm'])('keeps payment-change warnings for %s', target => {
  const now = new Date('2026-06-18T00:00:00.000Z')
  expect(createRecentChangeWarnings([{ id: target, eventType: 'record_update', node: 'node', name: 'aurora.dusk', actor: 'owner',
    timestamp: now.toISOString(), blockHeight: 1, target }], { now })).toMatchObject([{ code: 'recent_high_risk_record_change', target }])
})
