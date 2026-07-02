import { describe, expect, it } from 'vitest'
import { createActivityEntry } from './activity'
import {
  createForwardResolutionEndpoint,
  createForwardResolutionResponse,
  createRecentChangeWarnings,
} from './indexer'
import { createResolverRecord } from './records'

const now = new Date('2026-06-17T00:00:00.000Z')

describe('Dusk Domains forward-resolution indexer endpoint', () => {
  it('resolves canonical names to current public records with resolver and freshness metadata', async () => {
    const moonlight = createResolverRecord(
      'moonlight_address',
      'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
      now.toISOString(),
    )
    const endpoint = createForwardResolutionEndpoint({
      now: () => now,
      initialNames: [{
        canonicalName: 'aurora.dusk',
        records: [moonlight],
        resolverId: `0x${'11'.repeat(32)}`,
        resolverHealth: 'ok',
        expiresAt: '2027-06-17T00:00:00.000Z',
      }],
    })

    await expect(endpoint.resolveForward('AURORA')).resolves.toMatchObject({
      canonicalName: 'aurora.dusk',
      records: [moonlight],
      resolver: {
        resolverId: `0x${'11'.repeat(32)}`,
        health: 'ok',
      },
      expiry: {
        status: 'active',
        expiresAt: '2027-06-17T00:00:00.000Z',
      },
      cache: {
        ttlSeconds: 300,
        staleAt: '2026-06-17T00:05:00.000Z',
      },
      verificationStatus: 'forward_resolved',
      errors: [],
    })
  })

  it('uses record TTLs for safe cache headers on fetch-compatible requests', async () => {
    const website = {
      ...createResolverRecord('website', 'https://dusk.domains', now.toISOString()),
      ttlSeconds: 60,
    }
    const endpoint = createForwardResolutionEndpoint({ now: () => now })
    endpoint.upsertName('docs.dusk', {
      records: [website],
      resolverId: `0x${'22'.repeat(32)}`,
      resolverHealth: 'ok',
      expiresAt: null,
    })

    const response = await endpoint.handleRequest(new Request('https://api.example/resolve?name=docs.dusk'))
    const body = await response.json()

    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    expect(body).toMatchObject({
      canonicalName: 'docs.dusk',
      cache: {
        ttlSeconds: 60,
        staleAt: '2026-06-17T00:01:00.000Z',
      },
    })
  })

  it('returns structured errors for missing resolver and expired names', () => {
    const response = createForwardResolutionResponse({
      name: 'aurora.dusk',
      resolverId: null,
      expiresAt: '2025-06-17T00:00:00.000Z',
      now,
    })

    expect(response.verificationStatus).toBe('unverified')
    expect(response.errors.map((error) => error.code)).toEqual(['missing_resolver', 'expired_name'])
    expect(response.warnings).toEqual([])
  })

  it('includes recent high-risk change warnings in forward resolution metadata', () => {
    const response = createForwardResolutionResponse({
      name: 'aurora.dusk',
      resolverId: `0x${'11'.repeat(32)}`,
      resolverHealth: 'ok',
      expiresAt: '2027-06-17T00:00:00.000Z',
      now,
      activity: [
        createActivityEntry({
          eventType: 'record_update',
          node: `0x${'18'.repeat(32)}`,
          name: 'aurora.dusk',
          actor: `0x${'19'.repeat(32)}`,
          target: 'moonlight_address',
          timestamp: '2026-06-16T23:30:00.000Z',
          txId: 'tx-record',
          blockHeight: 70,
        }),
      ],
    })

    expect(response.warnings).toMatchObject([{
      code: 'recent_high_risk_record_change',
      severity: 'warning',
      eventType: 'record_update',
      target: 'moonlight_address',
      ageSeconds: 1800,
      windowSeconds: 259200,
      txId: 'tx-record',
      blockHeight: 70,
    }])
  })

  it('returns 400 for invalid request names', async () => {
    const endpoint = createForwardResolutionEndpoint({ now: () => now })
    const response = await endpoint.handleRequest(new Request('https://api.example/resolve?name=-bad.dusk'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      verificationStatus: 'unverified',
      errors: [{ code: 'missing_name' }],
    })
  })
})

describe('Dusk Domains recent-change warnings', () => {
  it('flags resolver, primary-name, and high-risk record updates inside the warning window', () => {
    const warnings = createRecentChangeWarnings([
      createActivityEntry({
        eventType: 'resolver_change',
        node: `0x${'21'.repeat(32)}`,
        name: 'aurora.dusk',
        actor: `0x${'22'.repeat(32)}`,
        target: `0x${'23'.repeat(32)}`,
        timestamp: '2026-06-16T23:59:00.000Z',
      }),
      createActivityEntry({
        eventType: 'primary_name',
        node: `0x${'21'.repeat(32)}`,
        name: 'aurora.dusk',
        actor: `0x${'22'.repeat(32)}`,
        target: 'moonlight_address:dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
        timestamp: '2026-06-16T23:58:00.000Z',
      }),
      createActivityEntry({
        eventType: 'record_update',
        node: `0x${'21'.repeat(32)}`,
        name: 'aurora.dusk',
        actor: `0x${'22'.repeat(32)}`,
        target: 'website',
        timestamp: '2026-06-16T23:57:00.000Z',
      }),
      createActivityEntry({
        eventType: 'record_update',
        node: `0x${'21'.repeat(32)}`,
        name: 'aurora.dusk',
        actor: `0x${'22'.repeat(32)}`,
        target: 'avatar',
        timestamp: '2026-06-16T23:56:00.000Z',
      }),
    ], { now, windowSeconds: 600 })

    expect(warnings.map((warning) => warning.code)).toEqual([
      'recent_resolver_change',
      'recent_primary_name_change',
      'recent_high_risk_record_change',
    ])
    expect(warnings.map((warning) => warning.ageSeconds)).toEqual([60, 120, 180])
  })

  it('ignores stale changes outside the warning window', () => {
    const warnings = createRecentChangeWarnings([
      createActivityEntry({
        eventType: 'record_update',
        node: `0x${'24'.repeat(32)}`,
        name: 'aurora.dusk',
        actor: `0x${'25'.repeat(32)}`,
        target: 'moonlight_address',
        timestamp: '2026-06-16T00:00:00.000Z',
      }),
    ], { now, windowSeconds: 600 })

    expect(warnings).toEqual([])
  })

  it('flags service endpoint record updates as high-risk changes', () => {
    const warnings = createRecentChangeWarnings([
      createActivityEntry({
        eventType: 'record_update',
        node: `0x${'26'.repeat(32)}`,
        name: 'aurora.dusk',
        actor: `0x${'27'.repeat(32)}`,
        target: 'service_endpoint.compliance',
        timestamp: '2026-06-16T23:59:30.000Z',
      }),
    ], { now, windowSeconds: 600 })

    expect(warnings).toMatchObject([{
      code: 'recent_high_risk_record_change',
      target: 'service_endpoint.compliance',
      ageSeconds: 30,
    }])
  })
})
