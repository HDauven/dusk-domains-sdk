import type { ForwardResolutionResponse } from '../indexer/indexer'
import type { ResolverRecord, ResolverRecordKey } from '../core/records'

export type DuskEndpoint = {
  type: ResolverRecordKey
  value: string
}

export type DuskDomainsErrorCode =
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

export type DuskDomainsError = {
  code: DuskDomainsErrorCode
  message: string
}

export type DuskDomainsResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: DuskDomainsError
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
  reason: DuskDomainsError | null
}

export type DuskDomainsTxIntent = {
  id: string
  status: 'prepared' | 'submitted' | 'confirmed' | 'failed'
}

export type DuskDomainsRecordMutationInput =
  | {
      action: 'set'
      key: ResolverRecordKey
      value: string
    }
  | {
      action: 'clear'
      key: ResolverRecordKey
    }

export type DuskDomainsRecordMutation =
  | {
      action: 'set'
      record: ResolverRecord
    }
  | {
      action: 'clear'
      key: ResolverRecordKey
    }

export type DuskDomainsReadTransport = {
  getRecords?: (canonicalName: string) => Promise<ResolverRecord[]>
  resolveForward?: (canonicalName: string) => Promise<ForwardResolutionResponse>
  getPrimaryName: (endpoint: DuskEndpoint) => Promise<string | null>
}

export type DuskDomainsWriteTransport = {
  setRecord: (canonicalName: string, record: ResolverRecord) => Promise<DuskDomainsTxIntent>
  clearRecord?: (canonicalName: string, key: ResolverRecordKey) => Promise<DuskDomainsTxIntent>
  mutateRecords?: (canonicalName: string, mutations: DuskDomainsRecordMutation[]) => Promise<DuskDomainsTxIntent>
  setPrimaryName: (endpoint: DuskEndpoint, canonicalName: string) => Promise<DuskDomainsTxIntent>
}

export type DuskDomainsReadWriteClientOptions = {
  read: DuskDomainsReadTransport
  write?: DuskDomainsWriteTransport
}

export type DuskDomainsReadWriteClient = {
  resolveName: (name: string, endpointType?: ResolverRecordKey) => Promise<DuskDomainsResult<ResolvedName>>
  resolveEndpoint: (endpoint: DuskEndpoint) => Promise<DuskDomainsResult<string>>
  resolveAddress: (endpoint: DuskEndpoint) => Promise<DuskDomainsResult<string>>
  getRecords: (name: string) => Promise<DuskDomainsResult<ResolverRecord[]>>
  getPrimaryName: (endpoint: DuskEndpoint) => Promise<DuskDomainsResult<string>>
  verifyPrimaryName: (
    endpoint: DuskEndpoint,
    expectedName?: string,
  ) => Promise<DuskDomainsResult<PrimaryNameVerification>>
  getDisplayName: (endpoint: DuskEndpoint) => Promise<EndpointDisplayName>
  setRecord: (name: string, key: ResolverRecordKey, value: string) => Promise<DuskDomainsResult<DuskDomainsTxIntent>>
  clearRecord: (name: string, key: ResolverRecordKey) => Promise<DuskDomainsResult<DuskDomainsTxIntent>>
  mutateRecords: (name: string, mutations: DuskDomainsRecordMutationInput[]) => Promise<DuskDomainsResult<DuskDomainsTxIntent>>
  setPrimaryName: (endpoint: DuskEndpoint, name: string) => Promise<DuskDomainsResult<DuskDomainsTxIntent>>
}
