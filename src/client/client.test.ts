import { describe, expect, it } from 'vitest'
import {
  createDuskDomainsClient,
  createDuskDomainsClientFromManifest,
  createDuskDomainsIndexerClient,
  createDuskDomainsOnChainClient,
  checkDuskDomainsIndexerCompatibilityFromHealth,
} from './client'
import {
  endpointValue,
  fakeIndexer,
  fakeOnChain,
  forwardResponse,
  indexedNameSummary,
  node,
  releaseManifest,
} from './client.test-fixtures'

describe('Dusk Domains SDK mode packaging', () => {
  it('exposes Dusk Domains on-chain and indexer clients', () => {
    expect(typeof createDuskDomainsOnChainClient).toBe('function')
    expect(typeof createDuskDomainsIndexerClient).toBe('function')
  })

  it('resolves known names through the indexer mode when available', async () => {
    const client = createDuskDomainsClient({
      indexer: fakeIndexer({
        async resolveForward() {
          return forwardResponse(endpointValue)
        },
      }),
    })

    await expect(client.resolveName('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: true,
      value: {
        canonicalName: 'aurora.dusk',
        node,
        endpoint: {
          type: 'moonlight_address',
          value: endpointValue,
        },
      },
    })
  })

  it('uses canonical on-chain reads for known-name resolution when the indexer is unavailable', async () => {
    const client = createDuskDomainsClient({
      indexer: fakeIndexer({
        async resolveForward() {
          throw new Error('indexer unavailable')
        },
      }),
      onChain: fakeOnChain({
        async resolveName(name, key) {
          return {
            ok: true,
            value: {
              canonicalName: name,
              node,
              endpoint: {
                type: key === 'dusk_public_address' ? 'moonlight_address' : key ?? 'moonlight_address',
                value: endpointValue,
              },
              record: {
                key: 'moonlight_address',
                value: endpointValue,
                visibility: 'public',
                ttlSeconds: 300,
                updatedAtBlock: 123,
              },
            },
          }
        },
      }),
    })

    await expect(client.resolveName('aurora.dusk', 'dusk_public_address')).resolves.toMatchObject({
      ok: true,
      value: {
        endpoint: {
          type: 'moonlight_address',
          value: endpointValue,
        },
      },
    })
  })

  it('does not hide canonical missing-name failures behind indexed state', async () => {
    const client = createDuskDomainsClient({
      indexer: fakeIndexer({
        async resolveForward() {
          return forwardResponse(endpointValue)
        },
      }),
      onChain: fakeOnChain({
        async resolveName() {
          return {
            ok: false,
            error: {
              code: 'missing_name',
              message: 'aurora.dusk is not registered.',
            },
          }
        },
      }),
    })

    await expect(client.resolveName('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'missing_name',
      },
    })
  })

  it('prefers canonical on-chain reads when both read paths are configured', async () => {
    const client = createDuskDomainsClient({
      indexer: fakeIndexer({
        async resolveForward() {
          return forwardResponse('dusk1indexed')
        },
      }),
      onChain: fakeOnChain({
        async resolveName(name, key) {
          return {
            ok: true,
            value: {
              canonicalName: name,
              node,
              endpoint: {
                type: key === 'dusk_public_address' ? 'moonlight_address' : key ?? 'moonlight_address',
                value: endpointValue,
              },
              record: {
                key: 'moonlight_address',
                value: endpointValue,
                visibility: 'public',
                ttlSeconds: 300,
                updatedAtBlock: 123,
              },
            },
          }
        },
      }),
    })

    await expect(client.resolveName('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: true,
      value: {
        endpoint: {
          value: endpointValue,
        },
        source: {
          kind: 'canonical',
          blockHeight: 123,
        },
      },
    })
  })

  it('keeps indexer-only discovery independent from on-chain transport', async () => {
    const names = [indexedNameSummary()]
    const client = createDuskDomainsClient({
      indexer: fakeIndexer({
        async getNames() {
          return names
        },
      }),
    })

    await expect(client.listNames({ owner: '0xowner' })).resolves.toEqual(names)
  })

  it('fails loudly when the requested mode is absent', async () => {
    const client = createDuskDomainsClient({})

    await expect(client.resolveName('aurora.dusk')).resolves.toMatchObject({
      ok: false,
      error: { code: 'read_transport_missing' },
    })
    await expect(client.search('aurora.dusk')).rejects.toThrow('indexer client is not configured')
    await expect(client.getNameOwner('aurora.dusk')).rejects.toThrow('on-chain client is not configured')
  })

  it('creates a manifest-first client with contracts and indexer compatibility checks', async () => {
    const manifest = releaseManifest()
    const client = await createDuskDomainsClientFromManifest({
      manifestUrl: 'https://static.example/dusk-domains/devnet/manifest.json',
      indexerUrl: 'https://indexer.example',
      fetch: async (url) => {
        if (String(url) === 'https://static.example/dusk-domains/devnet/manifest.json') {
          return Response.json(manifest)
        }
        if (String(url) === 'https://indexer.example/health') {
          return Response.json({
            ok: true,
            apiVersion: 'v1',
            generatedAt: '2026-06-27T00:00:00.000Z',
            source: 'local-indexer-event-log',
            mode: 'event-log',
            schemaVersion: 1,
            eventSchemaVersion: '1',
            currentBlockHeight: 120,
            finalizedBlockHeight: 118,
            lagBlocks: 2,
            eventCount: 7,
            routes: manifest.indexer.routes,
            names: 3,
            deployment: {
              chainId: manifest.chainId,
              contracts: {
                core: { contractId: manifest.contracts.core.contractId },
                treasury: { contractId: manifest.contracts.treasury.contractId },
              },
            },
          })
        }
        return Response.json(null, { status: 404 })
      },
    })

    expect(client.manifest?.network).toBe('devnet')
    expect(client.contracts?.core.driverUrl).toBe('https://static.example/dusk-domains/devnet/contracts/dusk-domains-core.data-driver.wasm')

    await expect(client.checkIndexer()).resolves.toMatchObject({
      ok: true,
      value: {
        ok: true,
        status: 'compatible',
        indexer: {
          schemaVersion: '1',
          lagBlocks: 2,
        },
      },
    })
  })

  it('reports partial indexer history when event replay metadata is missing', async () => {
    const client = createDuskDomainsClient({
      manifest: releaseManifest(),
      indexer: fakeIndexer({
        async getHealth() {
          return {
            ok: true,
            generatedAt: '2026-06-27T00:00:00.000Z',
            source: 'local-indexer-event-log',
            mode: 'event-log',
            schemaVersion: '1',
            currentBlockHeight: 120,
            finalizedBlockHeight: 118,
            lagBlocks: 2,
            routes: ['/health', '/search', '/names', '/resolve'],
            names: 3,
          }
        },
      }),
    })

    await expect(client.checkIndexer()).resolves.toMatchObject({
      ok: true,
      value: {
        ok: true,
        status: 'partial_history',
        checks: expect.arrayContaining([
          expect.objectContaining({
            id: 'history',
            status: 'warn',
          }),
        ]),
      },
    })
  })

  it('detects incompatible indexer deployment bindings from health metadata', () => {
    const manifest = releaseManifest()
    const compatibility = checkDuskDomainsIndexerCompatibilityFromHealth({
      manifest,
      health: {
        ok: true,
        apiVersion: 'v1',
        generatedAt: '2026-06-27T00:00:00.000Z',
        source: 'local-indexer-sqlite',
        mode: 'sqlite',
        schemaVersion: 1,
        eventSchemaVersion: '1',
        currentBlockHeight: 120,
        finalizedBlockHeight: 120,
        lagBlocks: 0,
        eventCount: 7,
        routes: manifest.indexer.routes,
        names: 3,
        sqlite: {
          schemaVersion: 2,
          expectedSchemaVersion: 1,
        },
        deployment: {
          chainId: 'dusk:wrong',
          contracts: {
            core: { contractId: `0x${'99'.repeat(32)}` },
            treasury: { contractId: manifest.contracts.treasury.contractId },
          },
        },
      },
    })

    expect(compatibility).toMatchObject({
      ok: false,
      status: 'incompatible',
      checks: expect.arrayContaining([
        expect.objectContaining({ id: 'deployment_chain', status: 'fail' }),
        expect.objectContaining({ id: 'deployment_core', status: 'fail' }),
        expect.objectContaining({ id: 'sqlite_schema', status: 'fail' }),
      ]),
    })
  })

  it('verifies indexed name summaries against canonical contract reads', async () => {
    const indexed = indexedNameSummary({ manager: '0xmanager' })
    const client = createDuskDomainsClient({
      manifest: releaseManifest(),
      onChain: fakeOnChain({
        async getName() {
          return {
            ok: true,
            value: {
              canonicalName: 'aurora.dusk',
              node,
              record: {
                label: 'aurora',
                owner: '0xowner',
                manager: '0xmanager',
                lifecycle: {
                  expiresAtBlock: 100,
                  graceEndsAtBlock: 110,
                },
                referrer: null,
              },
            },
          }
        },
      }),
    })

    await expect(client.verifyIndexedName(indexed)).resolves.toMatchObject({
      ok: true,
      value: {
        verified: true,
        mismatches: [],
        source: {
          kind: 'indexed_verified',
          eventSchemaVersion: '1',
        },
      },
    })
  })
})
