import {
  DUSK_DOMAINS_CONTRACTS,
  DUSK_DOMAINS_PLACEHOLDER_CONTRACT_ID,
  type DuskDomainContractKey,
  type DuskDomainContractMap,
  type DuskDomainContractPreset,
} from '../contracts/calls'

export type DuskDomainsRuntimeMode = 'preview' | 'live_ready'

export type DuskDomainsRuntimeConfig = {
  mode: DuskDomainsRuntimeMode
  contracts: DuskDomainContractMap
  capabilities: {
    referralAttribution: boolean
    referralRewardClaims: boolean
  }
  launchLinks: DuskDomainsLaunchLinks
  indexerUrl: string | null
  nodeUrl: string
  chainId: string
  liveWritesEnabled: boolean
  missingLiveInputs: string[]
  warnings: string[]
}

export type DuskDomainsLaunchLinks = {
  support: string | null
  abuse: string | null
  security: string | null
  status: string | null
}

export type DuskDomainsRuntimeEnv = Record<string, string | boolean | undefined>

type RuntimeEnvKey = string | {
  preferred: string
  legacy?: string
}

const contractKeys = ['core', 'treasury'] as const satisfies readonly DuskDomainContractKey[]

const contractIdEnvKeys = {
  core: envKey('VITE_DUSK_DOMAINS_CORE_CONTRACT_ID', 'VITE_DUSK_DOMAINS_CORE_CONTRACT_ID'),
  treasury: envKey('VITE_DUSK_DOMAINS_TREASURY_CONTRACT_ID', 'VITE_DUSK_DOMAINS_TREASURY_CONTRACT_ID'),
} as const satisfies Record<DuskDomainContractKey, RuntimeEnvKey>

const driverUrlEnvKeys = {
  core: envKey('VITE_DUSK_DOMAINS_CORE_DRIVER_URL', 'VITE_DUSK_DOMAINS_CORE_DRIVER_URL'),
  treasury: envKey('VITE_DUSK_DOMAINS_TREASURY_DRIVER_URL', 'VITE_DUSK_DOMAINS_TREASURY_DRIVER_URL'),
} as const satisfies Record<DuskDomainContractKey, RuntimeEnvKey>

const indexerUrlEnvKey = envKey('VITE_DUSK_DOMAINS_INDEXER_URL', 'VITE_DUSK_DOMAINS_INDEXER_URL')
const nodeUrlEnvKey = envKey('VITE_DUSK_DOMAINS_NODE_URL', 'VITE_DUSK_DOMAINS_NODE_URL')
const chainIdEnvKey = envKey('VITE_DUSK_DOMAINS_CHAIN_ID', 'VITE_DUSK_DOMAINS_CHAIN_ID')
const liveWritesEnabledEnvKey = envKey('VITE_DUSK_DOMAINS_ENABLE_LIVE_WRITES', 'VITE_DUSK_DOMAINS_ENABLE_LIVE_WRITES')
const referralAttributionEnabledEnvKey = envKey(
  'VITE_DUSK_DOMAINS_ENABLE_REFERRAL_ATTRIBUTION',
  'VITE_DUSK_DOMAINS_ENABLE_REFERRAL_ATTRIBUTION',
)
const referralClaimsEnabledEnvKey = envKey(
  'VITE_DUSK_DOMAINS_ENABLE_REFERRAL_CLAIMS',
  'VITE_DUSK_DOMAINS_ENABLE_REFERRAL_CLAIMS',
)
const launchLinkEnvKeys = {
  support: envKey('VITE_DUSK_DOMAINS_SUPPORT_URL', 'VITE_DUSK_DOMAINS_SUPPORT_URL'),
  abuse: envKey('VITE_DUSK_DOMAINS_ABUSE_URL', 'VITE_DUSK_DOMAINS_ABUSE_URL'),
  security: envKey('VITE_DUSK_DOMAINS_SECURITY_URL', 'VITE_DUSK_DOMAINS_SECURITY_URL'),
  status: envKey('VITE_DUSK_DOMAINS_STATUS_URL', 'VITE_DUSK_DOMAINS_STATUS_URL'),
} as const satisfies Record<keyof DuskDomainsLaunchLinks, RuntimeEnvKey>
const defaultNodeUrl = 'https://testnet.nodes.dusk.network'
const defaultChainId = 'dusk:2'

export function createDuskDomainsRuntimeConfig(
  env: DuskDomainsRuntimeEnv = {},
  baseContracts: DuskDomainContractMap = DUSK_DOMAINS_CONTRACTS,
): DuskDomainsRuntimeConfig {
  const missingLiveInputs: string[] = []
  const warnings: string[] = []
  const contracts = {} as DuskDomainContractMap

  for (const key of contractKeys) {
    const contract = baseContracts[key]
    const contractId = stringEnv(env, contractIdEnvKeys[key])
    const driverUrl = stringEnv(env, driverUrlEnvKeys[key])

    contracts[key] = {
      ...contract,
      contractId: validContractIdOrPreview(contractId, contract, contractIdEnvKeys[key], warnings),
      driverUrl: validRuntimeUrlOrPreview(driverUrl, contract.driverUrl, driverUrlEnvKeys[key], warnings),
    }
  }

  const rawIndexerUrl = stringEnv(env, indexerUrlEnvKey)
  const indexerUrl = validRuntimeUrlOrNull(rawIndexerUrl, indexerUrlEnvKey, warnings)
  if (!indexerUrl) missingLiveInputs.push(envName(indexerUrlEnvKey))

  const nodeUrl = validRuntimeUrlOrPreview(stringEnv(env, nodeUrlEnvKey), defaultNodeUrl, nodeUrlEnvKey, warnings)
  const chainId = validChainIdOrPreview(stringEnv(env, chainIdEnvKey), defaultChainId, chainIdEnvKey, warnings)
  const liveWritesEnabled = booleanEnv(env, liveWritesEnabledEnvKey)
  const referralAttributionRequested = booleanEnv(env, referralAttributionEnabledEnvKey)
  const referralClaimsRequested = booleanEnv(env, referralClaimsEnabledEnvKey)
  const launchLinks = {
    support: validLaunchLinkOrNull(stringEnv(env, launchLinkEnvKeys.support), launchLinkEnvKeys.support, warnings),
    abuse: validLaunchLinkOrNull(stringEnv(env, launchLinkEnvKeys.abuse), launchLinkEnvKeys.abuse, warnings),
    security: validLaunchLinkOrNull(stringEnv(env, launchLinkEnvKeys.security), launchLinkEnvKeys.security, warnings),
    status: validLaunchLinkOrNull(stringEnv(env, launchLinkEnvKeys.status), launchLinkEnvKeys.status, warnings),
  }

  for (const key of contractKeys) {
    if (isPlaceholderContractId(contracts[key].contractId)) missingLiveInputs.push(envName(contractIdEnvKeys[key]))
  }
  const hasCoreReferralPath = !isPlaceholderContractId(contracts.core.contractId)
    && !isPlaceholderContractId(contracts.treasury.contractId)
  const referralAttributionSupported = referralAttributionRequested && hasCoreReferralPath
  if (referralAttributionRequested && !referralAttributionSupported) {
    warnings.push(`${envName(referralAttributionEnabledEnvKey)} is set, but core and treasury contracts are not configured; referral attribution stays local.`)
  }
  const referralClaimsSupported = referralClaimsRequested && !isPlaceholderContractId(contracts.treasury.contractId)
  if (referralClaimsRequested && !referralClaimsSupported) {
    warnings.push(`${envName(referralClaimsEnabledEnvKey)} is set, but no treasury contract is configured; reward claims stay disabled.`)
  }

  return {
    mode: missingLiveInputs.length === 0 ? 'live_ready' : 'preview',
    contracts,
    capabilities: {
      referralAttribution: referralAttributionSupported,
      referralRewardClaims: referralClaimsSupported,
    },
    launchLinks,
    indexerUrl,
    nodeUrl,
    chainId,
    liveWritesEnabled,
    missingLiveInputs: unique(missingLiveInputs),
    warnings: unique(warnings),
  }
}

export function isPlaceholderContractId(contractId: string): boolean {
  return contractId === DUSK_DOMAINS_PLACEHOLDER_CONTRACT_ID
}

export function isValidDuskContractId(contractId: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(contractId)
}

export function isValidRuntimeUrl(value: string): boolean {
  if (value.startsWith('/')) return !value.startsWith('//')

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isValidLaunchLinkUrl(value: string): boolean {
  if (isValidRuntimeUrl(value)) return true

  try {
    const url = new URL(value)
    return url.protocol === 'mailto:'
  } catch {
    return false
  }
}

function envKey(preferred: string, legacy?: string): RuntimeEnvKey {
  return { preferred, legacy }
}

function envName(key: RuntimeEnvKey) {
  return typeof key === 'string' ? key : key.preferred
}

function envCandidates(key: RuntimeEnvKey) {
  return typeof key === 'string' ? [key] : [key.preferred, key.legacy].filter((candidate): candidate is string => Boolean(candidate))
}

function stringEnv(env: DuskDomainsRuntimeEnv, key: RuntimeEnvKey) {
  const value = envCandidates(key)
    .map((candidate) => env[candidate])
    .find((candidate) => typeof candidate === 'string' && candidate.trim())
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function booleanEnv(env: DuskDomainsRuntimeEnv, key: RuntimeEnvKey) {
  const value = envCandidates(key)
    .map((candidate) => env[candidate])
    .find((candidate) => typeof candidate === 'boolean' || typeof candidate === 'string')
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function validContractIdOrPreview(
  value: string | null,
  contract: DuskDomainContractPreset,
  envKey: RuntimeEnvKey,
  warnings: string[],
) {
  if (!value) {
    return contract.contractId
  }

  if (isValidDuskContractId(value)) return value

  warnings.push(`${envName(envKey)} is not a 32-byte hex contract ID; using preview placeholder.`)
  return contract.contractId
}

function validRuntimeUrlOrPreview(
  value: string | null,
  fallback: string,
  envKey: RuntimeEnvKey,
  warnings: string[],
) {
  if (!value) return fallback
  if (isValidRuntimeUrl(value)) return value

  warnings.push(`${envName(envKey)} must be an http(s) or root-relative URL; using preview default.`)
  return fallback
}

function validRuntimeUrlOrNull(value: string | null, envKey: RuntimeEnvKey, warnings: string[]) {
  if (!value) return null
  if (isValidRuntimeUrl(value)) return value

  warnings.push(`${envName(envKey)} must be an http(s) or root-relative URL; indexer integration disabled.`)
  return null
}

function validLaunchLinkOrNull(value: string | null, envKey: RuntimeEnvKey, warnings: string[]) {
  if (!value) return null
  if (isValidLaunchLinkUrl(value)) return value

  warnings.push(`${envName(envKey)} must be an http(s), mailto, or root-relative URL; launch link disabled.`)
  return null
}

function validChainIdOrPreview(value: string | null, fallback: string, envKey: RuntimeEnvKey, warnings: string[]) {
  if (!value) return fallback
  if (/^dusk:[a-zA-Z0-9_-]+$/.test(value)) return value

  warnings.push(`${envName(envKey)} must be a Dusk CAIP-2 chain ID such as dusk:2; using ${fallback}.`)
  return fallback
}

function unique(values: string[]) {
  return [...new Set(values)]
}
