/** Release manifest loading, artifact integrity and role discovery. @module */
import { sha256 } from '@noble/hashes/sha2.js'
import { blake2b } from '@noble/hashes/blake2.js'
import { blake3 } from '@noble/hashes/blake3.js'
import { contractId, hex } from './bytes.ts'
import { parseJson } from './json.ts'
import { loadDataDriver, type DataDriver } from './driver.ts'
import { methodCatalog } from './catalog.ts'
export type ContractRole =
  | 'directory'
  | 'store'
  | 'resolver'
  | 'vault'
  | 'policy'
  | 'marketplace'
export interface Artifact {
  path: string
  bytes?: number
  sha256?: string
  blake2b256?: string
  blake3?: string
  [key: string]: unknown
}
export interface ReleaseContract {
  role: ContractRole
  contractId: string
  dataDriver: Artifact
  codeHash?: string
  ordinal?: number
  [key: string]: unknown
}
export interface ReleaseManifest {
  chainId: string
  network: number
  nodeUrl: string
  indexerUrl: string
  contracts: ReleaseContract[]
  [key: string]: unknown
}
export interface ManifestOptions {
  fetch?: typeof fetch
  artifactBaseUrl?: string
  nodeUrl?: string
  indexerUrl?: string
}
export interface LoadedRelease {
  manifest: ReleaseManifest
  contracts: Map<string, ReleaseContract>
  drivers: Map<string, DataDriver>
  artifactBaseUrl: string
}
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
export function validateReleaseContract(
  value: unknown,
  roleHint?: string,
): ReleaseContract {
  const c = object(value),
    role = (c.role ?? c.key ?? roleHint) as ContractRole
  if (!roles.includes(role))
    throw new Error(`Unknown contract role ${String(role)}`)
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
  const code =
    c.codeHash ??
    c.code_hash ??
    (c.contractWasm ? object(c.contractWasm).blake3 : undefined)
  if (
    code !== undefined &&
    (typeof code !== 'string' || !/^[\da-f]{64}$/u.test(code))
  )
    throw new Error('Invalid contract code hash')
  return {
    ...c,
    role,
    contractId: id,
    dataDriver: { ...a } as Artifact,
    ...(code ? { codeHash: code as string } : {}),
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
  const ids = new Set<string>()
  for (const c of contracts) {
    if (ids.has(c.contractId)) throw new Error('Duplicate contract ID')
    ids.add(c.contractId)
  }
  for (const role of ['directory', 'vault', 'policy', 'store', 'resolver']) {
    const count = contracts.filter((c) => c.role === role).length
    if (!count || (['directory', 'vault'].includes(role) && count !== 1))
      throw new Error(`Missing or ambiguous ${role} role`)
  }
  return {
    ...m,
    chainId: m.chainId,
    network,
    nodeUrl: url(options.nodeUrl ?? m.nodeUrl),
    indexerUrl: url(options.indexerUrl ?? m.indexerUrl),
    contracts,
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
export async function fetchDriver(
  contract: ReleaseContract,
  base: string,
  fetcher: typeof fetch = fetch,
): Promise<DataDriver> {
  const artifactUrl = new URL(contract.dataDriver.path, base)
  if (!['http:', 'https:'].includes(artifactUrl.protocol))
    throw new Error('Unsupported artifact URL')
  const response = await fetcher(artifactUrl)
  if (!response.ok)
    throw new Error(`Driver fetch failed: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  verifyArtifact(bytes, contract.dataDriver)
  const driver = await loadDataDriver(bytes)
  const schema = object(driver.schema())
  if (!Array.isArray(schema.functions))
    throw new Error('Missing driver function schema')
  for (const expected of methodCatalog[contract.role]) {
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
    contracts = new Map<string, ReleaseContract>()
  for (const c of manifest.contracts) {
    contracts.set(c.contractId, c)
    drivers.set(c.contractId, await fetchDriver(c, base, f))
  }
  return { manifest, contracts, drivers, artifactBaseUrl: base }
}
