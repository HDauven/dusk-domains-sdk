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
