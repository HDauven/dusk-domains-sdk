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

export function activityLabel(eventType: ActivityEventType) {
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
  return 'Subdomain revoked'
}

export function activityDescription(entry: ActivityEntry) {
  const target = entry.target ? ` -> ${entry.target}` : ''
  return `${entry.name}${target}`
}
