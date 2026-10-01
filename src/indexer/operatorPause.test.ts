import { expect, it } from 'vitest'
import { applyDuskDomainsIndexedEvent, createDuskDomainsProjector, isDuskDomainsIndexedEventType, type DuskDomainsIndexedEvent } from './indexerKit'
import { isIndexerHealth, isIndexedMarketplaceConfig } from './indexerClientGuards'

it('projects both pause flags independently, including resume, without changing operator proposals', () => {
  const projector = createDuskDomainsProjector()
  const operator = { kind: 'Contract', bytes: Array(32).fill(1) }
  const apply = (event: object) => applyDuskDomainsIndexedEvent(projector, { event: event as DuskDomainsIndexedEvent, meta: { blockHeight: 42, txId: 'pause' } })
  expect(projector.getPoolState().registrationsPaused).toBe(false)
  expect(projector.getMarketplaceConfig().tradingPaused).toBe(false)
  apply({ type: 'router_operator_proposed', operator, pendingOperator: operator })
  apply({ type: 'marketplace_operator_proposed', operator: 'owner', pendingOperator: 'next' })
  for (const paused of [true, false]) {
    for (const type of ['registrations_paused_changed', 'trading_paused_changed']) {
      expect(isDuskDomainsIndexedEventType(type)).toBe(true)
      apply({ type, paused, operator: type === 'trading_paused_changed' ? 'owner' : operator, updatedAtBlockHeight: 42 })
    }
    expect(projector.getPoolState()).toMatchObject({ registrationsPaused: paused, pendingOperator: operator, blockHeight: 42 })
    expect(projector.getMarketplaceConfig()).toMatchObject({ tradingPaused: paused, pendingOperator: 'next', updatedAtBlockHeight: 42 })
  }
  expect(isIndexedMarketplaceConfig({ ...projector.getMarketplaceConfig(), tradingPaused: 'false' })).toBe(false)
})

it('validates health pause flags without rejecting older health responses', () => {
  const health = { ok: true, generatedAt: '', source: '', mode: '', currentBlockHeight: 1, routes: [], names: 0 }
  expect(isIndexerHealth(health)).toBe(true)
  expect(isIndexerHealth({ ...health, pause: { registrationsPaused: true, tradingPaused: false } })).toBe(true)
  for (const pause of [null, {}, { registrationsPaused: 'true', tradingPaused: false }]) expect(isIndexerHealth({ ...health, pause })).toBe(false)
})
