import { expect, it } from 'vitest'
import { createDuskDomainsRuntimeConfig } from '../src/runtime/config.ts'
import { release } from './helpers.ts'
it('loads node, indexer and chain from the manifest with no baked-in IDs', async () => {
  const r = await release(),
    config = createDuskDomainsRuntimeConfig(r.manifest)
  expect(config).toMatchObject({
    nodeUrl: r.manifest.nodeUrl,
    indexerUrl: r.manifest.indexerUrl,
    chainId: r.manifest.chainId,
    network: 1,
  })
})
it.each(['DUSK_DOMAINS_', 'VITE_DUSK_DOMAINS_'])(
  'supports env prefix %s',
  async (prefix) => {
    const config = createDuskDomainsRuntimeConfig((await release()).manifest, {
      [`${prefix}NODE_URL`]: 'https://other.invalid/',
      [`${prefix}INDEXER_URL`]: 'https://other-indexer.invalid/',
      [`${prefix}CHAIN_ID`]: 'dusk:1',
    })
    expect(config.nodeUrl).toBe('https://other.invalid')
    expect(config.indexerUrl).toBe('https://other-indexer.invalid')
  },
)
it('uses server env before Vite env, ignores empty values and does not mutate manifest', async () => {
  const manifest = structuredClone((await release()).manifest),
    original = structuredClone(manifest)
  const config = createDuskDomainsRuntimeConfig(manifest, {
    DUSK_DOMAINS_NODE_URL: 'https://server.invalid',
    VITE_DUSK_DOMAINS_NODE_URL: 'https://vite.invalid',
    DUSK_DOMAINS_INDEXER_URL: '',
  })
  expect(config.nodeUrl).toBe('https://server.invalid')
  expect(manifest).toEqual(original)
})
it.each([
  'file:///tmp/node',
  'javascript:alert(1)',
  'https://a:b@node.invalid',
  'bad',
  ' ',
])('rejects URL override %s', async (url) => {
  const r = await release()
  expect(() =>
    createDuskDomainsRuntimeConfig(r.manifest, { DUSK_DOMAINS_NODE_URL: url }),
  ).toThrow()
})
it('forbids chain mismatch instead of relabeling a deployment', async () => {
  const r = await release()
  expect(() =>
    createDuskDomainsRuntimeConfig(r.manifest, {
      DUSK_DOMAINS_CHAIN_ID: 'dusk:2',
    }),
  ).toThrow('differs')
})
it('allows an equivalent numeric chain override while preserving the frozen network binding', async () => {
  const r = await release()
  const config = createDuskDomainsRuntimeConfig(
    { ...r.manifest, chainId: 'dusk:local', network: 42 },
    { DUSK_DOMAINS_CHAIN_ID: 'dusk:42' },
  )
  expect(config.chainId).toBe('dusk:42')
  expect(config.manifest.chainId).toBe('dusk:42')
  expect(config.network).toBe(42)
})
