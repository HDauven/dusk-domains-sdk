import {
  DUSK_NAME_CONTRACTS,
  type DuskNameContractKey,
  type DuskNameContractMap,
} from '../contracts/calls'
import { isValidDuskContractId } from './config'
import { failure, success } from '../client/sdkResults'
import type { DuskNamesResult } from '../client/sdkTypes'

export type DuskDomainsReleaseArtifact = {
  path: string
  bytes: number
  sha256: string
  blake2b256: string
}

export type DuskDomainsReleaseContract = {
  key: DuskNameContractKey
  name: string
  crate: string
  contractId: string
  contractWasm: DuskDomainsReleaseArtifact | null
  dataDriver: DuskDomainsReleaseArtifact
  methodSigs: Record<string, string>
  methods: string[]
  examples: string[]
}

export type DuskDomainsReleaseManifest = {
  product: 'Dusk Domains'
  manifestVersion: 1
  release: string
  sdkVersion: string
  sourceCommit: string
  generatedAt: string
  network: string
  chainId: string
  eventSchemaVersion: string
  trustModel: {
    canonicalReads: string
    indexedReads: string
  }
  packages: {
    sdk: string
    artifacts: string
    indexerClient: string
    indexer: string
  }
  contracts: Record<DuskNameContractKey, DuskDomainsReleaseContract>
  indexer: {
    apiVersion: string
    schemaVersion: string
    canonical: false
    routes: string[]
  }
}

const contractKeys = ['core', 'treasury'] as const satisfies readonly DuskNameContractKey[]

export function validateDuskDomainsReleaseManifest(
  value: unknown,
): DuskNamesResult<DuskDomainsReleaseManifest> {
  const manifest = objectRecord(value)
  if (!manifest) return failure('invalid_manifest', 'Release manifest must be an object.')

  if (manifest.product !== 'Dusk Domains' || manifest.manifestVersion !== 1) {
    return failure('invalid_manifest', 'Release manifest product or version is unsupported.')
  }
  if (!stringField(manifest.release) || !stringField(manifest.sdkVersion)) {
    return failure('invalid_manifest', 'Release manifest is missing release or SDK version.')
  }
  if (!isGitCommitish(stringField(manifest.sourceCommit))) {
    return failure('invalid_manifest', 'Release manifest source commit is malformed.')
  }
  if (!stringField(manifest.network) || !/^dusk:[a-zA-Z0-9_-]+$/.test(stringField(manifest.chainId) ?? '')) {
    return failure('invalid_manifest', 'Release manifest network or chain ID is malformed.')
  }

  const contracts = objectRecord(manifest.contracts)
  if (!contracts) return failure('invalid_manifest', 'Release manifest is missing contracts.')

  for (const key of contractKeys) {
    const contract = objectRecord(contracts[key])
    if (!contract) return failure('invalid_manifest', `Release manifest is missing ${key} contract metadata.`)
    const contractId = stringField(contract.contractId)
    if (!contractId || !isValidDuskContractId(contractId)) {
      return failure('invalid_manifest', `Release manifest ${key} contract ID is malformed.`)
    }
    const dataDriver = objectRecord(contract.dataDriver)
    if (!dataDriver || !isArtifactDescriptor(dataDriver)) {
      return failure('invalid_manifest', `Release manifest ${key} data-driver metadata is malformed.`)
    }
    const methodSigs = objectRecord(contract.methodSigs)
    if (!methodSigs) return failure('invalid_manifest', `Release manifest ${key} method signatures are missing.`)

    const requiredMethods = Object.keys(DUSK_NAME_CONTRACTS[key].methodSigs)
    const missingMethods = requiredMethods.filter((method) => typeof methodSigs[method] !== 'string')
    if (missingMethods.length > 0) {
      return failure(
        'invalid_manifest',
        `Release manifest ${key} is missing required methods: ${missingMethods.join(', ')}.`,
      )
    }
  }

  return success(manifest as DuskDomainsReleaseManifest)
}

export function contractsFromDuskDomainsReleaseManifest(
  manifest: DuskDomainsReleaseManifest,
  artifactBaseUrl = '',
): DuskNameContractMap {
  const validated = validateDuskDomainsReleaseManifest(manifest)
  if (!validated.ok) throw new Error(validated.error.message)

  return {
    core: contractPresetFromManifest(validated.value, 'core', artifactBaseUrl),
    treasury: contractPresetFromManifest(validated.value, 'treasury', artifactBaseUrl),
  }
}

function contractPresetFromManifest(
  manifest: DuskDomainsReleaseManifest,
  key: DuskNameContractKey,
  artifactBaseUrl: string,
) {
  const contract = manifest.contracts[key]
  return {
    ...DUSK_NAME_CONTRACTS[key],
    name: contract.name,
    contractId: contract.contractId,
    driverUrl: joinUrl(artifactBaseUrl, contract.dataDriver.path),
    methodSigs: {
      ...DUSK_NAME_CONTRACTS[key].methodSigs,
      ...contract.methodSigs,
    },
  }
}

function isArtifactDescriptor(value: Record<string, unknown>) {
  const bytes = value.bytes
  return Boolean(
    stringField(value.path)
    && typeof bytes === 'number'
    && Number.isSafeInteger(bytes)
    && bytes > 0
    && /^[0-9a-f]{64}$/.test(stringField(value.sha256) ?? '')
    && /^[0-9a-f]{64}$/.test(stringField(value.blake2b256) ?? ''),
  )
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedPath = path.replace(/^\/+/, '')
  if (!baseUrl) return normalizedPath
  return `${baseUrl.replace(/\/+$/, '')}/${normalizedPath}`
}

function isGitCommitish(value: string | null) {
  return Boolean(value && /^[0-9a-f]{6,64}$/i.test(value))
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}
