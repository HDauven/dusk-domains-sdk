import { expect, it } from 'vitest'
import {
  validateReleaseManifest,
  validateReleaseContract,
  loadReleaseManifest,
  verifyArtifact,
} from '../src/frozen/manifest.ts'
import { blake3 } from '@noble/hashes/blake3.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hex } from '../src/frozen/bytes.ts'
import { release, id } from './helpers.ts'
it.each(['directory', 'vault', 'policy', 'store', 'resolver'])(
  'requires role %s',
  async (role) => {
    const r = await release()
    expect(() =>
      validateReleaseManifest({
        ...r.manifest,
        contracts: r.manifest.contracts.filter((c) => c.role !== role),
      }),
    ).toThrow()
  },
)
it.each([
  { chainId: 'other:1' },
  { chainId: 'dusk:2' },
  { network: 256 },
  { network: -1 },
  { network: 1.5 },
  { manifestVersion: 2 },
  { nodeUrl: 'ftp://node.invalid' },
  { indexerUrl: 'https://user:pass@indexer.invalid' },
])('rejects malformed deployment %#', async (change) => {
  const r = await release()
  expect(() => validateReleaseManifest({ ...r.manifest, ...change })).toThrow()
})
it('rejects duplicate IDs and ambiguous singleton roles', async () => {
  const r = await release()
  expect(() =>
    validateReleaseManifest({
      ...r.manifest,
      contracts: [...r.manifest.contracts, r.manifest.contracts[0]],
    }),
  ).toThrow('Duplicate')
  expect(() =>
    validateReleaseManifest({
      ...r.manifest,
      contracts: [
        ...r.manifest.contracts,
        { ...r.manifest.contracts[0], contractId: id(99) },
      ],
    }),
  ).toThrow('ambiguous')
})
it.each([
  { bytes: 0 },
  { bytes: 1.5 },
  { sha256: 'bad' },
  { blake3: 'A'.repeat(64) },
  { path: '' },
  { sha256: undefined, blake3: undefined, blake2b256: undefined },
])('rejects malformed driver metadata %#', async (change) => {
  const c = (await release()).manifest.contracts[0]
  expect(() =>
    validateReleaseContract({
      ...c,
      dataDriver: { ...c.dataDriver, ...change },
    }),
  ).toThrow()
})
it.each(['sha256', 'blake2b256', 'blake3'] as const)(
  'requires every supplied hash %s to match',
  (algorithm) => {
    const bytes = new Uint8Array([1, 2, 3]),
      artifact = {
        path: 'driver.wasm',
        bytes: 3,
        sha256: hex(sha256(bytes)),
        blake2b256: hex(blake2b(bytes, { dkLen: 32 })),
        blake3: hex(blake3(bytes)),
      }
    expect(() => verifyArtifact(bytes, artifact)).not.toThrow()
    expect(() =>
      verifyArtifact(bytes, { ...artifact, [algorithm]: '0'.repeat(64) }),
    ).toThrow(algorithm)
  },
)
it('fails manifest HTTP/JSON errors before fetching a driver', async () => {
  let calls = 0
  await expect(
    loadReleaseManifest('https://release.invalid/manifest.json', {
      fetch: async () => {
        calls++
        return new Response('{}', { status: 503 })
      },
    }),
  ).rejects.toThrow('503')
  expect(calls).toBe(1)
  await expect(
    loadReleaseManifest('https://release.invalid/manifest.json', {
      fetch: async () => new Response('{bad'),
    }),
  ).rejects.toThrow()
})
it('supports network aliases without relabeling contradictory IDs', async () => {
  const r = await release()
  expect(
    validateReleaseManifest({ ...r.manifest, network: 'mainnet', networkId: 1 })
      .network,
  ).toBe(1)
  expect(
    validateReleaseManifest({ ...r.manifest, network: { id: 1 } }).network,
  ).toBe(1)
  expect(() =>
    validateReleaseManifest({
      ...r.manifest,
      network: 'testnet',
      networkId: 2,
    }),
  ).toThrow('disagree')
})
