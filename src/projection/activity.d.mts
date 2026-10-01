import type { ActivityEntry, ActivityEventType } from '../indexer/activity'
import type { DuskDomainsIndexedEvent } from '../indexer/indexerKit'
import type { IndexerEventMeta, NameLifecycleEvent, SubnameRegistryEvent } from '../indexer/indexerTypes'

export function activityEntry(input: Omit<ActivityEntry, 'id' | 'timestamp' | 'blockHeight'> & {
  timestamp?: string | null
  meta?: IndexerEventMeta
}): ActivityEntry
export function lifecycleActivityType(type: string): ActivityEventType
export function lifecycleActivityTarget(event: NameLifecycleEvent): string | null | undefined
export function lifecycleTimestamp(event: NameLifecycleEvent): string | undefined
export function subnameTimestamp(event: SubnameRegistryEvent): string
export function eventTimestamp(event: DuskDomainsIndexedEvent, meta?: IndexerEventMeta): string | null
