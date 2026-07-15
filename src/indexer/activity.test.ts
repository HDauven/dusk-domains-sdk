import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_EVENT_TYPES,
  activityDescription,
  activityLabel,
  createActivityEntry,
  type ActivityEventType,
} from './activity'

describe('Dusk Domains activity entries', () => {
  it('supports every MVP activity event type', () => {
    const labels = new Map<ActivityEventType, string>(
      ACTIVITY_EVENT_TYPES.map((eventType) => [eventType, activityLabel(eventType)]),
    )

    expect(labels).toEqual(new Map([
      ['registration', 'Registered'],
      ['renewal', 'Renewed'],
      ['expiry', 'Expired'],
      ['release', 'Released'],
      ['transfer', 'Transferred'],
      ['resolver_change', 'Record source changed'],
      ['record_update', 'Record updated'],
      ['primary_name', 'Primary domain set'],
      ['subname_created', 'Subdomain created'],
      ['subname_delegated', 'Subdomain delegated'],
      ['subname_revoked', 'Subdomain revoked'],
      ['domain_fixed_sale_opened', 'Listed for sale'],
      ['domain_fixed_sale_closed', 'Sale closed'],
      ['domain_fixed_sale_filled', 'Domain sold'],
      ['domain_auction_created', 'Auction created'],
      ['domain_bid_placed', 'Bid placed'],
      ['domain_auction_cancelled', 'Auction canceled'],
      ['domain_auction_settled', 'Auction settled'],
      ['domain_offer_placed', 'Offer placed'],
      ['domain_offer_closed', 'Offer closed'],
      ['domain_offer_accepted', 'Offer accepted'],
    ]))
  })

  it('keeps actor, timestamp, block, and target metadata for indexer-backed history', () => {
    const entry = createActivityEntry({
      eventType: 'resolver_change',
      node: `0x${'01'.repeat(32)}`,
      name: 'aurora.dusk',
      actor: `0x${'02'.repeat(32)}`,
      timestamp: '2026-06-17T00:00:00.000Z',
      blockHeight: 42,
      txId: 'tx-1',
      target: `0x${'03'.repeat(32)}`,
    })

    expect(entry).toMatchObject({
      eventType: 'resolver_change',
      actor: `0x${'02'.repeat(32)}`,
      timestamp: '2026-06-17T00:00:00.000Z',
      blockHeight: 42,
      txId: 'tx-1',
      target: `0x${'03'.repeat(32)}`,
    })
    expect(activityDescription(entry)).toBe(`aurora.dusk -> 0x${'03'.repeat(32)}`)
  })
})
