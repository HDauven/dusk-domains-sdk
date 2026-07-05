import type { CoreFeeConfig } from '../core/namePolicy'
import type { DuskPrincipal } from '../core/principal'
import type { RecordVisibility, ResolverRecordKey } from '../core/records'
import type { DuskEndpoint, DuskDomainsResult } from '../client/sdkTypes'
import type { DuskDomainCallMetadata } from '../contracts/calls'

export type DuskDomainsRecordKeyAlias = 'dusk_public_address' | 'dusk_shielded_address'
export type DuskDomainsOnChainRecordKey = ResolverRecordKey | DuskDomainsRecordKeyAlias

export type DuskDomainsOnChainReadTransport = {
  read: (call: DuskDomainCallMetadata) => Promise<unknown>
}

export type DuskDomainsOnChainClientOptions = {
  read: DuskDomainsOnChainReadTransport
  defaultRecordKeys?: DuskDomainsOnChainRecordKey[]
  currentBlockHeight?: number | (() => number | null | Promise<number | null>)
}

export type DuskDomainsOnChainLifecycle = {
  expiresAtBlock: number
  graceEndsAtBlock: number
}

export type DuskDomainsOnChainNameRecord = {
  label: string
  owner: string
  manager: string
  lifecycle: DuskDomainsOnChainLifecycle
  referrer: DuskPrincipal | null
}

export type DuskDomainsOnChainNameResponse = {
  canonicalName: string | null
  node: string
  record: DuskDomainsOnChainNameRecord | null
}

export type DuskDomainsOnChainRecord = {
  key: ResolverRecordKey
  value: string
  visibility: RecordVisibility
  ttlSeconds: number
  updatedAtBlock: number
}

export type DuskDomainsOnChainResolvedName = {
  canonicalName: string
  node: string
  endpoint: DuskEndpoint
  record: DuskDomainsOnChainRecord
}

export type DuskDomainsOnChainPrimaryNameVerification = {
  endpoint: DuskEndpoint
  primaryName: string
  node: string
  forwardRecord: DuskDomainsOnChainRecord
  verified: true
}

export type DuskDomainsOnChainPrimaryRecord = {
  endpoint: DuskEndpoint
  node: string
  name: string
  updatedAtBlock: number
}

export type DuskDomainsOnChainPendingCommitment = {
  commitment: string
  pending: {
    controller: string
    createdAtBlock: number
  } | null
}

export type DuskDomainsOnChainClient = {
  getName: (name: string) => Promise<DuskDomainsResult<DuskDomainsOnChainNameResponse>>
  getNameByNode: (node: string) => Promise<DuskDomainsResult<DuskDomainsOnChainNameResponse>>
  getNameOwner: (name: string) => Promise<DuskDomainsResult<string>>
  getRecords: (
    name: string,
    keys?: DuskDomainsOnChainRecordKey[],
  ) => Promise<DuskDomainsResult<DuskDomainsOnChainRecord[]>>
  getRecord: (name: string, key: DuskDomainsOnChainRecordKey) => Promise<DuskDomainsResult<DuskDomainsOnChainRecord>>
  resolveName: (
    name: string,
    key?: DuskDomainsOnChainRecordKey,
  ) => Promise<DuskDomainsResult<DuskDomainsOnChainResolvedName>>
  getPrimaryName: (endpoint: DuskEndpoint) => Promise<DuskDomainsResult<string>>
  verifyPrimaryName: (
    endpoint: DuskEndpoint,
    expectedName?: string,
  ) => Promise<DuskDomainsResult<DuskDomainsOnChainPrimaryNameVerification>>
  getPendingCommitment: (commitment: string) => Promise<DuskDomainsResult<DuskDomainsOnChainPendingCommitment>>
  getFeeConfig: () => Promise<DuskDomainsResult<CoreFeeConfig>>
}
