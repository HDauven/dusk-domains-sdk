/**
 * Public SDK entrypoint for resolving, verifying and indexing Dusk Domains.
 *
 * This module is the stable surface intended for wallets, explorers, dApps and
 * independently operated indexers. Browser wallet adapters and first-party
 * write helpers are intentionally kept out of the JSR export surface.
 *
 * @module
 */

import {
  checkDuskDomainsIndexerCompatibilityFromHealth as checkDuskDomainsIndexerCompatibilityFromHealthImpl,
  createDuskDomainsClient as createDuskDomainsClientImpl,
  createDuskDomainsClientFromManifest as createDuskDomainsClientFromManifestImpl,
  createDuskDomainsIndexerClient as createDuskDomainsIndexerClientImpl,
  createDuskDomainsOnChainClient as createDuskDomainsOnChainClientImpl,
  createDuskDomainsOnChainReadTransport as createDuskDomainsOnChainReadTransportImpl,
  type DuskDomainsClient as DuskDomainsClientType,
  type DuskDomainsClientOptions as DuskDomainsClientOptionsType,
  type DuskDomainsCompatibilityCheck as DuskDomainsCompatibilityCheckType,
  type DuskDomainsIndexedNameVerification as DuskDomainsIndexedNameVerificationType,
  type DuskDomainsIndexerClient as DuskDomainsIndexerClientType,
  type DuskDomainsIndexerClientOptions as DuskDomainsIndexerClientOptionsType,
  type DuskDomainsIndexerCompatibility as DuskDomainsIndexerCompatibilityType,
  type DuskDomainsIndexerHealth as DuskDomainsIndexerHealthType,
  type DuskDomainsManifestClientOptions as DuskDomainsManifestClientOptionsType,
  type DuskDomainsOnChainClient as DuskDomainsOnChainClientType,
  type DuskDomainsOnChainClientOptions as DuskDomainsOnChainClientOptionsType,
  type DuskDomainsOnChainReadTransport as DuskDomainsOnChainReadTransportType,
  type DuskDomainsOnChainRecordKey as DuskDomainsOnChainRecordKeyType,
  type DuskDomainsReadSource as DuskDomainsReadSourceType,
  type DuskDomainsReadSourceKind as DuskDomainsReadSourceKindType,
  type DuskDomainsResolvedName as DuskDomainsResolvedNameType,
} from './client/client'
import {
  applyDuskDomainsIndexedEvent as applyDuskDomainsIndexedEventImpl,
  createDuskDomainsProjector as createDuskDomainsProjectorImpl,
  duskDomainsIndexedEventTypes as duskDomainsIndexedEventTypesValue,
  isDuskDomainsIndexedEventEnvelope as isDuskDomainsIndexedEventEnvelopeImpl,
  isDuskDomainsIndexedEventType as isDuskDomainsIndexedEventTypeImpl,
  normalizeDuskDomainsIndexedEventEnvelope as normalizeDuskDomainsIndexedEventEnvelopeImpl,
  type DuskDomainsIndexedEvent as DuskDomainsIndexedEventType,
  type DuskDomainsIndexedEventEnvelope as DuskDomainsIndexedEventEnvelopeType,
} from './indexer/indexerKit'
import {
  contractsFromDuskDomainsReleaseManifest as contractsFromDuskDomainsReleaseManifestImpl,
  validateDuskDomainsReleaseManifest as validateDuskDomainsReleaseManifestImpl,
  type DuskDomainsReleaseManifest as DuskDomainsReleaseManifestType,
} from './runtime/releaseManifest'
import {
  namehash as namehashImpl,
  namehashHex as namehashHexImpl,
} from './core/namehash'
import {
  authorityHexFromPublicSender as authorityHexFromPublicSenderImpl,
  contractPrincipalFromWalletAccount as contractPrincipalFromWalletAccountImpl,
  decodeBase58 as decodeBase58Impl,
  principalKey as principalKeyImpl,
  principalLabel as principalLabelImpl,
  principalShortValue as principalShortValueImpl,
  typedPrincipalFromWalletAccount as typedPrincipalFromWalletAccountImpl,
  type ContractPrincipalResult as ContractPrincipalResultType,
  type DuskPrincipal as DuskPrincipalType,
  type DuskPrincipalKind as DuskPrincipalKindType,
  type DuskPrincipalResult as DuskPrincipalResultType,
} from './core/principal'
import {
  createResolverRecord as createResolverRecordImpl,
  getRecordDefinition as getRecordDefinitionImpl,
  STATIC_RECORD_DEFINITIONS as STATIC_RECORD_DEFINITIONS_VALUE,
  validateRecordValue as validateRecordValueImpl,
  type DynamicRecordKey as DynamicRecordKeyType,
  type EncodedResolverRecord as EncodedResolverRecordType,
  type RecordDefinition as RecordDefinitionType,
  type RecordVisibility as RecordVisibilityType,
  type ResolverRecord as ResolverRecordType,
  type ResolverRecordKey as ResolverRecordKeyType,
  type StaticRecordKey as StaticRecordKeyType,
} from './core/records'
import {
  createDuskDomainsReadWriteClient as createDuskDomainsReadWriteClientImpl,
  createDuskNamesClient as createDuskNamesClientImpl,
} from './client/sdk'
import type {
  DuskEndpoint as DuskEndpointType,
  DuskDomainsClient as DuskDomainsTransportClientType,
  DuskDomainsClientOptions as DuskDomainsTransportClientOptionsType,
  DuskDomainsError as DuskDomainsErrorType,
  DuskDomainsErrorCode as DuskDomainsErrorCodeType,
  DuskDomainsReadTransport as DuskDomainsReadTransportType,
  DuskDomainsRecordMutation as DuskDomainsRecordMutationType,
  DuskDomainsRecordMutationInput as DuskDomainsRecordMutationInputType,
  DuskDomainsResult as DuskDomainsResultType,
  DuskDomainsTxIntent as DuskDomainsTxIntentType,
  DuskDomainsWriteTransport as DuskDomainsWriteTransportType,
  EndpointDisplayName as EndpointDisplayNameType,
  PrimaryNameVerification as PrimaryNameVerificationType,
  ResolvedName as ResolvedNameType,
} from './client/sdkTypes'
import type {
  DuskNamesOnChainRecordKey as DuskNamesOnChainRecordKeyType,
} from './onchain/sdkOnChain'

/** Creates a combined Dusk Domains client from explicit on-chain and indexer transports. */
export const createDuskDomainsClient: typeof createDuskDomainsClientImpl = createDuskDomainsClientImpl

/** Creates a combined client by loading a release manifest and optional indexer URL. */
export const createDuskDomainsClientFromManifest: typeof createDuskDomainsClientFromManifestImpl =
  createDuskDomainsClientFromManifestImpl

/** Creates the HTTP indexer client used for search, activity, treasury and referral reads. */
export const createDuskDomainsIndexerClient: typeof createDuskDomainsIndexerClientImpl =
  createDuskDomainsIndexerClientImpl

/** Creates a direct on-chain read client for canonical domain state. */
export const createDuskDomainsOnChainClient: typeof createDuskDomainsOnChainClientImpl =
  createDuskDomainsOnChainClientImpl

/** Creates a Dusk contract read transport from an app/runtime adapter and release contracts. */
export const createDuskDomainsOnChainReadTransport: typeof createDuskDomainsOnChainReadTransportImpl =
  createDuskDomainsOnChainReadTransportImpl

/** Checks whether an indexer health response is compatible with the configured release manifest. */
export const checkDuskDomainsIndexerCompatibilityFromHealth:
  typeof checkDuskDomainsIndexerCompatibilityFromHealthImpl = checkDuskDomainsIndexerCompatibilityFromHealthImpl

/** Applies one normalized indexed event to a Dusk Domains projector. */
export const applyDuskDomainsIndexedEvent: typeof applyDuskDomainsIndexedEventImpl =
  applyDuskDomainsIndexedEventImpl

/** Creates an in-memory Dusk Domains event projector. */
export const createDuskDomainsProjector: typeof createDuskDomainsProjectorImpl = createDuskDomainsProjectorImpl

/** All event type names emitted by the public Dusk Domains indexer schema. */
export const duskDomainsIndexedEventTypes: typeof duskDomainsIndexedEventTypesValue = duskDomainsIndexedEventTypesValue

/** Returns true when a value is a valid Dusk Domains indexed event envelope. */
export const isDuskDomainsIndexedEventEnvelope: typeof isDuskDomainsIndexedEventEnvelopeImpl =
  isDuskDomainsIndexedEventEnvelopeImpl

/** Returns true when a string is a known Dusk Domains indexed event type. */
export const isDuskDomainsIndexedEventType: typeof isDuskDomainsIndexedEventTypeImpl =
  isDuskDomainsIndexedEventTypeImpl

/** Validates and narrows an unknown value to a Dusk Domains indexed event envelope. */
export const normalizeDuskDomainsIndexedEventEnvelope:
  typeof normalizeDuskDomainsIndexedEventEnvelopeImpl = normalizeDuskDomainsIndexedEventEnvelopeImpl

/** Converts a release manifest to the contract/data-driver map used by SDK transports. */
export const contractsFromDuskDomainsReleaseManifest: typeof contractsFromDuskDomainsReleaseManifestImpl =
  contractsFromDuskDomainsReleaseManifestImpl

/** Validates the shape and version of a Dusk Domains release manifest. */
export const validateDuskDomainsReleaseManifest: typeof validateDuskDomainsReleaseManifestImpl =
  validateDuskDomainsReleaseManifestImpl

/** Computes the Dusk Domains recursive namehash for a normalized `.dusk` name. */
export const namehash: typeof namehashImpl = namehashImpl

/** Computes a `0x`-prefixed Dusk Domains namehash string. */
export const namehashHex: typeof namehashHexImpl = namehashHexImpl

/** Derives the runtime authority hex value for a Dusk public sender key. */
export const authorityHexFromPublicSender: typeof authorityHexFromPublicSenderImpl =
  authorityHexFromPublicSenderImpl

/** Converts a wallet account string into a contract-compatible principal hex string. */
export const contractPrincipalFromWalletAccount: typeof contractPrincipalFromWalletAccountImpl =
  contractPrincipalFromWalletAccountImpl

/** Decodes a base58 Dusk public account or key string. */
export const decodeBase58: typeof decodeBase58Impl = decodeBase58Impl

/** Returns a stable string key for a typed Dusk principal. */
export const principalKey: typeof principalKeyImpl = principalKeyImpl

/** Returns a short human label for a typed Dusk principal. */
export const principalLabel: typeof principalLabelImpl = principalLabelImpl

/** Returns an abbreviated display value for a typed Dusk principal. */
export const principalShortValue: typeof principalShortValueImpl = principalShortValueImpl

/** Converts a wallet account string into a typed Dusk principal. */
export const typedPrincipalFromWalletAccount: typeof typedPrincipalFromWalletAccountImpl =
  typedPrincipalFromWalletAccountImpl

/** Creates a validated resolver record with default visibility and TTL metadata. */
export const createResolverRecord: typeof createResolverRecordImpl = createResolverRecordImpl

/** Returns the resolver record definition for a static or dynamic record key. */
export const getRecordDefinition: typeof getRecordDefinitionImpl = getRecordDefinitionImpl

/** Static resolver record definitions supported by the public SDK. */
export const STATIC_RECORD_DEFINITIONS: typeof STATIC_RECORD_DEFINITIONS_VALUE = STATIC_RECORD_DEFINITIONS_VALUE

/** Validates a resolver record value and returns user-facing validation errors. */
export const validateRecordValue: typeof validateRecordValueImpl = validateRecordValueImpl

/** Creates the legacy transport-style Dusk Names client used by app integrations. */
export const createDuskNamesClient: typeof createDuskNamesClientImpl = createDuskNamesClientImpl

/** Creates a read/write client from explicit SDK read and write transports. */
export const createDuskDomainsReadWriteClient: typeof createDuskDomainsReadWriteClientImpl =
  createDuskDomainsReadWriteClientImpl

/** Combined public Dusk Domains client. */
export type DuskDomainsClient = DuskDomainsClientType

/** Options accepted by `createDuskDomainsClient`. */
export type DuskDomainsClientOptions = DuskDomainsClientOptionsType

/** Individual compatibility check returned by indexer health validation. */
export type DuskDomainsCompatibilityCheck = DuskDomainsCompatibilityCheckType

/** Result of comparing an indexed name summary against canonical on-chain state. */
export type DuskDomainsIndexedNameVerification = DuskDomainsIndexedNameVerificationType

/** HTTP indexer client interface. */
export type DuskDomainsIndexerClient = DuskDomainsIndexerClientType

/** Options accepted by the HTTP indexer client. */
export type DuskDomainsIndexerClientOptions = DuskDomainsIndexerClientOptionsType

/** Compatibility summary for a Dusk Domains indexer instance. */
export type DuskDomainsIndexerCompatibility = DuskDomainsIndexerCompatibilityType

/** Health response returned by a Dusk Domains indexer. */
export type DuskDomainsIndexerHealth = DuskDomainsIndexerHealthType

/** Options accepted by `createDuskDomainsClientFromManifest`. */
export type DuskDomainsManifestClientOptions = DuskDomainsManifestClientOptionsType

/** Direct on-chain read client interface. */
export type DuskDomainsOnChainClient = DuskDomainsOnChainClientType

/** Options accepted by the direct on-chain read client. */
export type DuskDomainsOnChainClientOptions = DuskDomainsOnChainClientOptionsType

/** Low-level on-chain read transport interface. */
export type DuskDomainsOnChainReadTransport = DuskDomainsOnChainReadTransportType

/** Resolver record keys accepted by on-chain read helpers. */
export type DuskDomainsOnChainRecordKey = DuskDomainsOnChainRecordKeyType

/** Source classification for a Dusk Domains read response. */
export type DuskDomainsReadSource = DuskDomainsReadSourceType

/** Read-source kind for canonical, indexed and verified responses. */
export type DuskDomainsReadSourceKind = DuskDomainsReadSourceKindType

/** Resolved name response with source metadata. */
export type DuskDomainsResolvedName = DuskDomainsResolvedNameType

/** Union of Dusk Domains indexer event payloads. */
export type DuskDomainsIndexedEvent = DuskDomainsIndexedEventType

/** Event envelope accepted by the Dusk Domains projector. */
export type DuskDomainsIndexedEventEnvelope = DuskDomainsIndexedEventEnvelopeType

/** Versioned release manifest describing deployed contracts and artifacts. */
export type DuskDomainsReleaseManifest = DuskDomainsReleaseManifestType

/** Result of converting a wallet account into a contract principal. */
export type ContractPrincipalResult = ContractPrincipalResultType

/** Typed Dusk principal used for owners, managers, operators and referrers. */
export type DuskPrincipal = DuskPrincipalType

/** Supported Dusk principal categories. */
export type DuskPrincipalKind = DuskPrincipalKindType

/** Result of converting a wallet account into a typed principal. */
export type DuskPrincipalResult = DuskPrincipalResultType

/** Dynamic resolver record key namespace for text and service endpoint records. */
export type DynamicRecordKey = DynamicRecordKeyType

/** JSON-safe encoded resolver record shape. */
export type EncodedResolverRecord = EncodedResolverRecordType

/** Resolver record definition with validation, visibility and TTL metadata. */
export type RecordDefinition = RecordDefinitionType

/** Public visibility class for a resolver record. */
export type RecordVisibility = RecordVisibilityType

/** Resolver record stored by name resolvers and returned by indexers. */
export type ResolverRecord = ResolverRecordType

/** Static or dynamic resolver record key. */
export type ResolverRecordKey = ResolverRecordKeyType

/** Built-in resolver record key supported by the SDK. */
export type StaticRecordKey = StaticRecordKeyType

/** Typed endpoint used for forward and reverse resolution. */
export type DuskEndpoint = DuskEndpointType

/** Legacy transport-style SDK client interface. */
export type DuskDomainsTransportClient = DuskDomainsTransportClientType

/** Options accepted by the legacy transport-style SDK client. */
export type DuskDomainsTransportClientOptions = DuskDomainsTransportClientOptionsType

/** Structured SDK error result. */
export type DuskDomainsError = DuskDomainsErrorType

/** Stable SDK error code. */
export type DuskDomainsErrorCode = DuskDomainsErrorCodeType

/** Read transport required by the transport-style SDK client. */
export type DuskDomainsReadTransport = DuskDomainsReadTransportType

/** Validated record mutation used for batch record updates. */
export type DuskDomainsRecordMutation = DuskDomainsRecordMutationType

/** User input for a record mutation before validation. */
export type DuskDomainsRecordMutationInput = DuskDomainsRecordMutationInputType

/** Result wrapper returned by transport-style SDK methods. */
export type DuskDomainsResult<T> = DuskDomainsResultType<T>

/** Transaction intent returned by write transports before wallet submission. */
export type DuskDomainsTxIntent = DuskDomainsTxIntentType

/** Write transport required for mutation helpers. */
export type DuskDomainsWriteTransport = DuskDomainsWriteTransportType

/** Display name response derived from reverse and forward verification. */
export type EndpointDisplayName = EndpointDisplayNameType

/** Result of verifying a primary name for an endpoint. */
export type PrimaryNameVerification = PrimaryNameVerificationType

/** Forward resolution response from the transport-style SDK client. */
export type ResolvedName = ResolvedNameType

/** On-chain record key alias retained for Dusk Names compatibility. */
export type DuskNamesOnChainRecordKey = DuskNamesOnChainRecordKeyType
