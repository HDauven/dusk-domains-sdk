import type { ActivityEntry } from './activity'
import type { ForwardResolutionResponse } from './indexer'
import type {
  IndexedReferralState,
  IndexedTreasuryState,
  IndexedFeeConfig,
  IndexedLifecycleName,
  IndexedMarketplaceConfig,
  IndexedMarketplaceFixedSale,
  IndexedMarketplaceAuction,
  IndexedMarketplaceOffer,
  IndexedMarketplaceRefund,
  IndexedNameSummary,
  IndexedRegistrationCommitment,
  IndexedResolverRecordHistoryEntry,
  IndexedSubname,
} from './indexer'
import {
  isActivityEntry,
  isForwardResolutionResponse,
  isIndexedFeeConfig,
  isIndexedLifecycleName,
  isIndexedMarketplaceConfig,
  isIndexedMarketplaceFixedSale,
  isIndexedMarketplaceAuction,
  isIndexedMarketplaceOffer,
  isIndexedMarketplaceRefund,
  isIndexedNameSummary,
  isIndexedReferralState,
  isIndexedRegistrationCommitment,
  isIndexedResolverRecordHistoryEntry,
  isIndexedSubname,
  isIndexedTreasuryState,
  isIndexerHealth,
  isNameResult,
  isResolverRecord,
} from './indexerClientGuards'
import { endpointUrl, getJson, normalizeBaseUrl } from './indexerClientHttp'
import { primaryNameFromPayload } from './indexerClientReverse'
import type { NameResult } from '../core/namePolicy'
import type { ResolverRecord } from '../core/records'
import type { DuskEndpoint, DuskDomainsReadTransport } from '../client/sdk'

export type DuskDomainsIndexerClientOptions = {
  baseUrl: string
  fetch?: typeof fetch
}

export type DuskDomainsIndexerClient = DuskDomainsReadTransport & {
  getHealth: () => Promise<DuskDomainsIndexerHealth>
  searchName: (query: string) => Promise<NameResult>
  getCommitment: (commitment: string) => Promise<IndexedRegistrationCommitment | null>
  resolveForward: (canonicalName: string) => Promise<ForwardResolutionResponse>
  getRecords: (canonicalName: string) => Promise<ResolverRecord[]>
  getNodeRecords: (node: string) => Promise<ResolverRecord[]>
  getNodeRecord: (node: string, key: string) => Promise<ResolverRecord | null>
  getRecordHistory: (node: string, key?: string) => Promise<IndexedResolverRecordHistoryEntry[]>
  getNameState: (node: string) => Promise<IndexedLifecycleName | null>
  getNames: (params?: { owner?: string }) => Promise<IndexedNameSummary[]>
  getActivity: (node: string) => Promise<ActivityEntry[]>
  getSubnames: (parentNode: string) => Promise<IndexedSubname[]>
  getSubname: (node: string) => Promise<IndexedSubname | null>
  getMarketplaceConfig: () => Promise<IndexedMarketplaceConfig>
  getMarketplaceFixedSales: () => Promise<IndexedMarketplaceFixedSale[]>
  getMarketplaceFixedSale: (node: string) => Promise<IndexedMarketplaceFixedSale | null>
  getMarketplaceAuctions: () => Promise<IndexedMarketplaceAuction[]>
  getMarketplaceAuction: (node: string) => Promise<IndexedMarketplaceAuction | null>
  getMarketplaceOffers: (filters?: { node?: string; buyerAuthority?: string }) => Promise<IndexedMarketplaceOffer[]>
  getMarketplaceOffer: (node: string, buyerAuthority: string) => Promise<IndexedMarketplaceOffer | null>
  getMarketplaceRefund: (authority: string) => Promise<IndexedMarketplaceRefund | null>
  getTreasury: () => Promise<IndexedTreasuryState>
  getReferralState: (referrer: string) => Promise<IndexedReferralState>
  getFeeConfig: () => Promise<IndexedFeeConfig>
}

export type DuskDomainsIndexerHealth = {
  ok: boolean
  apiVersion?: string
  generatedAt: string
  source: string
  mode: string
  schemaVersion?: string | number
  eventSchemaVersion?: string | number
  readModelSchemaVersion?: string | number
  currentBlockHeight: number | null
  finalizedBlockHeight?: number | null
  lagBlocks?: number | null
  eventCount?: number
  lastEvent?: {
    eventName: string | null
    blockHeight: number | null
    txId: string | null
    contract: string | null
  } | null
  routes: string[]
  names: number
  package?: {
    name?: string
    version?: string
    sourceCommit?: string | null
    sdk?: {
      package?: string
      dependency?: string
    }
  }
  deployment?: {
    chainId?: string | null
    chainIds?: string[]
    deploymentStartHeight?: number | null
    lastEventBlockHeight?: number | null
    complete?: boolean
    missingContracts?: string[]
    conflictedContracts?: string[]
    contracts?: Record<string, {
      contractKey?: string
      contractId?: string | null
      contractIds?: string[]
      eventCount?: number
      firstBlockHeight?: number | null
      lastBlockHeight?: number | null
      contractIdConflict?: boolean
    }>
  }
  sqlite?: {
    schemaVersion?: string | number | null
    expectedSchemaVersion?: string | number | null
    journalMode?: string | null
  }
  warnings?: Array<{
    code?: string
    message?: string
  }>
  durability?: unknown
  cursor?: {
    lastBlockHeight?: number | null
    currentBlockHeight?: number | null
    scannedBlockHeight?: number | null
    eventCount?: number
  }
  checkpoint?: {
    lastBlockHeight?: number | null
    eventCount?: number
  }
}

export function createDuskDomainsIndexerClient(options: DuskDomainsIndexerClientOptions): DuskDomainsIndexerClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const fetcher = options.fetch ?? globalThis.fetch

  if (!fetcher) throw new Error('Dusk Domains indexer client requires a fetch implementation.')

  async function getHealth() {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'health', {}))

    if (!isIndexerHealth(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid health response.')
    }

    return payload
  }

  async function searchName(query: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'search', { query }))

    if (!isNameResult(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid search response.')
    }

    return payload
  }

  async function getCommitment(commitment: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'commitment', { commitment }))
    if (payload === null) return null

    if (!isIndexedRegistrationCommitment(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid commitment response.')
    }

    return payload
  }

  async function resolveForward(canonicalName: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'resolve', { name: canonicalName }))

    if (!isForwardResolutionResponse(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid forward-resolution response.')
    }

    return payload
  }

  async function getRecords(canonicalName: string) {
    const response = await resolveForward(canonicalName)
    return response.records
  }

  async function getNodeRecords(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'records', { node }))

    if (!Array.isArray(payload) || !payload.every(isResolverRecord)) {
      throw new Error('Dusk Domains indexer returned an invalid node records response.')
    }

    return payload
  }

  async function getNodeRecord(node: string, key: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'record', { node, key }))
    if (payload === null) return null

    if (!isResolverRecord(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid node record response.')
    }

    return payload
  }

  async function getRecordHistory(node: string, key?: string) {
    const params: Record<string, string> = { node }
    if (key) params.key = key
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'record-history', params))

    if (!Array.isArray(payload) || !payload.every(isIndexedResolverRecordHistoryEntry)) {
      throw new Error('Dusk Domains indexer returned an invalid record history response.')
    }

    return payload
  }

  async function getPrimaryName(endpoint: DuskEndpoint) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'reverse', {
      type: endpoint.type,
      value: endpoint.value,
    }))

    return primaryNameFromPayload(payload)
  }

  async function getNameState(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'name', { node }))
    if (payload === null) return null

    if (!isIndexedLifecycleName(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid name-state response.')
    }

    return payload
  }

  async function getNames(params: { owner?: string } = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'names', params.owner ? { owner: params.owner } : {}))

    if (!Array.isArray(payload) || !payload.every(isIndexedNameSummary)) {
      throw new Error('Dusk Domains indexer returned an invalid name list response.')
    }

    return payload
  }

  async function getActivity(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'activity', { node }))

    if (!Array.isArray(payload) || !payload.every(isActivityEntry)) {
      throw new Error('Dusk Domains indexer returned an invalid activity response.')
    }

    return payload
  }

  async function getSubnames(parentNode: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'subnames', { parentNode }))

    if (!Array.isArray(payload) || !payload.every(isIndexedSubname)) {
      throw new Error('Dusk Domains indexer returned an invalid subname list response.')
    }

    return payload
  }

  async function getSubname(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'subname', { node }))
    if (payload === null) return null

    if (!isIndexedSubname(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid subname response.')
    }

    return payload
  }

  async function getMarketplaceConfig() {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/config', {}))
    if (!isIndexedMarketplaceConfig(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace config response.')
    }
    return payload
  }

  async function getMarketplaceFixedSales() {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/fixed-sales', {}))
    if (!Array.isArray(payload) || !payload.every(isIndexedMarketplaceFixedSale)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace fixed-sale response.')
    }
    return payload
  }

  async function getMarketplaceFixedSale(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/fixed-sale', { node }))
    if (payload === null) return null
    if (!isIndexedMarketplaceFixedSale(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace fixed-sale response.')
    }
    return payload
  }

  async function getMarketplaceAuctions() {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/auctions', {}))

    if (!Array.isArray(payload) || !payload.every(isIndexedMarketplaceAuction)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace auction response.')
    }

    return payload
  }

  async function getMarketplaceAuction(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/auction', { node }))
    if (payload === null) return null

    if (!isIndexedMarketplaceAuction(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace auction response.')
    }

    return payload
  }

  async function getMarketplaceOffers(filters: { node?: string; buyerAuthority?: string } = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/offers', filters))
    if (!Array.isArray(payload) || !payload.every(isIndexedMarketplaceOffer)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace offer response.')
    }
    return payload
  }

  async function getMarketplaceOffer(node: string, buyerAuthority: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/offer', { node, buyerAuthority }))
    if (payload === null) return null
    if (!isIndexedMarketplaceOffer(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace offer response.')
    }
    return payload
  }

  async function getMarketplaceRefund(authority: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/refund', { authority }))
    if (payload === null) return null
    if (!isIndexedMarketplaceRefund(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace refund response.')
    }
    return payload
  }

  async function getTreasury() {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'treasury', {}))

    if (!isIndexedTreasuryState(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid treasury response.')
    }

    return payload
  }

  async function getReferralState(referrer: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'referrals', { referrer }))

    if (!isIndexedReferralState(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid referral response.')
    }

    return payload
  }

  async function getFeeConfig() {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'fee-config', {}))

    if (!isIndexedFeeConfig(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid fee config response.')
    }

    return payload
  }

  return {
    getHealth,
    searchName,
    getCommitment,
    resolveForward,
    getRecords,
    getNodeRecords,
    getNodeRecord,
    getRecordHistory,
    getPrimaryName,
    getNameState,
    getNames,
    getActivity,
    getSubnames,
    getSubname,
    getMarketplaceConfig,
    getMarketplaceFixedSales,
    getMarketplaceFixedSale,
    getMarketplaceAuctions,
    getMarketplaceAuction,
    getMarketplaceOffers,
    getMarketplaceOffer,
    getMarketplaceRefund,
    getTreasury,
    getReferralState,
    getFeeConfig,
  }
}
