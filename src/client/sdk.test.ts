import { describe, expect, it } from 'vitest'
import {
  createDuskNamesClient,
  type DuskEndpoint,
  type DuskNamesReadTransport,
  type DuskNamesWriteTransport,
} from './sdk'
import type { ForwardResolutionResponse } from '../indexer/indexer'

const endpoint: DuskEndpoint = {
  type: 'moonlight_address',
  value: 'dusk1localresolverproof01',
}

describe('Dusk Names SDK primary-name verification', () => {
  it('verifies the reverse name and matching forward record', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: 'aurora.dusk',
        forwardRecordValue: endpoint.value,
      }),
    })

    await expect(client.verifyPrimaryName(endpoint, 'aurora.dusk')).resolves.toMatchObject({
      ok: true,
      value: {
        endpoint,
        primaryName: 'aurora.dusk',
        verified: true,
      },
    })
  })

  it('rejects an expected name that is not the endpoint reverse record', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: 'alice.dusk',
        forwardRecordValue: endpoint.value,
      }),
    })

    await expect(client.verifyPrimaryName(endpoint, 'aurora.dusk')).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'forward_reverse_mismatch',
      },
    })
  })

  it('falls back to the raw endpoint display when reverse lookup is missing', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
    })

    await expect(client.getDisplayName(endpoint)).resolves.toMatchObject({
      display: endpoint.value,
      raw: endpoint.value,
      verified: false,
      reason: {
        code: 'reverse_missing',
      },
    })
  })

  it('rejects forward records that do not match the reverse endpoint', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: 'aurora.dusk',
        forwardRecordValue: 'dusk1localresolverproof02',
      }),
    })

    await expect(client.verifyPrimaryName(endpoint)).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'forward_reverse_mismatch',
      },
    })
  })
})

describe('Dusk Names SDK write intents', () => {
  it('prepares batch record mutations through the write transport', async () => {
    const calls: Array<{ canonicalName: string; mutations: unknown[] }> = []
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
      write: writeTransport({
        async mutateRecords(canonicalName, mutations) {
          calls.push({ canonicalName, mutations })
          return { id: 'mutate-records-1', status: 'prepared' }
        },
      }),
    })

    await expect(client.mutateRecords('Aurora.dusk', [
      { action: 'set', key: 'website', value: 'https://dusk.domains' },
      { action: 'clear', key: 'avatar' },
    ])).resolves.toEqual({
      ok: true,
      value: {
        id: 'mutate-records-1',
        status: 'prepared',
      },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      canonicalName: 'aurora.dusk',
      mutations: [
        {
          action: 'set',
          record: {
            key: 'website',
            value: 'https://dusk.domains',
            ttlSeconds: 3600,
          },
        },
        { action: 'clear', key: 'avatar' },
      ],
    })
  })

  it('rejects duplicate batch record keys before calling the write transport', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
      write: writeTransport({
        async mutateRecords() {
          throw new Error('mutateRecords should not be called')
        },
      }),
    })

    await expect(client.mutateRecords('aurora.dusk', [
      { action: 'set', key: 'website', value: 'https://dusk.domains' },
      { action: 'clear', key: 'website' },
    ])).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'invalid_record',
      },
    })
  })

  it('reports missing batch-record write transport support', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
      write: writeTransport(),
    })

    await expect(client.mutateRecords('aurora.dusk', [
      { action: 'set', key: 'website', value: 'https://dusk.domains' },
    ])).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'write_transport_missing',
      },
    })
  })

  it('prepares clear-record intents through the write transport', async () => {
    const calls: Array<{ canonicalName: string; key: string }> = []
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
      write: writeTransport({
        async clearRecord(canonicalName, key) {
          calls.push({ canonicalName, key })
          return { id: 'clear-record-1', status: 'prepared' }
        },
      }),
    })

    await expect(client.clearRecord('Aurora.dusk', 'website')).resolves.toEqual({
      ok: true,
      value: {
        id: 'clear-record-1',
        status: 'prepared',
      },
    })
    expect(calls).toEqual([{ canonicalName: 'aurora.dusk', key: 'website' }])
  })

  it('rejects unsupported clear-record keys before calling the write transport', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
      write: writeTransport({
        async clearRecord() {
          throw new Error('clearRecord should not be called')
        },
      }),
    })

    await expect(client.clearRecord('aurora.dusk', 'profile*url' as never)).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'invalid_record',
      },
    })
  })

  it('reports missing clear-record write transport support', async () => {
    const client = createDuskNamesClient({
      read: readTransport({
        primaryName: null,
        forwardRecordValue: endpoint.value,
      }),
      write: writeTransport(),
    })

    await expect(client.clearRecord('aurora.dusk', 'website')).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'write_transport_missing',
      },
    })
  })
})

function readTransport(args: {
  primaryName: string | null
  forwardRecordValue: string
}): DuskNamesReadTransport {
  return {
    async getPrimaryName() {
      return args.primaryName
    },
    async resolveForward(canonicalName) {
      return forwardResponse(canonicalName, args.forwardRecordValue)
    },
  }
}

function writeTransport(overrides: Partial<DuskNamesWriteTransport> = {}): DuskNamesWriteTransport {
  return {
    async setRecord() {
      return { id: 'set-record', status: 'prepared' }
    },
    async setPrimaryName() {
      return { id: 'set-primary-name', status: 'prepared' }
    },
    ...overrides,
  }
}

function forwardResponse(canonicalName: string, recordValue: string): ForwardResolutionResponse {
  return {
    canonicalName,
    node: `0x${'11'.repeat(32)}`,
    records: [{
      key: 'moonlight_address',
      value: recordValue,
      ttlSeconds: 300,
      updatedAt: '2026-06-18T00:00:00.000Z',
      visibility: 'public',
    }],
    resolver: {
      resolverId: `0x${'22'.repeat(32)}`,
      health: 'ok',
    },
    expiry: {
      status: 'active',
      expiresAt: '2027-06-18T00:00:00.000Z',
    },
    cache: {
      asOf: '2026-06-18T00:00:00.000Z',
      ttlSeconds: 300,
      staleAt: '2026-06-18T00:05:00.000Z',
    },
    warnings: [],
    verificationStatus: 'forward_resolved',
    errors: [],
  }
}
