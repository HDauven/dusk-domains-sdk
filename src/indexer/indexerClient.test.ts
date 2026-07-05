import { describe, expect, it } from 'vitest'
import {
  createDuskDomainsIndexerClient,
  createResolverRecord,
  namehashHex,
  type ActivityEntry,
  type ForwardResolutionResponse,
  type IndexedFeeConfig,
  type IndexedLifecycleName,
  type IndexedNameSummary,
  type IndexedReferralState,
  type IndexedRegistrationCommitment,
  type IndexedResolverRecordHistoryEntry,
  type IndexedSubname,
  type IndexedTreasuryState,
  type NameResult,
} from '../internal'

describe('Dusk Domains indexer client', () => {
  it('fetches forward resolution and records from a configured base URL', async () => {
    const moonlight = createResolverRecord(
      'moonlight_address',
      'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c',
      '2026-06-17T00:00:00.000Z',
    )
    const response: ForwardResolutionResponse = {
      canonicalName: 'aurora.dusk',
      node: `0x${'18'.repeat(32)}`,
      records: [moonlight],
      resolver: {
        resolverId: `0x${'44'.repeat(32)}`,
        health: 'ok',
      },
      expiry: {
        status: 'active',
        expiresAt: '2027-06-17T00:00:00.000Z',
      },
      cache: {
        asOf: '2026-06-17T00:00:00.000Z',
        ttlSeconds: 300,
        staleAt: '2026-06-17T00:05:00.000Z',
      },
      warnings: [],
      verificationStatus: 'forward_resolved',
      errors: [],
    }
    const seenUrls: string[] = []
    const seenInit: RequestInit[] = []
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains/',
      fetch: async (url, init) => {
        seenUrls.push(String(url))
        seenInit.push(init ?? {})
        return Response.json(response)
      },
    })

    await expect(client.resolveForward('aurora.dusk')).resolves.toEqual(response)
    await expect(client.getRecords('aurora.dusk')).resolves.toEqual([moonlight])
    expect(seenUrls).toEqual([
      '/api/dusk-domains/resolve?name=aurora.dusk',
      '/api/dusk-domains/resolve?name=aurora.dusk',
    ])
    expect(seenInit).toEqual([
      expect.objectContaining({ cache: 'no-store' }),
      expect.objectContaining({ cache: 'no-store' }),
    ])
  })

  it('fetches current node records and append-only record history', async () => {
    const node = `0x${'18'.repeat(32)}`
    const record = createResolverRecord(
      'website',
      'https://dusk.domains',
      '2026-06-17T00:00:00.000Z',
    )
    const history: IndexedResolverRecordHistoryEntry[] = [{
      node,
      key: 'website',
      action: 'set',
      record,
      previousRecord: null,
      controller: `0x${'44'.repeat(32)}`,
      updatedAt: '2026-06-17T00:00:00.000Z',
      txId: 'tx-record',
      blockHeight: 12,
      eventIndex: 0,
      eventType: 'record_changed',
    }]
    const responses = new Map<string, unknown>([
      [`https://api.example/names/records?node=${node}`, [record]],
      [`https://api.example/names/record?node=${node}&key=website`, record],
      [`https://api.example/names/record?node=${node}&key=avatar`, null],
      [`https://api.example/names/record-history?node=${node}`, history],
      [`https://api.example/names/record-history?node=${node}&key=website`, history],
    ])
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => Response.json(responses.get(String(url)) ?? null),
    })

    await expect(client.getNodeRecords(node)).resolves.toEqual([record])
    await expect(client.getNodeRecord(node, 'website')).resolves.toEqual(record)
    await expect(client.getNodeRecord(node, 'avatar')).resolves.toBeNull()
    await expect(client.getRecordHistory(node)).resolves.toEqual(history)
    await expect(client.getRecordHistory(node, 'website')).resolves.toEqual(history)
  })

  it('reads primary names from reverse lookup responses', async () => {
    const node = namehashHex('aurora.dusk')
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => {
        expect(String(url)).toBe('https://api.example/names/reverse?type=moonlight_address&value=dusk1abc')
        return Response.json({ primaryName: 'aurora.dusk', node })
      },
    })

    await expect(client.getPrimaryName({
      type: 'moonlight_address',
      value: 'dusk1abc',
    })).resolves.toBe('aurora.dusk')
  })

  it('keeps legacy reverse lookup responses without node metadata compatible', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async () => Response.json({ primaryName: 'aurora.dusk' }),
    })

    await expect(client.getPrimaryName({
      type: 'moonlight_address',
      value: 'dusk1abc',
    })).resolves.toBe('aurora.dusk')
  })

  it('fetches health and finalized commitment block state', async () => {
    const commitment = `0x${'ab'.repeat(32)}`
    const indexedCommitment: IndexedRegistrationCommitment = {
      commitment,
      controller: `0x${'cd'.repeat(32)}`,
      createdAt: '2026-06-19T12:00:00.000Z',
      node: null,
      status: 'committed',
      committedTxId: 'tx-commit',
      committedBlockHeight: 100,
      revealedTxId: null,
      revealedBlockHeight: null,
      lastEventType: 'registration_committed',
    }
    const responses = new Map<string, unknown>([
      ['https://api.example/names/health', {
        ok: true,
        generatedAt: '2026-06-19T12:00:10.000Z',
        source: 'local-indexer-event-log',
        mode: 'event-log',
        schemaVersion: 1,
        currentBlockHeight: 104,
        routes: ['/health', '/commitment'],
        names: 0,
      }],
      [`https://api.example/names/commitment?commitment=${commitment}`, indexedCommitment],
    ])
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => Response.json(responses.get(String(url)) ?? null),
    })

    await expect(client.getHealth()).resolves.toMatchObject({
      schemaVersion: 1,
      currentBlockHeight: 104,
    })
    await expect(client.getCommitment(commitment)).resolves.toEqual(indexedCommitment)
  })

  it('fetches treasury accounting state', async () => {
    const treasury: IndexedTreasuryState = {
      initialized: true,
      operatorAuthority: `0x${'43'.repeat(32)}`,
      operatorRecipient: 'dusk1operator',
      allowedFeeSources: [`0x${'40'.repeat(32)}`],
      totalReceivedLux: 70_000_000_000,
      availableLux: 35_000_000_000,
      registrationReceivedLux: 35_000_000_000,
      renewalReceivedLux: 35_000_000_000,
      otherReceivedLux: 0,
      referralClaimableLux: 7_000_000_000,
      referralClaimedLux: 3_000_000_000,
      referralCount: 2,
      lastFeeSourceContract: `0x${'40'.repeat(32)}`,
      lastFeeReason: 'renewal',
      lastFeeNode: `0x${'42'.repeat(32)}`,
      lastEventType: 'treasury_fee_received',
      txId: 'tx-renew-fee',
      blockHeight: 82,
      claims: [{
        operatorAuthority: `0x${'43'.repeat(32)}`,
        operatorRecipient: 'dusk1operator',
        amountLux: 10_000_000_000,
        remainingLux: 35_000_000_000,
        txId: 'tx-claim',
        blockHeight: 83,
      }],
    }
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => {
        expect(String(url)).toBe('https://api.example/names/treasury')
        return Response.json(treasury)
      },
    })

    await expect(client.getTreasury()).resolves.toEqual(treasury)
  })

  it('fetches referral state for a referrer wallet', async () => {
    const referralState: IndexedReferralState = {
      supported: false,
      referrer: `0x${'44'.repeat(32)}`,
      claimableLux: 0,
      claimedLux: 0,
      referralCount: 0,
      recentActivity: [],
    }
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => {
        expect(String(url)).toBe(`https://api.example/names/referrals?referrer=${referralState.referrer}`)
        return Response.json(referralState)
      },
    })

    await expect(client.getReferralState(referralState.referrer!)).resolves.toEqual(referralState)
  })

  it('fetches fee config', async () => {
    const feeConfig: IndexedFeeConfig = {
      threeCharYearLux: 150_000_000_000,
      fourCharYearLux: 50_000_000_000,
      fivePlusYearLux: 10_000_000_000,
      referralRewardBps: 2_000,
      renewalReferralRewardBps: 1_000,
      premiumReferralRewardBps: 0,
      version: 1,
      updatedAt: 0,
      operator: null,
      txId: null,
      blockHeight: null,
    }
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => {
        expect(String(url)).toBe('https://api.example/names/fee-config')
        return Response.json(feeConfig)
      },
    })

    await expect(client.getFeeConfig()).resolves.toEqual(feeConfig)
  })

  it('treats reverse lookup responses with mismatched node metadata as missing', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async () => Response.json({
        primaryName: 'aurora.dusk',
        node: `0x${'cc'.repeat(32)}`,
      }),
    })

    await expect(client.getPrimaryName({
      type: 'moonlight_address',
      value: 'dusk1abc',
    })).resolves.toBeNull()
  })

  it('treats recognized non-primary reverse endpoint responses as missing', async () => {
    const seenUrls: string[] = []
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async (url) => {
        seenUrls.push(String(url))
        return Response.json(null)
      },
    })

    await expect(client.getPrimaryName({
      type: 'phoenix_payment_endpoint',
      value: 'phoenix-public-endpoint',
    })).resolves.toBeNull()
    expect(seenUrls).toEqual([
      'https://api.example/names/reverse?type=phoenix_payment_endpoint&value=phoenix-public-endpoint',
    ])
  })

  it('surfaces unsupported reverse endpoint type errors from the indexer', async () => {
    const client = createDuskDomainsIndexerClient({
      baseUrl: 'https://api.example/names',
      fetch: async () => Response.json({
        error: 'unsupported_endpoint_type',
        type: 'text.handle',
        message: 'text.handle is not a supported reverse endpoint type.',
      }, { status: 400 }),
    })

    await expect(client.getPrimaryName({
      type: 'text.handle',
      value: 'aurora',
    })).rejects.toThrow('text.handle is not a supported reverse endpoint type')
  })

  it('fetches search, lifecycle, activity, and subname read models', async () => {
    const node = `0x${'18'.repeat(32)}`
    const subnameNode = `0x${'19'.repeat(32)}`
    const search: NameResult = {
      canonical: 'aurora.dusk',
      canonicalRaw: 'aurora.dusk',
      displayName: 'aurora.dusk',
      label: 'aurora',
      status: 'available',
      price: 50,
      issues: [],
      transactionBlocked: false,
    }
    const nameState: IndexedLifecycleName = {
      node,
      canonicalName: 'aurora.dusk',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolverId: `0x${'44'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      graceEndsAt: '2027-07-17T00:00:00.000Z',
      status: 'active',
      lastEventType: 'name_registered',
    }
    const nameSummary: IndexedNameSummary = {
      ...nameState,
      records: [],
      primaryName: 'aurora.dusk',
      primaryStatus: 'verified',
      subnameCount: 1,
      activityCount: 1,
    }
    const activity: ActivityEntry[] = [{
      id: `registration:${node}:dusk1owner:tx-1`,
      eventType: 'registration',
      node,
      name: 'aurora.dusk',
      actor: 'dusk1owner',
      target: 'dusk1owner',
      timestamp: '2026-06-17T00:00:00.000Z',
      blockHeight: 42,
      txId: 'tx-1',
    }]
    const subname: IndexedSubname = {
      parentNode: node,
      node: subnameNode,
      parentName: 'aurora.dusk',
      name: 'pay.aurora.dusk',
      label: 'pay',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'44'.repeat(32)}`,
      expiresAt: '2027-06-17T00:00:00.000Z',
      parentExpiresAt: '2027-06-17T00:00:00.000Z',
      expiryPolicy: 'inherits_parent',
      revocationPolicy: 'parent_revocable',
      status: 'active',
      createdAt: '2026-06-17T00:00:00.000Z',
      revokedAt: null,
      lastEventType: 'subname_created',
      txId: 'tx-subname',
      blockHeight: 43,
    }
    const responses = new Map<string, unknown>([
      ['/api/dusk-domains/search?query=Aurora', search],
      [`/api/dusk-domains/name?node=${node}`, nameState],
      ['/api/dusk-domains/names?owner=dusk1owner', [nameSummary]],
      [`/api/dusk-domains/activity?node=${node}`, activity],
      [`/api/dusk-domains/subnames?parentNode=${node}`, [subname]],
      [`/api/dusk-domains/subname?node=${subnameNode}`, subname],
    ])
    const client = createDuskDomainsIndexerClient({
      baseUrl: '/api/dusk-domains',
      fetch: async (url) => {
        const payload = responses.get(String(url))
        if (!payload) return Response.json({ error: 'not found' }, { status: 404 })
        return Response.json(payload)
      },
    })

    await expect(client.searchName('Aurora')).resolves.toEqual(search)
    await expect(client.getNameState(node)).resolves.toEqual(nameState)
    await expect(client.getNames({ owner: 'dusk1owner' })).resolves.toEqual([nameSummary])
    await expect(client.getActivity(node)).resolves.toEqual(activity)
    await expect(client.getSubnames(node)).resolves.toEqual([subname])
    await expect(client.getSubname(subnameNode)).resolves.toEqual(subname)
  })

})
