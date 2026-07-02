import type { ActivityEntry } from './activity'
import type { ResolverRecord } from './records'
import type { RecentChangeWarning } from './indexerWarnings'

export type NameLifecycleStatus = 'active' | 'expired' | 'missing'
export type ResolverHealth = 'ok' | 'missing' | 'invalid'
export type ForwardResolutionErrorCode = 'missing_name' | 'expired_name' | 'missing_resolver' | 'invalid_resolver' | 'invalid_record'

export type ForwardResolutionError = {
  code: ForwardResolutionErrorCode
  message: string
}

export type ResolverMetadata = {
  resolverId: string | null
  health: ResolverHealth
}

export type CacheFreshness = {
  asOf: string
  ttlSeconds: number
  staleAt: string
}

export type NameExpiry = {
  status: NameLifecycleStatus
  expiresAt: string | null
}

export type ForwardResolutionResponse = {
  canonicalName: string
  node: string
  records: ResolverRecord[]
  resolver: ResolverMetadata
  expiry: NameExpiry
  cache: CacheFreshness
  warnings: RecentChangeWarning[]
  verificationStatus: 'unverified' | 'forward_resolved'
  errors: ForwardResolutionError[]
}

export type ForwardResolutionInput = {
  name: string
  records?: ResolverRecord[]
  resolverId?: string | null
  resolverHealth?: ResolverHealth
  expiresAt?: string | null
  activity?: ActivityEntry[]
  warningWindowSeconds?: number
  now?: Date
}

export type IndexedName = {
  canonicalName: string
  records: ResolverRecord[]
  resolverId: string | null
  resolverHealth: ResolverHealth
  expiresAt: string | null
  activity?: ActivityEntry[]
}

export type ForwardResolutionEndpoint = {
  upsertName: (name: string, value: Omit<IndexedName, 'canonicalName'>) => ForwardResolutionResponse
  upsertRecord: (name: string, record: ResolverRecord) => ForwardResolutionResponse
  resolveForward: (name: string) => Promise<ForwardResolutionResponse>
  handleRequest: (request: Request) => Promise<Response>
}
