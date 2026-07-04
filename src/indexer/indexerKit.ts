import {
  createLifecycleEventProjector,
} from './lifecycleProjector'
import {
  isControllerEventType,
  isDuskDomainsIndexedEventType as isKnownDuskDomainsIndexedEventType,
  isFeeConfigEventType,
  isLifecycleEventType,
  isReferralEventType,
  isResolverEventType,
  isReverseEventType,
  isSubnameEventType,
  isTreasuryEventType,
} from './events/indexerEventCatalog.mjs'
import type {
  FeeConfigEvent,
  IndexerEventMeta,
  NameLifecycleEvent,
  ReferralEvent,
  RegistrationControllerEvent,
  ResolverRecordEvent,
  ReverseRegistryEvent,
  SubnameRegistryEvent,
  TreasuryEvent,
} from './indexerTypes'
import type { LifecycleEventProjector } from './indexerProjectorTypes'

export { duskDomainsIndexedEventTypes } from './events/indexerEventCatalog.mjs'

export type DuskDomainsIndexedEvent =
  | NameLifecycleEvent
  | RegistrationControllerEvent
  | ResolverRecordEvent
  | ReverseRegistryEvent
  | SubnameRegistryEvent
  | TreasuryEvent
  | ReferralEvent
  | FeeConfigEvent

export type DuskDomainsIndexedEventEnvelope = {
  event: DuskDomainsIndexedEvent
  meta?: IndexerEventMeta
}

export const createDuskDomainsProjector = createLifecycleEventProjector

export function applyDuskDomainsIndexedEvent(
  projector: LifecycleEventProjector,
  envelope: DuskDomainsIndexedEventEnvelope,
) {
  const normalized = normalizeDuskDomainsIndexedEventEnvelope(envelope)
  const meta = normalized.meta ?? {}
  const event = normalized.event

  if (isControllerEvent(event)) {
    return projector.applyController(event, meta)
  }
  if (isResolverEvent(event)) {
    return projector.applyResolver(event, meta)
  }
  if (isReverseEvent(event)) {
    return projector.applyReverse(event, meta)
  }
  if (isSubnameEvent(event)) {
    return projector.applySubname(event, meta)
  }
  if (isTreasuryEvent(event)) {
    return projector.applyTreasury(event, meta)
  }
  if (isReferralEvent(event)) {
    return projector.applyReferral(event, meta)
  }
  if (isFeeConfigEvent(event)) {
    return projector.applyFeeConfig(event, meta)
  }

  if (isLifecycleEvent(event)) {
    return projector.apply(event, meta)
  }

  throw new Error('Unsupported Dusk Domains indexed event type.')
}

export function normalizeDuskDomainsIndexedEventEnvelope(value: unknown): DuskDomainsIndexedEventEnvelope {
  if (!isObjectRecord(value)) {
    throw new Error('Dusk Domains indexed event envelope must be an object.')
  }
  if (!isObjectRecord(value.event)) {
    throw new Error('Dusk Domains indexed event envelope must include an event object.')
  }
  if (typeof value.event.type !== 'string' || !isDuskDomainsIndexedEventType(value.event.type)) {
    throw new Error(`Unsupported Dusk Domains indexed event type: ${String(value.event.type ?? '')}`)
  }
  if (value.meta !== undefined && !isObjectRecord(value.meta)) {
    throw new Error('Dusk Domains indexed event envelope meta must be an object when present.')
  }
  return value as DuskDomainsIndexedEventEnvelope
}

export function isDuskDomainsIndexedEventEnvelope(value: unknown): value is DuskDomainsIndexedEventEnvelope {
  try {
    normalizeDuskDomainsIndexedEventEnvelope(value)
    return true
  } catch {
    return false
  }
}

export function isDuskDomainsIndexedEventType(value: string): value is DuskDomainsIndexedEvent['type'] {
  return isKnownDuskDomainsIndexedEventType(value)
}

function isControllerEvent(event: DuskDomainsIndexedEvent): event is RegistrationControllerEvent {
  return isControllerEventType(event.type)
}

function isLifecycleEvent(event: DuskDomainsIndexedEvent): event is NameLifecycleEvent {
  return isLifecycleEventType(event.type)
}

function isResolverEvent(event: DuskDomainsIndexedEvent): event is ResolverRecordEvent {
  return isResolverEventType(event.type)
}

function isReverseEvent(event: DuskDomainsIndexedEvent): event is ReverseRegistryEvent {
  return isReverseEventType(event.type)
}

function isSubnameEvent(event: DuskDomainsIndexedEvent): event is SubnameRegistryEvent {
  return isSubnameEventType(event.type)
}

function isTreasuryEvent(event: DuskDomainsIndexedEvent): event is TreasuryEvent {
  return isTreasuryEventType(event.type)
}

function isReferralEvent(event: DuskDomainsIndexedEvent): event is ReferralEvent {
  return isReferralEventType(event.type)
}

function isFeeConfigEvent(event: DuskDomainsIndexedEvent): event is FeeConfigEvent {
  return isFeeConfigEventType(event.type)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
