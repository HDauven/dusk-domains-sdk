export const ACTIVITY_EVENT_TYPES = [
  'registration',
  'renewal',
  'expiry',
  'release',
  'transfer',
  'resolver_change',
  'record_update',
  'primary_name',
  'subname_created',
  'subname_delegated',
  'subname_revoked',
  'domain_fixed_sale_opened',
  'domain_fixed_sale_closed',
  'domain_fixed_sale_filled',
  'domain_auction_created',
  'domain_bid_placed',
  'domain_auction_cancelled',
  'domain_auction_settled',
  'domain_offer_placed',
  'domain_offer_closed',
  'domain_offer_accepted',
] as const

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number]

export type ActivityEntry = {
  id: string
  eventType: ActivityEventType
  node: string
  name: string
  actor: string
  timestamp: string
  blockHeight: number | null
  txId?: string
  target?: string
}

export type CreateActivityEntryArgs = {
  eventType: ActivityEventType
  node: string
  name: string
  actor: string
  timestamp?: string
  blockHeight?: number | null
  txId?: string
  target?: string
}

export function createActivityEntry(args: CreateActivityEntryArgs): ActivityEntry {
  const timestamp = args.timestamp ?? new Date().toISOString()
  return {
    id: [
      args.eventType,
      args.node,
      args.actor,
      args.txId ?? timestamp,
    ].join(':'),
    eventType: args.eventType,
    node: args.node,
    name: args.name,
    actor: args.actor,
    timestamp,
    blockHeight: args.blockHeight ?? null,
    ...(args.txId ? { txId: args.txId } : {}),
    ...(args.target ? { target: args.target } : {}),
  }
}

export function activityLabel(eventType: ActivityEventType): string {
  if (eventType === 'registration') return 'Registered'
  if (eventType === 'renewal') return 'Renewed'
  if (eventType === 'expiry') return 'Expired'
  if (eventType === 'release') return 'Released'
  if (eventType === 'transfer') return 'Transferred'
  if (eventType === 'resolver_change') return 'Record source changed'
  if (eventType === 'record_update') return 'Record updated'
  if (eventType === 'primary_name') return 'Primary domain set'
  if (eventType === 'subname_created') return 'Subdomain created'
  if (eventType === 'subname_delegated') return 'Subdomain delegated'
  if (eventType === 'subname_revoked') return 'Subdomain revoked'
  if (eventType === 'domain_fixed_sale_opened') return 'Listed for sale'
  if (eventType === 'domain_fixed_sale_closed') return 'Sale closed'
  if (eventType === 'domain_fixed_sale_filled') return 'Domain sold'
  if (eventType === 'domain_auction_created') return 'Auction created'
  if (eventType === 'domain_bid_placed') return 'Bid placed'
  if (eventType === 'domain_auction_cancelled') return 'Auction canceled'
  if (eventType === 'domain_auction_settled') return 'Auction settled'
  if (eventType === 'domain_offer_placed') return 'Offer placed'
  if (eventType === 'domain_offer_closed') return 'Offer closed'
  return 'Offer accepted'
}

export function activityDescription(entry: ActivityEntry): string {
  const target = entry.target ? ` -> ${entry.target}` : ''
  return `${entry.name}${target}`
}
