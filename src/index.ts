/**
 * Public SDK entrypoint for resolving, verifying and indexing Dusk Domains.
 *
 * @module
 */

export {
  checkDuskDomainsIndexerCompatibilityFromHealth,
  createDuskDomainsClient,
  createDuskDomainsClientFromManifest,
  createDuskDomainsIndexerClient,
  createDuskDomainsOnChainClient,
  createDuskDomainsOnChainReadTransport,
  type DuskDomainsClient,
  type DuskDomainsClientOptions,
  type DuskDomainsCompatibilityCheck,
  type DuskDomainsIndexedNameVerification,
  type DuskDomainsIndexerClient,
  type DuskDomainsIndexerClientOptions,
  type DuskDomainsIndexerCompatibility,
  type DuskDomainsIndexerHealth,
  type DuskDomainsManifestClientOptions,
  type DuskDomainsOnChainClient,
  type DuskDomainsOnChainClientOptions,
  type DuskDomainsOnChainReadTransport,
  type DuskDomainsOnChainRecordKey,
  type DuskDomainsReadSource,
  type DuskDomainsReadSourceKind,
  type DuskDomainsResolvedName,
} from './client/client'

export {
  applyDuskDomainsIndexedEvent,
  createDuskDomainsProjector,
  duskDomainsIndexedEventTypes,
  isDuskDomainsIndexedEventEnvelope,
  isDuskDomainsIndexedEventType,
  normalizeDuskDomainsIndexedEventEnvelope,
  type DuskDomainsIndexedEvent,
  type DuskDomainsIndexedEventEnvelope,
} from './indexer/indexerKit'

export {
  contractsFromDuskDomainsReleaseManifest,
  validateDuskDomainsReleaseManifest,
  type DuskDomainsReleaseManifest,
} from './runtime/releaseManifest'

export { namehash, namehashHex } from './core/namehash'

export {
  authorityHexFromPublicSender,
  contractPrincipalFromWalletAccount,
  decodeBase58,
  hasClaimableReferrerShape,
  isClaimableReferrer,
  principalKey,
  principalLabel,
  principalShortValue,
  typedPrincipalFromWalletAccount,
  type ContractPrincipalResult,
  type DuskPrincipal,
  type DuskPrincipalKind,
  type DuskPrincipalResult,
} from './core/principal'

export {
  createResolverRecord,
  getRecordDefinition,
  STATIC_RECORD_DEFINITIONS,
  validateRecordValue,
  type DynamicRecordKey,
  type EncodedResolverRecord,
  type RecordDefinition,
  type RecordVisibility,
  type ResolverRecord,
  type ResolverRecordKey,
  type StaticRecordKey,
} from './core/records'

export { createDuskDomainsReadWriteClient } from './client/sdk'
export type {
  DuskEndpoint,
  DuskDomainsError,
  DuskDomainsErrorCode,
  DuskDomainsReadWriteClient,
  DuskDomainsReadWriteClientOptions,
  DuskDomainsReadTransport,
  DuskDomainsRecordMutation,
  DuskDomainsRecordMutationInput,
  DuskDomainsResult,
  DuskDomainsTxIntent,
  DuskDomainsWriteTransport,
  EndpointDisplayName,
  PrimaryNameVerification,
  ResolvedName,
} from './client/sdkTypes'

export { INDEXER_COMPLETE_SET_CAP, type IndexerPage, type IndexerPageParams } from './indexer/indexerClient'

export type { NamespaceSummary, NamespaceAncestor, IndexedNamespace } from './indexer/indexerStateTypes'

export { MAX_TAKE_BACK_SUBNAMES } from './core/subnames'

export * from './core/premium.mjs'

export { quoteRegistration, registrationFeeLux, registrationPrice, DEFAULT_FEE_CONFIG, type CoreFeeConfig } from './core/namePolicy'
