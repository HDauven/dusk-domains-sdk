import { describe, expect, it } from 'vitest'
import {
  createDuskNamesIndexerClient,
} from './internal'

describe('Dusk Names indexer client validation', () => {
  it('rejects malformed lifecycle and subname read models', async () => {
    const client = createDuskNamesIndexerClient({
      baseUrl: '/api/dusk-names',
      fetch: async (url) => {
        if (String(url).includes('/name?')) return Response.json({ node: '0x1' })
        return Response.json([{ node: '0x2' }])
      },
    })

    await expect(client.getNameState('0x1')).rejects.toThrow('invalid name-state response')
    await expect(client.getSubnames('0x1')).rejects.toThrow('invalid subname list response')
  })

  it('rejects name summaries without primary status', async () => {
    const client = createDuskNamesIndexerClient({
      baseUrl: '/api/dusk-names',
      fetch: async () => Response.json([nameSummaryPayload({ primaryStatus: undefined })]),
    })

    await expect(client.getNames({ owner: 'dusk1owner' })).rejects.toThrow('invalid name list response')
  })

  it('rejects name summaries with invalid count fields', async () => {
    const client = createDuskNamesIndexerClient({
      baseUrl: '/api/dusk-names',
      fetch: async () => Response.json([nameSummaryPayload({
        subnameCount: 1.5,
        activityCount: -1,
      })]),
    })

    await expect(client.getNames({ owner: 'dusk1owner' })).rejects.toThrow('invalid name list response')
  })

  it('throws on invalid forward resolution responses', async () => {
    const client = createDuskNamesIndexerClient({
      baseUrl: '/api/dusk-names',
      fetch: async () => Response.json({ canonicalName: 'aurora.dusk' }),
    })

    await expect(client.resolveForward('aurora.dusk')).rejects.toThrow('invalid forward-resolution response')
  })

  it('includes structured indexer error payloads in failed request messages', async () => {
    const client = createDuskNamesIndexerClient({
      baseUrl: '/api/dusk-names',
      fetch: async () => Response.json({ error: 'not_found' }, { status: 404 }),
    })

    await expect(client.getNames()).rejects.toThrow('Dusk Domains indexer request failed with HTTP 404: not_found.')
  })

  it('includes bounded text details in failed request messages', async () => {
    const client = createDuskNamesIndexerClient({
      baseUrl: '/api/dusk-names',
      fetch: async () => new Response(` ${'indexer unavailable '.repeat(20)}`, { status: 503 }),
    })

    await expect(client.getNames()).rejects.toThrow(/^Dusk Domains indexer request failed with HTTP 503: indexer unavailable/)
    await expect(client.getNames()).rejects.toThrow(/\.\.\.\.$/)
  })
})

function nameSummaryPayload(overrides: Record<string, unknown> = {}) {
  return {
    node: `0x${'18'.repeat(32)}`,
    canonicalName: 'aurora.dusk',
    owner: 'dusk1owner',
    manager: 'dusk1manager',
    resolverId: `0x${'44'.repeat(32)}`,
    expiresAt: '2027-06-17T00:00:00.000Z',
    graceEndsAt: '2027-07-17T00:00:00.000Z',
    status: 'active',
    lastEventType: 'name_registered',
    records: [],
    primaryName: 'aurora.dusk',
    primaryStatus: 'verified',
    subnameCount: 1,
    activityCount: 1,
    ...overrides,
  }
}
