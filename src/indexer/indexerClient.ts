import { collectPages, pageQuery, parsePage, type IndexerPage, type IndexerPageParams } from './indexerClientPagination'
export { INDEXER_COMPLETE_SET_CAP, type IndexerPage, type IndexerPageParams } from './indexerClientPagination'
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
  getNamesPage: (params?: { owner?: string } & IndexerPageParams) => Promise<IndexerPage<IndexedNameSummary, 'names'>>
  getNodeRecordsPage: (node: string, params?: IndexerPageParams) => Promise<IndexerPage<ResolverRecord, 'records'>>
  getRecordHistoryPage: (node: string, key?: string, params?: IndexerPageParams) => Promise<IndexerPage<IndexedResolverRecordHistoryEntry, 'history'>>
  getActivityPage: (node: string, params?: IndexerPageParams) => Promise<IndexerPage<ActivityEntry, 'activity'>>
  getSubnamesPage: (parentNode: string, params?: IndexerPageParams) => Promise<IndexerPage<IndexedSubname, 'subnames'>>
  getMarketplaceFixedSalesPage: (params?: IndexerPageParams) => Promise<IndexerPage<IndexedMarketplaceFixedSale, 'fixedSales'>>
  getMarketplaceAuctionsPage: (params?: IndexerPageParams) => Promise<IndexerPage<IndexedMarketplaceAuction, 'auctions'>>
  getMarketplaceOffersPage: (filters?: { node?: string; buyerAuthority?: string } & IndexerPageParams) => Promise<IndexerPage<IndexedMarketplaceOffer, 'offers'>>
  getAllNames: (params: { owner: string; maxItems?: number }) => Promise<IndexedNameSummary[]>
  getAllSubnames: (parentNode: string, maxItems?: number) => Promise<IndexedSubname[]>
  getHealth: (params?: IndexerPageParams) => Promise<DuskDomainsIndexerHealth>
  searchName: (query: string, params?: IndexerPageParams) => Promise<NameResult & { nextCursor?: string | null }>
  /**
   * With a controller, reads that controller's record for the hash; commitments are scoped per
   * controller. Without one, the indexer returns the latest record for the hash.
   */
  getCommitment: (commitment: string, controller?: string) => Promise<IndexedRegistrationCommitment | null>
  resolveForward: (canonicalName: string, params?: IndexerPageParams) => Promise<ForwardResolutionResponse & { nextCursor?: string | null }>
  getRecords: (canonicalName: string) => Promise<ResolverRecord[]>
  getNodeRecords: (node: string, params?: IndexerPageParams) => Promise<ResolverRecord[]>
  getNodeRecord: (node: string, key: string) => Promise<ResolverRecord | null>
  getRecordHistory: (node: string, key?: string, params?: IndexerPageParams) => Promise<IndexedResolverRecordHistoryEntry[]>
  getNameState: (node: string) => Promise<IndexedLifecycleName | null>
  getNames: (params?: { owner?: string } & IndexerPageParams) => Promise<IndexedNameSummary[]>
  getActivity: (node: string, params?: IndexerPageParams) => Promise<ActivityEntry[]>
  getSubnames: (parentNode: string, params?: IndexerPageParams) => Promise<IndexedSubname[]>
  getSubname: (node: string) => Promise<IndexedSubname | null>
  getMarketplaceConfig: () => Promise<IndexedMarketplaceConfig>
  getMarketplaceFixedSales: (params?: IndexerPageParams) => Promise<IndexedMarketplaceFixedSale[]>
  getMarketplaceFixedSale: (node: string) => Promise<IndexedMarketplaceFixedSale | null>
  getMarketplaceAuctions: (params?: IndexerPageParams) => Promise<IndexedMarketplaceAuction[]>
  getMarketplaceAuction: (node: string) => Promise<IndexedMarketplaceAuction | null>
  getMarketplaceOffers: (filters?: { node?: string; buyerAuthority?: string } & IndexerPageParams) => Promise<IndexedMarketplaceOffer[]>
  getMarketplaceOffer: (node: string, buyerAuthority: string) => Promise<IndexedMarketplaceOffer | null>
  getMarketplaceRefund: (authority: string) => Promise<IndexedMarketplaceRefund | null>
  getTreasury: () => Promise<IndexedTreasuryState>
  getReferralState: (referrer: string) => Promise<IndexedReferralState>
  getFeeConfig: () => Promise<IndexedFeeConfig>
}

export type DuskDomainsIndexerHealth = {
  ok: boolean
  nextCursor?: string | null
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

  async function getHealth(params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'health', pageQuery(params)))

    if (!isIndexerHealth(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid health response.')
    }

    return payload
  }

  async function searchName(query: string, params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'search', pageQuery({ query, ...params })))

    if (!isNameResult(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid search response.')
    }

    return payload
  }

  async function getCommitment(commitment: string, controller?: string) {
    const params: Record<string, string> = controller ? { commitment, controller } : { commitment }
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'commitment', params))
    if (payload === null) return null

    if (!isIndexedRegistrationCommitment(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid commitment response.')
    }

    return payload
  }

  async function resolveForward(canonicalName: string, params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'resolve', pageQuery({ name: canonicalName, ...params })))

    if (!isForwardResolutionResponse(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid forward-resolution response.')
    }

    return payload
  }

  async function getRecords(canonicalName: string) {
    const response = await resolveForward(canonicalName)
    return response.records
  }

  async function getNodeRecordsPage(node: string, params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'records', pageQuery({ node, ...params })))
    return parsePage(payload, 'records', isResolverRecord, 'node records')
  }

  async function getNodeRecords(node: string, params: IndexerPageParams = {}) {
    return (await getNodeRecordsPage(node, params)).records
  }

  async function getNodeRecord(node: string, key: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'record', { node, key }))
    if (payload === null) return null

    if (!isResolverRecord(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid node record response.')
    }

    return payload
  }

  async function getRecordHistoryPage(node: string, key?: string, params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'record-history', pageQuery({ node, key, ...params })))
    return parsePage(payload, 'history', isIndexedResolverRecordHistoryEntry, 'record history')
  }

  async function getRecordHistory(node: string, key?: string, params: IndexerPageParams = {}) {
    return (await getRecordHistoryPage(node, key, params)).history
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

  async function getNamesPage(params: { owner?: string } & IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'names', pageQuery(params)))
    return parsePage(payload, 'names', isIndexedNameSummary, 'name list')
  }

  async function getNames(params: { owner?: string } & IndexerPageParams = {}) {
    return (await getNamesPage(params)).names
  }

  async function getActivityPage(node: string, params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'activity', pageQuery({ node, ...params })))
    return parsePage(payload, 'activity', isActivityEntry, 'activity')
  }

  async function getActivity(node: string, params: IndexerPageParams = {}) {
    return (await getActivityPage(node, params)).activity
  }

  async function getSubnamesPage(parentNode: string, params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'subnames', pageQuery({ parentNode, ...params })))
    return parsePage(payload, 'subnames', isIndexedSubname, 'subname list')
  }

  async function getSubnames(parentNode: string, params: IndexerPageParams = {}) {
    return (await getSubnamesPage(parentNode, params)).subnames
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

  async function getMarketplaceFixedSalesPage(params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/fixed-sales', pageQuery(params)))
    return parsePage(payload, 'fixedSales', isIndexedMarketplaceFixedSale, 'marketplace fixed-sale')
  }

  async function getMarketplaceFixedSales(params: IndexerPageParams = {}) {
    return (await getMarketplaceFixedSalesPage(params)).fixedSales
  }

  async function getMarketplaceFixedSale(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/fixed-sale', { node }))
    if (payload === null) return null
    if (!isIndexedMarketplaceFixedSale(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace fixed-sale response.')
    }
    return payload
  }

  async function getMarketplaceAuctionsPage(params: IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/auctions', pageQuery(params)))
    return parsePage(payload, 'auctions', isIndexedMarketplaceAuction, 'marketplace auction')
  }

  async function getMarketplaceAuctions(params: IndexerPageParams = {}) {
    return (await getMarketplaceAuctionsPage(params)).auctions
  }

  async function getMarketplaceAuction(node: string) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/auction', { node }))
    if (payload === null) return null

    if (!isIndexedMarketplaceAuction(payload)) {
      throw new Error('Dusk Domains indexer returned an invalid marketplace auction response.')
    }

    return payload
  }

  async function getMarketplaceOffersPage(filters: { node?: string; buyerAuthority?: string } & IndexerPageParams = {}) {
    const payload = await getJson(fetcher, endpointUrl(baseUrl, 'marketplace/offers', pageQuery(filters)))
    return parsePage(payload, 'offers', isIndexedMarketplaceOffer, 'marketplace offer')
  }

  async function getMarketplaceOffers(filters: { node?: string; buyerAuthority?: string } & IndexerPageParams = {}) {
    return (await getMarketplaceOffersPage(filters)).offers
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

  async function getAllNames({ owner, maxItems }: { owner: string; maxItems?: number }) {
    if (!owner?.trim()) throw new Error('Complete name reads require an owner.')
    return collectPages(async (params) => {
      const page = await getNamesPage({ owner, ...params })
      return { items: page.names, nextCursor: page.nextCursor }
    }, maxItems)
  }

  async function getAllSubnames(parentNode: string, maxItems?: number) {
    if (!parentNode.trim()) throw new Error('Complete subname reads require a parent node.')
    return collectPages(async (params) => {
      const page = await getSubnamesPage(parentNode, params)
      return { items: page.subnames, nextCursor: page.nextCursor }
    }, maxItems)
  }

  return {
    getAllNames,
    getAllSubnames,
    getHealth,
    searchName,
    getCommitment,
    resolveForward,
    getRecords,
    getNodeRecords,
    getNodeRecordsPage,
    getNodeRecord,
    getRecordHistory,
    getRecordHistoryPage,
    getPrimaryName,
    getNameState,
    getNames,
    getNamesPage,
    getActivity,
    getActivityPage,
    getSubnames,
    getSubnamesPage,
    getSubname,
    getMarketplaceConfig,
    getMarketplaceFixedSales,
    getMarketplaceFixedSalesPage,
    getMarketplaceFixedSale,
    getMarketplaceAuctions,
    getMarketplaceAuctionsPage,
    getMarketplaceAuction,
    getMarketplaceOffers,
    getMarketplaceOffersPage,
    getMarketplaceOffer,
    getMarketplaceRefund,
    getTreasury,
    getReferralState,
    getFeeConfig,
  }
}
