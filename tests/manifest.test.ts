import { it, expect } from 'vitest'
import { sha256 } from '@noble/hashes/sha2.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { hex } from '../src/frozen/bytes.ts'
import {
  loadReleaseManifest,
  validateReleaseManifest,
  verifyArtifact,
} from '../src/frozen/manifest.ts'
import { release, driverBytes, id } from './helpers.ts'
it('loads role arrays, URLs, extra deployment metadata and verifies all drivers', async () => {
  const r = await release(),
    manifest = {
      ...r.manifest,
      host: { version: '1.7.1' },
      futureField: { accepted: true },
      contracts: Object.fromEntries(
        r.manifest.contracts.map((c) => [
          c.role,
          c.role === 'store' ? [{ ...c, extraArtifactField: true }] : c,
        ]),
      ),
    }
  const requested: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const u = String(input)
    requested.push(u)
    if (u.endsWith('manifest.json'))
      return new Response(JSON.stringify(manifest))
    const role = r.manifest.contracts.find((c) =>
      u.endsWith(c.dataDriver.path),
    )!.role
    return new Response(new Uint8Array(driverBytes(role)))
  }
  const loaded = await loadReleaseManifest(
    'https://release.invalid/v1/manifest.json',
    { fetch: fetcher as typeof fetch },
  )
  expect(loaded.manifest.chainId).toBe('dusk:1')
  expect(loaded.manifest.futureField).toEqual({ accepted: true })
  expect(loaded.drivers.size).toBe(6)
  expect(requested).toContain('https://release.invalid/v1/store.wasm')
})
it('fails closed on every supplied hash, length, malformed IDs, missing roles and versions', async () => {
  const r = await release(),
    bytes = driverBytes('store'),
    artifact = r.contracts.get(id(4))!.dataDriver
  expect(() =>
    verifyArtifact(bytes, {
      ...artifact,
      blake2b256: hex(blake2b(bytes, { dkLen: 32 })),
    }),
  ).not.toThrow()
  expect(() =>
    verifyArtifact(bytes, { ...artifact, sha256: '0'.repeat(64) }),
  ).toThrow('sha256')
  expect(() =>
    verifyArtifact(bytes, { ...artifact, blake3: '0'.repeat(64) }),
  ).toThrow('blake3')
  expect(() => verifyArtifact(bytes, { ...artifact, bytes: 1 })).toThrow(
    'byte count',
  )
  expect(() =>
    validateReleaseManifest({ ...r.manifest, manifestVersion: 99 }),
  ).toThrow('version')
  expect(() =>
    validateReleaseManifest({
      ...r.manifest,
      contracts: r.manifest.contracts.filter((c) => c.role !== 'directory'),
    }),
  ).toThrow('directory')
  expect(() =>
    validateReleaseManifest({
      ...r.manifest,
      contracts: r.manifest.contracts.map((c) => ({
        ...c,
        contractId: '0'.repeat(64),
      })),
    }),
  ).toThrow('ID')
  const bad = {
    ...r.manifest,
    contracts: r.manifest.contracts.map((c) => ({
      ...c,
      dataDriver: { ...c.dataDriver, sha256: '0'.repeat(64) },
    })),
  }
  await expect(
    loadReleaseManifest(bad, {
      artifactBaseUrl: 'https://release.invalid/',
      fetch: async () => new Response(new Uint8Array([0, 1, 2])),
    }),
  ).rejects.toThrow('byte count')
})
it('in-memory manifests require an explicit artifact base and malformed artifacts never instantiate', async () => {
  const r = await release()
  await expect(loadReleaseManifest(r.manifest)).rejects.toThrow(
    'artifactBaseUrl',
  )
  const bytes = new Uint8Array([0, 1, 2])
  const m = {
    ...r.manifest,
    contracts: r.manifest.contracts.map((c) => ({
      ...c,
      dataDriver: { path: 'test', bytes: 3, sha256: hex(sha256(bytes)) },
    })),
  }
  await expect(
    loadReleaseManifest(m, {
      artifactBaseUrl: 'https://release.invalid/',
      fetch: async () => new Response(bytes),
    }),
  ).rejects.toThrow()
})
it('accepts release network labels with numeric CAIP-2 IDs and rejects contradictory network bytes', async () => {
  const r = await release()
  expect(
    validateReleaseManifest({ ...r.manifest, network: 'testnet' }).network,
  ).toBe(1)
  expect(() => validateReleaseManifest({ ...r.manifest, network: 2 })).toThrow(
    'disagree',
  )
})
it('rejects a correctly hashed driver assigned to the wrong contract role', async () => {
  const r = await release()
  const descriptor = r.contracts.get(id(4))!
  const manifest = {
    ...r.manifest,
    contracts: r.manifest.contracts.map((c) => ({
      ...c,
      dataDriver: descriptor.dataDriver,
    })),
  }
  await expect(
    loadReleaseManifest(manifest, {
      artifactBaseUrl: 'https://release.invalid/',
      fetch: async () => new Response(new Uint8Array(driverBytes('store'))),
    }),
  ).rejects.toThrow('Driver schema')
})

it('reuses identical verified artifacts only within a release and checks every descriptor', async () => {
  const r = await release(), store = r.contracts.get(id(4))!
  const manifest = { ...r.manifest, contracts: [...r.manifest.contracts,
    { ...store, contractId: id(8) }, { ...store, contractId: id(9) }] }
  let fetches = 0
  const options = { artifactBaseUrl: 'https://release.invalid/', fetch: async (url: RequestInfo | URL) => {
    fetches++
    const role = r.manifest.contracts.find(c => String(url).endsWith(c.dataDriver.path))!.role
    return new Response(new Uint8Array(driverBytes(role)))
  } }
  const loaded = await loadReleaseManifest(manifest, options)
  expect(fetches).toBe(6)
  const a = loaded.drivers.get(id(4))!, b = loaded.drivers.get(id(8))!
  const first = a.encodeInput('commit', JSON.stringify({ hash: Array(32).fill(1) }))
  const saved = first.slice()
  b.encodeInput('commit', JSON.stringify({ hash: Array(32).fill(2) }))
  expect(first).toEqual(saved)
  await loadReleaseManifest(manifest, options)
  expect(fetches).toBe(12)
  manifest.contracts.at(-1)!.dataDriver = { ...store.dataDriver, sha256: '0'.repeat(64) }
  await expect(loadReleaseManifest(manifest, options)).rejects.toThrow('sha256')
})
