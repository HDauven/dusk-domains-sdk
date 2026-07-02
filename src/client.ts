import type { ActivityEntry } from './activity'
import type { DuskConnectAppLike, DuskNameContractMap } from './calls'
import type {
  ForwardResolutionResponse,
  IndexedNameSummary,
  IndexedReferralState,
  IndexedSubname,
  IndexedTreasuryState,
} from './indexer'
import {
  createDuskNamesIndexerClient,
  type DuskNamesIndexerClient,
  type DuskNamesIndexerClientOptions,
} from './indexerClient'
import { namehashHex } from './namehash'
import type { NameResult } from './namePolicy'
import type { ResolverRecordKey } from './records'
import {
  contractsFromDuskDomainsReleaseManifest,
  validateDuskDomainsReleaseManifest,
  type DuskDomainsReleaseManifest,
} from './releaseManifest'
import { failure, success } from './sdkResults'
import type { DuskNamesResult } from './sdkTypes'
import {
  createDuskNamesOnChainReadTransport,
  createDuskNamesOnChainClient,
  type DuskNamesOnChainClient,
  type DuskNamesOnChainClientOptions,
  type DuskNamesOnChainNameResponse,
  type DuskNamesOnChainReadTransport,
  type DuskNamesOnChainRecordKey,
  type DuskNamesOnChainResolvedName,
} from './sdkOnChain'

export const createDuskDomainsOnChainClient = createDuskNamesOnChainClient
export const createDuskDomainsOnChainReadTransport = createDuskNamesOnChainReadTransport
export const createDuskDomainsIndexerClient = createDuskNamesIndexerClient

export type DuskDomainsOnChainClient = DuskNamesOnChainClient
export type DuskDomainsOnChainClientOptions = DuskNamesOnChainClientOptions
export type DuskDomainsOnChainReadTransport = DuskNamesOnChainReadTransport
export type DuskDomainsOnChainRecordKey = DuskNamesOnChainRecordKey
export type DuskDomainsIndexerClient = DuskNamesIndexerClient
export type DuskDomainsIndexerClientOptions = DuskNamesIndexerClientOptions

export type DuskDomainsClientOptions = {
  onChain?: DuskNamesOnChainClient
  indexer?: DuskNamesIndexerClient
  manifest?: DuskDomainsReleaseManifest
  contracts?: DuskNameContractMap
  maxIndexerLagBlocks?: number
}

export type DuskDomainsManifestClientOptions = {
  manifest?: DuskDomainsReleaseManifest
  manifestUrl?: string
  artifactBaseUrl?: string
  app?: DuskConnectAppLike
  read?: DuskNamesOnChainReadTransport
  indexerUrl?: string
  fetch?: typeof fetch
  defaultRecordKeys?: DuskNamesOnChainRecordKey[]
  currentBlockHeight?: DuskNamesOnChainClientOptions['currentBlockHeight']
  maxIndexerLagBlocks?: number
}

export type DuskDomainsReadSourceKind =
  | 'canonical'
  | 'indexed'
  | 'indexed_verified'
  | 'stale'
  | 'partial_history'

export type DuskDomainsReadSource = {
  kind: DuskDomainsReadSourceKind
  contractId?: string | null
  blockHeight?: number | null
  txId?: string | null
  eventSchemaVersion?: string | null
  indexedAt?: string | null
}

export type DuskDomainsResolvedName = DuskNamesOnChainResolvedName & {
  source: DuskDomainsReadSource
}

export type DuskDomainsCompatibilityCheck = {
  id: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export type DuskDomainsIndexerCompatibility = {
  ok: boolean
  status: 'compatible' | 'partial_history' | 'degraded' | 'incompatible'
  manifest: {
    network: string | null
    chainId: string | null
    eventSchemaVersion: string | null
  }
  indexer: {
    source: string
    mode: string
    schemaVersion: string | null
    currentBlockHeight: number | null
    finalizedBlockHeight: number | null
    lagBlocks: number | null
    eventCount: number | null
    names: number
  }
  checks: DuskDomainsCompatibilityCheck[]
}

export type DuskDomainsIndexedNameVerification = {
  indexed: IndexedNameSummary
  onChain: DuskNamesOnChainNameResponse
  verified: boolean
  mismatches: Array<{
    field: 'owner' | 'manager' | 'status'
    indexed: string | null
    onChain: string | null
  }>
  source: DuskDomainsReadSource
}

export type DuskDomainsClient = {
  onChain: DuskNamesOnChainClient | null
  indexer: DuskNamesIndexerClient | null
  manifest: DuskDomainsReleaseManifest | null
  contracts: DuskNameContractMap | null
  resolveName: (
    name: string,
    key?: DuskNamesOnChainRecordKey,
  ) => Promise<DuskNamesResult<DuskDomainsResolvedName>>
  getName: DuskNamesOnChainClient['getName']
  getNameOwner: DuskNamesOnChainClient['getNameOwner']
  getRecord: DuskNamesOnChainClient['getRecord']
  getPrimaryNameOnChain: DuskNamesOnChainClient['getPrimaryName']
  verifyPrimaryNameOnChain: DuskNamesOnChainClient['verifyPrimaryName']
  checkIndexer: () => Promise<DuskNamesResult<DuskDomainsIndexerCompatibility>>
  verifyIndexedName: (indexed: IndexedNameSummary) => Promise<DuskNamesResult<DuskDomainsIndexedNameVerification>>
  verifyIndexedResolution: (
    response: ForwardResolutionResponse,
    key?: DuskNamesOnChainRecordKey,
  ) => Promise<DuskNamesResult<{
    indexed: ForwardResolutionResponse
    canonical: DuskDomainsResolvedName
    verified: boolean
    source: DuskDomainsReadSource
  }>>
  search: (query: string) => Promise<NameResult>
  listNames: (params?: { owner?: string }) => Promise<IndexedNameSummary[]>
  listSubdomains: (parent: string) => Promise<IndexedSubname[]>
  getActivity: (nameOrNode: string) => Promise<ActivityEntry[]>
  getReferralRewards: (referrer: string) => Promise<IndexedReferralState>
  getTreasuryState: () => Promise<IndexedTreasuryState>
}

export function createDuskDomainsClient(options: DuskDomainsClientOptions): DuskDomainsClient {
  const onChain = options.onChain ?? null
  const indexer = options.indexer ?? null
  const manifest = options.manifest ?? null
  const contracts = options.contracts ?? null
  const maxIndexerLagBlocks = options.maxIndexerLagBlocks ?? 12

  return {
    onChain,
    indexer,
    manifest,
    contracts,
    resolveName: (name, key = 'moonlight_address') => resolveNameWithFallback({ name, key, onChain, indexer }),
    getName: requireOnChain(onChain, 'getName'),
    getNameOwner: requireOnChain(onChain, 'getNameOwner'),
    getRecord: requireOnChain(onChain, 'getRecord'),
    getPrimaryNameOnChain: requireOnChain(onChain, 'getPrimaryName'),
    verifyPrimaryNameOnChain: requireOnChain(onChain, 'verifyPrimaryName'),
    checkIndexer: () => checkIndexerCompatibility({ indexer, manifest, maxIndexerLagBlocks }),
    verifyIndexedName: (indexed) => verifyIndexedName({ indexed, onChain, manifest, contracts }),
    verifyIndexedResolution: (response, key = 'moonlight_address') => verifyIndexedResolution({
      response,
      key,
      onChain,
      manifest,
      contracts,
    }),
    search: requireIndexer(indexer, 'searchName'),
    listNames: requireIndexer(indexer, 'getNames'),
    listSubdomains: requireIndexer(indexer, 'getSubnames'),
    getActivity: async (nameOrNode) => {
      const node = nameOrNode.startsWith('0x') ? nameOrNode : namehashHex(nameOrNode)
      return await requireIndexer(indexer, 'getActivity')(node)
    },
    getReferralRewards: requireIndexer(indexer, 'getReferralState'),
    getTreasuryState: requireIndexer(indexer, 'getTreasury'),
  }
}

export async function createDuskDomainsClientFromManifest(
  options: DuskDomainsManifestClientOptions,
): Promise<DuskDomainsClient> {
  const fetcher = options.fetch ?? globalThis.fetch
  const manifestResult = options.manifest
    ? validateDuskDomainsReleaseManifest(options.manifest)
    : await fetchDuskDomainsReleaseManifest(options.manifestUrl, fetcher)
  if (!manifestResult.ok) {
    throw new Error(manifestResult.error.message)
  }

  const manifest = manifestResult.value
  const artifactBaseUrl = options.artifactBaseUrl ?? artifactBaseUrlFromManifestUrl(options.manifestUrl)
  const contracts = contractsFromDuskDomainsReleaseManifest(manifest, artifactBaseUrl)
  const read = options.read ?? (options.app ? createDuskNamesOnChainReadTransport(options.app, contracts) : null)
  const onChain = read
    ? createDuskNamesOnChainClient({
        read,
        defaultRecordKeys: options.defaultRecordKeys,
        currentBlockHeight: options.currentBlockHeight,
      })
    : null
  const indexer = options.indexerUrl
    ? createDuskNamesIndexerClient({
        baseUrl: options.indexerUrl,
        fetch: fetcher,
      })
    : null

  return createDuskDomainsClient({
    onChain: onChain ?? undefined,
    indexer: indexer ?? undefined,
    manifest,
    contracts,
    maxIndexerLagBlocks: options.maxIndexerLagBlocks,
  })
}

async function resolveNameWithFallback(options: {
  name: string
  key: DuskNamesOnChainRecordKey
  onChain: DuskNamesOnChainClient | null
  indexer: DuskNamesIndexerClient | null
}): Promise<DuskNamesResult<DuskDomainsResolvedName>> {
  if (options.onChain) {
    const canonical = await options.onChain.resolveName(options.name, options.key)
    if (canonical.ok) {
      return success({
        ...canonical.value,
        source: {
          kind: 'canonical',
          blockHeight: canonical.value.record.updatedAtBlock,
        },
      })
    }
    const canUseIndexerFallback =
      canonical.error.code === 'contract_read_failed'
      || canonical.error.code === 'lifecycle_unavailable'
    if (!options.indexer || !canUseIndexerFallback) return canonical
  }

  return await tryIndexedResolution(options.indexer, options.name, options.key)
}

async function tryIndexedResolution(
  indexer: DuskNamesIndexerClient | null,
  name: string,
  key: DuskNamesOnChainRecordKey,
): Promise<DuskNamesResult<DuskDomainsResolvedName>> {
  if (!indexer) return failure('read_transport_missing', 'No Dusk Domains read transport is configured.')

  try {
    const response = await indexer.resolveForward(name)
    const blockingError = response.errors.find((error) => error.code !== 'invalid_record') ?? response.errors[0]
    if (blockingError) return failure(blockingError.code, blockingError.message)

    const canonicalKey = onChainRecordKey(key)
    const record = response.records.find((candidate) => candidate.key === canonicalKey)
    if (!record) return failure('record_missing', `${response.canonicalName} does not define ${canonicalKey}.`)

    return success({
      canonicalName: response.canonicalName,
      node: response.node,
      endpoint: {
        type: canonicalKey,
        value: record.value,
      },
      record: {
        key: record.key,
        value: record.value,
        visibility: record.visibility,
        ttlSeconds: record.ttlSeconds,
        updatedAtBlock: blockHeightFromForward(response),
      },
      source: {
        kind: 'indexed',
        blockHeight: blockHeightFromForward(response),
        indexedAt: response.cache.asOf,
      },
    })
  } catch (error) {
    return failure('read_transport_missing', error instanceof Error ? error.message : String(error))
  }
}

async function checkIndexerCompatibility(options: {
  indexer: DuskNamesIndexerClient | null
  manifest: DuskDomainsReleaseManifest | null
  maxIndexerLagBlocks: number
}): Promise<DuskNamesResult<DuskDomainsIndexerCompatibility>> {
  if (!options.indexer) {
    return failure('read_transport_missing', 'No Dusk Domains indexer client is configured.')
  }

  let health: Awaited<ReturnType<DuskNamesIndexerClient['getHealth']>>
  try {
    health = await options.indexer.getHealth()
  } catch (error) {
    return failure('read_transport_missing', error instanceof Error ? error.message : String(error))
  }

  const checks: DuskDomainsCompatibilityCheck[] = []
  pushCheck(checks, 'health', health.ok, health.ok
    ? 'Indexer health is ok.'
    : 'Indexer health is degraded.')

  const healthSchemaVersion = health.schemaVersion === undefined || health.schemaVersion === null
    ? null
    : String(health.schemaVersion)

  if (options.manifest?.eventSchemaVersion && healthSchemaVersion) {
    pushCheck(
      checks,
      'event_schema',
      healthSchemaVersion === options.manifest.eventSchemaVersion,
      `Indexer schema ${healthSchemaVersion} ${healthSchemaVersion === options.manifest.eventSchemaVersion ? 'matches' : 'does not match'} manifest schema ${options.manifest.eventSchemaVersion}.`,
    )
  } else {
    pushCheck(checks, 'event_schema', null, 'Indexer or manifest does not report a comparable event schema version.')
  }

  const missingRoutes = (options.manifest?.indexer.routes ?? [])
    .filter((route) => !health.routes.includes(route))
  pushCheck(checks, 'routes', missingRoutes.length === 0, missingRoutes.length === 0
    ? 'Indexer exposes all manifest routes.'
    : `Indexer is missing manifest routes: ${missingRoutes.join(', ')}.`)

  if (typeof health.lagBlocks === 'number') {
    pushCheck(
      checks,
      'lag',
      health.lagBlocks <= options.maxIndexerLagBlocks,
      `Indexer lag is ${health.lagBlocks} block(s).`,
    )
  } else {
    pushCheck(checks, 'lag', null, 'Indexer does not report block lag.')
  }

  const hasIndexedHistory = Boolean(
    typeof health.eventCount === 'number' && health.eventCount > 0,
  )
  pushCheck(checks, 'history', hasIndexedHistory ? true : null, hasIndexedHistory
    ? `Indexer has replayed ${health.eventCount} event(s).`
    : 'Indexer does not report replayed event history; treat discovery results as partial until deployment history is proven.')

  const failed = checks.some((check) => check.status === 'fail')
  const warned = checks.some((check) => check.status === 'warn')
  const partialHistory = checks.some((check) => check.id === 'history' && check.status === 'warn')

  return success({
    ok: !failed,
    status: failed ? 'incompatible' : partialHistory ? 'partial_history' : warned ? 'degraded' : 'compatible',
    manifest: {
      network: options.manifest?.network ?? null,
      chainId: options.manifest?.chainId ?? null,
      eventSchemaVersion: options.manifest?.eventSchemaVersion ?? null,
    },
    indexer: {
      source: health.source,
      mode: health.mode,
      schemaVersion: healthSchemaVersion,
      currentBlockHeight: health.currentBlockHeight,
      finalizedBlockHeight: health.finalizedBlockHeight ?? null,
      lagBlocks: health.lagBlocks ?? null,
      eventCount: health.eventCount ?? null,
      names: health.names,
    },
    checks,
  })
}

async function verifyIndexedName(options: {
  indexed: IndexedNameSummary
  onChain: DuskNamesOnChainClient | null
  manifest: DuskDomainsReleaseManifest | null
  contracts: DuskNameContractMap | null
}): Promise<DuskNamesResult<DuskDomainsIndexedNameVerification>> {
  if (!options.onChain) return failure('read_transport_missing', 'No Dusk Domains on-chain client is configured.')

  const onChain = await options.onChain.getName(options.indexed.canonicalName)
  if (!onChain.ok) return onChain

  const mismatches: DuskDomainsIndexedNameVerification['mismatches'] = []
  const record = onChain.value.record
  if (!record) {
    mismatches.push({
      field: 'status',
      indexed: options.indexed.status,
      onChain: null,
    })
  } else {
    if (options.indexed.owner && options.indexed.owner !== record.owner) {
      mismatches.push({ field: 'owner', indexed: options.indexed.owner, onChain: record.owner })
    }
    if (options.indexed.manager && options.indexed.manager !== record.manager) {
      mismatches.push({ field: 'manager', indexed: options.indexed.manager, onChain: record.manager })
    }
    if (options.indexed.status === 'released') {
      mismatches.push({ field: 'status', indexed: options.indexed.status, onChain: 'active' })
    }
  }

  return success({
    indexed: options.indexed,
    onChain: onChain.value,
    verified: mismatches.length === 0,
    mismatches,
    source: {
      kind: mismatches.length === 0 ? 'indexed_verified' : 'indexed',
      contractId: options.contracts?.core.contractId ?? null,
      eventSchemaVersion: options.manifest?.eventSchemaVersion ?? null,
    },
  })
}

async function verifyIndexedResolution(options: {
  response: ForwardResolutionResponse
  key: DuskNamesOnChainRecordKey
  onChain: DuskNamesOnChainClient | null
  manifest: DuskDomainsReleaseManifest | null
  contracts: DuskNameContractMap | null
}): Promise<DuskNamesResult<{
  indexed: ForwardResolutionResponse
  canonical: DuskDomainsResolvedName
  verified: boolean
  source: DuskDomainsReadSource
}>> {
  if (!options.onChain) return failure('read_transport_missing', 'No Dusk Domains on-chain client is configured.')

  const canonical = await options.onChain.resolveName(options.response.canonicalName, options.key)
  if (!canonical.ok) return canonical

  const indexedKey = onChainRecordKey(options.key)
  const indexedRecord = options.response.records.find((record) => record.key === indexedKey)
  const verified = Boolean(indexedRecord && indexedRecord.value === canonical.value.record.value)

  return success({
    indexed: options.response,
    canonical: {
      ...canonical.value,
      source: {
        kind: 'canonical',
        contractId: options.contracts?.core.contractId ?? null,
        blockHeight: canonical.value.record.updatedAtBlock,
      },
    },
    verified,
    source: {
      kind: verified ? 'indexed_verified' : 'indexed',
      contractId: options.contracts?.core.contractId ?? null,
      eventSchemaVersion: options.manifest?.eventSchemaVersion ?? null,
      indexedAt: options.response.cache.asOf,
    },
  })
}

function onChainRecordKey(key: DuskNamesOnChainRecordKey): ResolverRecordKey {
  if (key === 'dusk_public_address') return 'moonlight_address'
  if (key === 'dusk_shielded_address') return 'phoenix_payment_endpoint'
  return key
}

function blockHeightFromForward(response: ForwardResolutionResponse) {
  const heights = response.warnings
    .map((warning) => warning.blockHeight)
    .filter((height): height is number => typeof height === 'number' && Number.isSafeInteger(height))
  return heights.length > 0 ? Math.max(...heights) : 0
}

async function fetchDuskDomainsReleaseManifest(
  manifestUrl: string | undefined,
  fetcher: typeof fetch | undefined,
): Promise<DuskNamesResult<DuskDomainsReleaseManifest>> {
  if (!manifestUrl) return failure('invalid_manifest', 'Dusk Domains manifest URL is required.')
  if (!fetcher) return failure('read_transport_missing', 'Dusk Domains manifest loading requires a fetch implementation.')

  try {
    const response = await fetcher(manifestUrl, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    })
    if (!response.ok) {
      return failure('invalid_manifest', `Dusk Domains manifest request failed with HTTP ${response.status}.`)
    }
    return validateDuskDomainsReleaseManifest(await response.json())
  } catch (error) {
    return failure('invalid_manifest', error instanceof Error ? error.message : String(error))
  }
}

function artifactBaseUrlFromManifestUrl(manifestUrl: string | undefined) {
  if (!manifestUrl) return ''
  const withoutQuery = manifestUrl.split(/[?#]/)[0]
  const index = withoutQuery.lastIndexOf('/')
  return index >= 0 ? withoutQuery.slice(0, index + 1) : ''
}

function pushCheck(
  checks: DuskDomainsCompatibilityCheck[],
  id: string,
  ok: boolean | null,
  message: string,
) {
  checks.push({
    id,
    status: ok === true ? 'pass' : ok === false ? 'fail' : 'warn',
    message,
  })
}

function requireOnChain<Key extends keyof DuskNamesOnChainClient>(
  client: DuskNamesOnChainClient | null,
  key: Key,
): DuskNamesOnChainClient[Key] {
  if (client) return client[key]
  return (async () => {
    throw new Error('Dusk Domains on-chain client is not configured.')
  }) as DuskNamesOnChainClient[Key]
}

function requireIndexer<Key extends keyof DuskNamesIndexerClient>(
  client: DuskNamesIndexerClient | null,
  key: Key,
): DuskNamesIndexerClient[Key] {
  if (client) return client[key]
  return (async () => {
    throw new Error('Dusk Domains indexer client is not configured.')
  }) as DuskNamesIndexerClient[Key]
}
