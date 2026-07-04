import type { CoreFeeConfig } from '../core/namePolicy'
import type { DuskPrincipal } from '../core/principal'
import type { RecordVisibility, ResolverRecordKey } from '../core/records'
import type { DuskEndpoint, DuskNamesResult } from '../client/sdkTypes'
import type { DuskNameCallMetadata } from '../contracts/calls'

export type DuskNamesRecordKeyAlias = 'dusk_public_address' | 'dusk_shielded_address'
export type DuskNamesOnChainRecordKey = ResolverRecordKey | DuskNamesRecordKeyAlias

export type DuskNamesOnChainReadTransport = {
  read: (call: DuskNameCallMetadata) => Promise<unknown>
}

export type DuskNamesOnChainClientOptions = {
  read: DuskNamesOnChainReadTransport
  defaultRecordKeys?: DuskNamesOnChainRecordKey[]
  currentBlockHeight?: number | (() => number | null | Promise<number | null>)
}

export type DuskNamesOnChainLifecycle = {
  expiresAtBlock: number
  graceEndsAtBlock: number
}

export type DuskNamesOnChainNameRecord = {
  label: string
  owner: string
  manager: string
  lifecycle: DuskNamesOnChainLifecycle
  referrer: DuskPrincipal | null
}

export type DuskNamesOnChainNameResponse = {
  canonicalName: string | null
  node: string
  record: DuskNamesOnChainNameRecord | null
}

export type DuskNamesOnChainRecord = {
  key: ResolverRecordKey
  value: string
  visibility: RecordVisibility
  ttlSeconds: number
  updatedAtBlock: number
}

export type DuskNamesOnChainResolvedName = {
  canonicalName: string
  node: string
  endpoint: DuskEndpoint
  record: DuskNamesOnChainRecord
}

export type DuskNamesOnChainPrimaryNameVerification = {
  endpoint: DuskEndpoint
  primaryName: string
  node: string
  forwardRecord: DuskNamesOnChainRecord
  verified: true
}

export type DuskNamesOnChainPrimaryRecord = {
  endpoint: DuskEndpoint
  node: string
  name: string
  updatedAtBlock: number
}

export type DuskNamesOnChainPendingCommitment = {
  commitment: string
  pending: {
    controller: string
    createdAtBlock: number
  } | null
}

export type DuskNamesOnChainClient = {
  getName: (name: string) => Promise<DuskNamesResult<DuskNamesOnChainNameResponse>>
  getNameByNode: (node: string) => Promise<DuskNamesResult<DuskNamesOnChainNameResponse>>
  getNameOwner: (name: string) => Promise<DuskNamesResult<string>>
  getRecords: (
    name: string,
    keys?: DuskNamesOnChainRecordKey[],
  ) => Promise<DuskNamesResult<DuskNamesOnChainRecord[]>>
  getRecord: (name: string, key: DuskNamesOnChainRecordKey) => Promise<DuskNamesResult<DuskNamesOnChainRecord>>
  resolveName: (
    name: string,
    key?: DuskNamesOnChainRecordKey,
  ) => Promise<DuskNamesResult<DuskNamesOnChainResolvedName>>
  getPrimaryName: (endpoint: DuskEndpoint) => Promise<DuskNamesResult<string>>
  verifyPrimaryName: (
    endpoint: DuskEndpoint,
    expectedName?: string,
  ) => Promise<DuskNamesResult<DuskNamesOnChainPrimaryNameVerification>>
  getPendingCommitment: (commitment: string) => Promise<DuskNamesResult<DuskNamesOnChainPendingCommitment>>
  getFeeConfig: () => Promise<DuskNamesResult<CoreFeeConfig>>
}
