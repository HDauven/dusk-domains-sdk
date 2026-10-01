import { describe, expect, it } from 'vitest'
import * as source from './indexerEventCatalog.ts'
import * as generated from './indexerEventCatalog.mjs'

describe('generated plain-Node event catalog', () => {
  it('matches every TypeScript export and keeps all event arrays frozen', () => {
    expect(Object.keys(generated).sort()).toEqual(Object.keys(source).sort())
    const events = [...source.duskDomainsIndexedEventTypes, 'unknown_event', '']

    for (const key of Object.keys(source) as Array<keyof typeof source>) {
      const expected = source[key]
      const actual = generated[key]
      if (typeof expected === 'function' && typeof actual === 'function') {
        for (const event of events) expect(actual(event)).toBe(expected(event))
      } else {
        expect(actual).toEqual(expected)
        expect(Object.isFrozen(actual)).toBe(true)
        expect(Object.isFrozen(expected)).toBe(true)
      }
    }
  })
})

it('limits v1 subname events to creation and expiry cleanup', () => {
  expect(generated.subnameEventTypes).toEqual(['subname_created', 'subname_pruned'])
})

it('separates retired contract topics from supported events without retiring router fee updates', () => {
  const expected = {
    router: [],
    core: ['core_referral_config_changed', 'fee_config_updated', 'subname_delegated', 'subname_revoked'],
    treasury: [],
    marketplace: [],
  }
  expect(source.duskDomainsRetiredContractEventTopics).toEqual(expected)
  expect(generated.duskDomainsRetiredContractEventTopics).toEqual(expected)
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    const retired = generated.duskDomainsRetiredContractEventTopics[key]
    expect(Object.isFrozen(retired)).toBe(true)
    expect(retired.some(topic => generated.duskDomainsContractEventTopics[key].includes(topic))).toBe(false)
  }
  expect(generated.duskDomainsContractEventTopics.router).toContain('fee_config_updated')
  expect(generated.isDuskDomainsIndexedEventType('unknown_event')).toBe(false)
})
