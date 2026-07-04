import type { ForwardResolutionResponse } from '../indexer/indexer'
import type { ResolverRecord, ResolverRecordKey } from '../core/records'

export type DuskEndpoint = {
  type: ResolverRecordKey
  value: string
}

export type DuskNamesErrorCode =
  | 'invalid_name'
  | 'invalid_record'
  | 'not_primary_eligible'
  | 'record_missing'
  | 'reverse_missing'
  | 'forward_reverse_mismatch'
  | 'write_transport_missing'
  | 'read_transport_missing'
  | 'missing_name'
  | 'expired_name'
  | 'lifecycle_unavailable'
  | 'missing_resolver'
  | 'invalid_resolver'
  | 'invalid_node'
  | 'contract_read_failed'
  | 'invalid_manifest'

export type DuskNamesError = {
  code: DuskNamesErrorCode
  message: string
}

export type DuskNamesResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: DuskNamesError
    }

export type ResolvedName = {
  canonicalName: string
  endpoint: DuskEndpoint
  record: ResolverRecord
  forward: ForwardResolutionResponse | null
}

export type PrimaryNameVerification = {
  endpoint: DuskEndpoint
  primaryName: string
  forwardRecord: ResolverRecord
  verified: true
}

export type EndpointDisplayName = {
  endpoint: DuskEndpoint
  display: string
  raw: string
  verified: boolean
  reason: DuskNamesError | null
}

export type DuskNamesTxIntent = {
  id: string
  status: 'prepared' | 'submitted' | 'confirmed' | 'failed'
}

export type DuskNamesRecordMutationInput =
  | {
      action: 'set'
      key: ResolverRecordKey
      value: string
    }
  | {
      action: 'clear'
      key: ResolverRecordKey
    }

export type DuskNamesRecordMutation =
  | {
      action: 'set'
      record: ResolverRecord
    }
  | {
      action: 'clear'
      key: ResolverRecordKey
    }

export type DuskNamesReadTransport = {
  getRecords?: (canonicalName: string) => Promise<ResolverRecord[]>
  resolveForward?: (canonicalName: string) => Promise<ForwardResolutionResponse>
  getPrimaryName: (endpoint: DuskEndpoint) => Promise<string | null>
}

export type DuskNamesWriteTransport = {
  setRecord: (canonicalName: string, record: ResolverRecord) => Promise<DuskNamesTxIntent>
  clearRecord?: (canonicalName: string, key: ResolverRecordKey) => Promise<DuskNamesTxIntent>
  mutateRecords?: (canonicalName: string, mutations: DuskNamesRecordMutation[]) => Promise<DuskNamesTxIntent>
  setPrimaryName: (endpoint: DuskEndpoint, canonicalName: string) => Promise<DuskNamesTxIntent>
}

export type DuskNamesClientOptions = {
  read: DuskNamesReadTransport
  write?: DuskNamesWriteTransport
}

export type DuskNamesClient = {
  resolveName: (name: string, endpointType?: ResolverRecordKey) => Promise<DuskNamesResult<ResolvedName>>
  resolveEndpoint: (endpoint: DuskEndpoint) => Promise<DuskNamesResult<string>>
  resolveAddress: (endpoint: DuskEndpoint) => Promise<DuskNamesResult<string>>
  getRecords: (name: string) => Promise<DuskNamesResult<ResolverRecord[]>>
  getPrimaryName: (endpoint: DuskEndpoint) => Promise<DuskNamesResult<string>>
  verifyPrimaryName: (
    endpoint: DuskEndpoint,
    expectedName?: string,
  ) => Promise<DuskNamesResult<PrimaryNameVerification>>
  getDisplayName: (endpoint: DuskEndpoint) => Promise<EndpointDisplayName>
  setRecord: (name: string, key: ResolverRecordKey, value: string) => Promise<DuskNamesResult<DuskNamesTxIntent>>
  clearRecord: (name: string, key: ResolverRecordKey) => Promise<DuskNamesResult<DuskNamesTxIntent>>
  mutateRecords: (name: string, mutations: DuskNamesRecordMutationInput[]) => Promise<DuskNamesResult<DuskNamesTxIntent>>
  setPrimaryName: (endpoint: DuskEndpoint, name: string) => Promise<DuskNamesResult<DuskNamesTxIntent>>
}

export type DuskDomainsErrorCode = DuskNamesErrorCode
export type DuskDomainsError = DuskNamesError
export type DuskDomainsResult<T> = DuskNamesResult<T>
export type DuskDomainsTxIntent = DuskNamesTxIntent
export type DuskDomainsRecordMutationInput = DuskNamesRecordMutationInput
export type DuskDomainsRecordMutation = DuskNamesRecordMutation
export type DuskDomainsReadTransport = DuskNamesReadTransport
export type DuskDomainsWriteTransport = DuskNamesWriteTransport
export type DuskDomainsClientOptions = DuskNamesClientOptions
export type DuskDomainsClient = DuskNamesClient
