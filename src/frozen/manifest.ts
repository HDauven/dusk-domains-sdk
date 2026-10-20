/** Release manifest loading, artifact integrity and role discovery. @module */
import { sha256 } from '@noble/hashes/sha2.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { blake3 } from '@noble/hashes/blake3.js'
import { contractId, hex } from './bytes.ts'
import { parseJson } from './json.ts'
import { loadDataDriver, type DataDriver } from './driver.ts'
import { methodCatalog } from './catalog.ts'
import { lensCatalog } from './lens-schema.ts'
/** Role of a contract in a frozen v1 deployment. */
export type ContractRole =
  | 'directory'
  | 'store'
  | 'resolver'
  | 'vault'
  | 'policy'
  | 'marketplace'
/**
 * A release file, by path relative to the manifest, with its size and at least one digest (lowercase
 * hex); other fields are kept.
 */
export interface Artifact {
  path: string
  bytes?: number
  sha256?: string
  blake2b256?: string
  blake3?: string
  [key: string]: unknown
}
/**
 * One contract of a release: role, contract ID, data driver and the optional code and init
 * commitments. Other fields are kept.
 */
export interface ReleaseContract {
  role: ContractRole
  contractId: string
  dataDriver: Artifact
  /** BLAKE3 of the reviewed WASM, compared with the directory's admission evidence. */
  codeHash?: string
  /** H("duskds:init:v1" || init archive), compared with admission evidence and a policy's live init. */
  initHash?: string
  ordinal?: number
  [key: string]: unknown
}
/**
 * The read lens: the manifest's top-level `lens`, pinned like a `contracts` entry. It is never one
 * of `contracts`, where SDKs before the lens reject an unknown role, and never signed for.
 */
export interface LensContract {
  role: 'lens'
  contractId: string
  dataDriver: Artifact
  /** BLAKE3 of the reviewed lens WASM. The client uses a lens only when its entry carries it. */
  codeHash?: string
  /** H("duskds:init:v1" || canonical InitLens { directory }), recomputed against the directory. */
  initHash?: string
  [key: string]: unknown
}
/**
 * A validated release manifest: chain, frozen network byte, node and indexer URLs, contracts and the
 * optional lens. Other fields are kept.
 */
export interface ReleaseManifest {
  chainId: string
  network: number
  nodeUrl: string
  indexerUrl: string
  contracts: ReleaseContract[]
  /** The release's read lens, if it has one. */
  lens?: LensContract
  [key: string]: unknown
}
/**
 * Options for loading a manifest: the fetch to use, the artifact base URL, node and indexer URL
 * overrides, and whether to read through the lens.
 */
export interface ManifestOptions {
  /**
   * Fetches the manifest and artifacts and, with the default transport, sends node reads. It must
   * send each request to its URL: a custom one keeps no verification cache entries unless
   * `ClientOptions.transportNamespace` names where its requests go.
   */
  fetch?: typeof fetch
  artifactBaseUrl?: string
  nodeUrl?: string
  indexerUrl?: string
  /**
   * Read through the release's lens, when it has one: `getName`, `resolve`, `verifyPrimary`,
   * `namePage`, `previewRegistration`, `pricing` and `bootstrap` then take one contract query each.
   * `false` reads directly, as without a lens, and never fetches the lens driver.
   */
  useLens?: boolean
}
/**
 * A validated manifest with its contracts and verified data drivers by contract ID, the base URL its
 * artifacts load from, and the lens when it loaded.
 */
export interface LoadedRelease {
  manifest: ReleaseManifest
  contracts: Map<string, ReleaseContract>
  drivers: Map<string, DataDriver>
  artifactBaseUrl: string
  /** The read lens and its verified driver, when the manifest has one the client may use. */
  lens?: { contract: LensContract; driver: DataDriver }
  /** Why the manifest's lens was not loaded: no code or init commitment, or its driver fetch failed. */
  lensError?: unknown
}
/** `value` as a plain object; throws for `null`, an array or a non-object. */
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object')
  return value as Record<string, unknown>
}
function url(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Manifest URL is required')
  const parsed = new URL(value)
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error('Expected an HTTP(S) URL without credentials')
  return parsed.href.replace(/\/$/u, '')
}
const roles: readonly ContractRole[] = [
  'directory',
  'store',
  'resolver',
  'vault',
  'policy',
  'marketplace',
]
/**
 * Validate one `contracts` entry, its role taken from `role`, `key` or `roleHint`. Throws for an
 * unknown role or any invalid field.
 */
export function validateReleaseContract(
  value: unknown,
  roleHint?: string,
): ReleaseContract {
  const c = object(value),
    role = (c.role ?? c.key ?? roleHint) as ContractRole
  if (!roles.includes(role))
    throw new Error(`Unknown contract role ${String(role)}`)
  return descriptor(c, role)
}
/** A `lens` entry, validated as every other role's. */
export function validateLensContract(value: unknown, roleHint?: string): LensContract {
  const c = object(value)
  if ((c.role ?? c.key ?? roleHint) !== 'lens') throw new Error('Expected the lens role')
  return descriptor(c, 'lens')
}
function descriptor<R extends ContractRole | 'lens'>(
  c: Record<string, unknown>,
  role: R,
): R extends 'lens' ? LensContract : ReleaseContract
function descriptor(c: Record<string, unknown>, role: ContractRole | 'lens'): ReleaseContract | LensContract {
  const id = contractId(c.contractId as string)
  const a = object(c.dataDriver)
  if (typeof a.path !== 'string' || !a.path)
    throw new Error('Missing driver artifact path')
  const hashes = ['sha256', 'blake2b256', 'blake3']
  if (!hashes.some((k) => typeof a[k] === 'string'))
    throw new Error('Missing driver hash')
  for (const h of hashes)
    if (
      a[h] !== undefined &&
      (typeof a[h] !== 'string' || !/^[\da-f]{64}$/u.test(a[h] as string))
    )
      throw new Error(`Invalid driver ${h}`)
  if (
    a.bytes !== undefined &&
    (!Number.isSafeInteger(a.bytes) || Number(a.bytes) <= 0)
  )
    throw new Error('Invalid driver byte count')
  // Absent and null hashes are the same: no commitment to compare.
  const code =
    c.codeHash ??
    c.code_hash ??
    (c.contractWasm ? object(c.contractWasm).blake3 : undefined) ??
    undefined
  if (
    code !== undefined &&
    (typeof code !== 'string' || !/^[\da-f]{64}$/u.test(code))
  )
    throw new Error('Invalid contract code hash')
  const init = c.initHash ?? c.init_hash ?? undefined
  if (
    init !== undefined &&
    (typeof init !== 'string' || !/^[\da-f]{64}$/u.test(init))
  )
    throw new Error('Invalid contract init hash')
  const { codeHash: _code, initHash: _init, ...metadata } = c
  return {
    ...metadata,
    role,
    contractId: id,
    dataDriver: { ...a } as Artifact,
    ...(code ? { codeHash: code as string } : {}),
    ...(init ? { initHash: init as string } : {}),
  }
}
/** Unknown manifest metadata is preserved. Wire JSON remains strict. */
export function validateReleaseManifest(
  value: unknown,
  options: ManifestOptions = {},
): ReleaseManifest {
  const m = object(value)
  if (m.manifestVersion !== undefined && m.manifestVersion !== 1)
    throw new Error('Unsupported manifest version')
  if (typeof m.chainId !== 'string' || !/^dusk:[\w-]+$/u.test(m.chainId))
    throw new Error('Invalid Dusk chain ID')
  const numericChainId = /^dusk:(\d+)$/u.exec(m.chainId)?.[1]
  const network =
    typeof m.network === 'object' && m.network
      ? object(m.network).id
      : (m.networkId ??
        (typeof m.network === 'number'
          ? m.network
          : numericChainId === undefined
            ? undefined
            : Number(numericChainId)))
  if (
    typeof network !== 'number' ||
    !Number.isInteger(network) ||
    network < 0 ||
    network > 255
  )
    throw new Error(
      'Manifest needs the frozen network u8 (network or networkId)',
    )
  if (
    numericChainId !== undefined &&
    BigInt(numericChainId) !== BigInt(network)
  )
    throw new Error('Manifest chain ID and frozen network disagree')
  const contracts: ReleaseContract[] = []
  if (Array.isArray(m.contracts))
    for (const c of m.contracts) contracts.push(validateReleaseContract(c))
  else
    for (const [role, c] of Object.entries(object(m.contracts))) {
      for (const row of Array.isArray(c) ? c : [c])
        contracts.push(validateReleaseContract(row, role))
    }
  // The lens is top-level only: an SDK before it rejects the unknown role in `contracts`.
  const lens = m.lens === undefined ? undefined : validateLensContract(m.lens, 'lens')
  const ids = new Set<string>()
  for (const c of [...contracts, ...(lens ? [lens] : [])]) {
    if (ids.has(c.contractId)) throw new Error('Duplicate contract ID')
    ids.add(c.contractId)
  }
  for (const role of ['directory', 'vault', 'policy', 'store', 'resolver']) {
    const count = contracts.filter((c) => c.role === role).length
    if (!count || (['directory', 'vault'].includes(role) && count !== 1))
      throw new Error(`Missing or ambiguous ${role} role`)
  }
  const { lens: _lens, ...metadata } = m
  return {
    ...metadata,
    chainId: m.chainId,
    network,
    nodeUrl: url(options.nodeUrl ?? m.nodeUrl),
    indexerUrl: url(options.indexerUrl ?? m.indexerUrl),
    contracts,
    ...(lens ? { lens } : {}),
  }
}
/** Every supplied digest must match before the driver can execute. */
export function verifyArtifact(bytes: Uint8Array, artifact: Artifact): void {
  if (artifact.bytes !== undefined && bytes.length !== artifact.bytes)
    throw new Error('Driver byte count mismatch')
  const checks: [keyof Artifact, () => Uint8Array][] = [
    ['sha256', () => sha256(bytes)],
    ['blake2b256', () => blake2b(bytes, { dkLen: 32 })],
    ['blake3', () => blake3(bytes)],
  ]
  if (!checks.some(([key]) => artifact[key] !== undefined))
    throw new Error('Missing driver hash')
  for (const [key, digest] of checks)
    if (artifact[key] !== undefined && hex(digest()) !== artifact[key])
      throw new Error(`Driver ${key} mismatch`)
}
/**
 * Fetch a contract's data driver relative to `base` and load it only once its size and every digest
 * match; throws unless its schema matches the role's methods.
 */
export async function fetchDriver(
  contract: ReleaseContract | LensContract,
  base: string,
  fetcher: typeof fetch = fetch,
): Promise<DataDriver> {
  return driverFrom(contract, await fetchArtifact(contract, base, fetcher))
}
/** A driver artifact's bytes, unverified: every failure here is the fetch's. */
async function fetchArtifact(
  contract: ReleaseContract | LensContract,
  base: string,
  fetcher: typeof fetch,
): Promise<Uint8Array> {
  const artifactUrl = new URL(contract.dataDriver.path, base)
  if (!['http:', 'https:'].includes(artifactUrl.protocol))
    throw new Error('Unsupported artifact URL')
  const response = await fetcher(artifactUrl)
  if (!response.ok)
    throw new Error(`Driver fetch failed: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}
/** Instantiate artifact bytes only once every digest matches, and check the driver's schema. */
async function driverFrom(contract: ReleaseContract | LensContract, bytes: Uint8Array): Promise<DataDriver> {
  verifyArtifact(bytes, contract.dataDriver)
  const driver = await loadDataDriver(bytes)
  const schema = object(driver.schema())
  if (!Array.isArray(schema.functions))
    throw new Error('Missing driver function schema')
  if (contract.role === 'lens' && schema.lens_version !== 1)
    throw new Error('Unsupported lens driver version')
  const catalog = contract.role === 'lens' ? lensCatalog : methodCatalog[contract.role]
  for (const expected of catalog as readonly { name: string; input: string; output: string; mode: string }[]) {
    if (expected.mode === 'metadata') {
      if (object(schema.metadata)[expected.name] !== expected.input)
        throw new Error('Driver metadata schema does not match its role')
    } else {
      const method = schema.functions
        .map(object)
        .find((row) => row.name === expected.name)
      if (
        !method ||
        method.input !== expected.input ||
        method.output !== expected.output
      )
        throw new Error(
          `Driver schema does not match ${contract.role}.${expected.name}`,
        )
    }
  }
  return driver
}
/**
 * Load a release manifest from its URL, or an in-memory one with `artifactBaseUrl`, then fetch and
 * verify every contract's data driver, and the lens's when the client may use it.
 */
export async function loadReleaseManifest(
  source: string | unknown,
  options: ManifestOptions = {},
): Promise<LoadedRelease> {
  const f = options.fetch ?? fetch
  let value: unknown = source
  let base = options.artifactBaseUrl
  if (typeof source === 'string') {
    const response = await f(url(source))
    if (!response.ok)
      throw new Error(`Manifest fetch failed: HTTP ${response.status}`)
    value = parseJson(await response.text())
    base ??= new URL('.', response.url || source).href
  }
  if (!base)
    throw new Error('artifactBaseUrl is required for an in-memory manifest')
  const manifest = validateReleaseManifest(value, options),
    drivers = new Map<string, DataDriver>(),
    contracts = new Map<string, ReleaseContract>(),
    artifacts = new Map<string, DataDriver>()
  for (const c of manifest.contracts) {
    contracts.set(c.contractId, c)
    // Drivers are synchronous codecs with detached results. Identical verified
    // artifacts can share an instance within this release; never cache across
    // releases or weaken a descriptor's hash, size or role checks.
    const a = c.dataDriver
    const key = JSON.stringify([
      c.role, new URL(a.path, base).href, a.bytes,
      a.sha256, a.blake2b256, a.blake3,
    ])
    let driver = artifacts.get(key)
    if (!driver) {
      driver = await fetchDriver(c, base, f)
      artifacts.set(key, driver)
    }
    drivers.set(c.contractId, driver)
  }
  // The lens is optional: it is not fetched when it is not used or has no commitments, and a failed
  // fetch leaves the release without it. Bytes that arrive are verified like every driver's: other
  // bytes than the manifest pins fail the release.
  const entry = manifest.lens
  let lens: LoadedRelease['lens'], lensError: unknown
  if (entry && options.useLens !== false) {
    let bytes: Uint8Array | undefined
    if (entry.codeHash === undefined || entry.initHash === undefined)
      lensError = new Error('The release lens has no code or init commitment')
    else
      try {
        bytes = await fetchArtifact(entry, base, f)
      } catch (error) {
        lensError = error
      }
    if (bytes) lens = { contract: entry, driver: await driverFrom(entry, bytes) }
  }
  return {
    manifest, contracts, drivers, artifactBaseUrl: base,
    ...(lens ? { lens } : {}),
    ...(lensError === undefined ? {} : { lensError }),
  }
}
