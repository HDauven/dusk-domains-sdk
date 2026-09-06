import { describe, expect, it } from 'vitest'
import * as source from './indexerEventCatalog'
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
