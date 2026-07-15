import { describe, expect, it } from 'vitest'
import {
  createDuskDomainsOnChainClient,
  type DuskDomainsOnChainReadTransport,
} from './sdkOnChain'
import { namehashHex } from '../core/namehash'
import {
  toDuskDomainWireArgs,
  type DuskDomainCallMetadata,
} from '../contracts/calls'
import { decodeBase58 } from '../core/principal'

const endpointValue = '244Sywxj7PuMHpcPxemaXLcrY5rPgztra6H9Vz8cU1Ro5v23SxKTfVqr2yS7NXAXE1iq59ndn4aMZmYxuzu3Te3e9fokQKTUkYvFxYg2P2E8EEg1gWUbs3AFL2aNx62HQd7r'
const node = namehashHex('aurora.dusk')
const evilNode = namehashHex('evil.dusk')
const owner = `0x${'09'.repeat(32)}`
const manager = `0x${'10'.repeat(32)}`
const commitment = `0x${'31'.repeat(32)}`

describe('Dusk Domains on-chain SDK reads', () => {
  it('exposes the canonical node height used by lifecycle checks', async () => {
    const { client } = onChainClient(() => nameResponse(), 3_718_430)

    await expect(client.getCurrentBlockHeight()).resolves.toEqual({
      ok: true,
      value: 3_718_430,
    })
  })

  it('fails closed when canonical node height is unavailable', async () => {
    const { client } = onChainClient(() => nameResponse(), () => null)

    await expect(client.getCurrentBlockHeight()).resolves.toMatchObject({
      ok: false,
      error: { code: 'lifecycle_unavailable' },
    })
  })

  it('normalizes names and reads canonical name ownership from the core contract', async () => {
    const { client, calls } = onChainClient((call) => {
      expect(call.functionName).toBe('get_name')
      return nameResponse()
    })

    await expect(client.getName('Aurora.dusk')).resolves.toMatchObject({
      ok: true,
      value: {
        canonicalName: 'aurora.dusk',
        node,
        record: {
          label: 'aurora',
          owner,
          manager,
          lifecycle: {
            expiresAtBlock: 12_345,
            graceEndsAtBlock: 14_937,
          },
        },
      },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ contract: 'core', functionName: 'get_name', kind: 'read' })
    expect(toDuskDomainWireArgs(calls[0])).toEqual({ node: hexBytes(node) })
  })

  it('returns the third-party-friendly owner authority for a registered name', async () => {
    const { client } = onChainClient(() => nameResponse())

    await expect(client.getNameOwner('aurora.dusk')).resolves.toEqual({
      ok: true,
      value: owner,
    })
  })

  it('supports direct node lookup and rejects malformed nodes', async () => {
    const { client, calls } = onChainClient((call) => {
      expect(call.functionName).toBe('get_name')
      return nameResponse()
    })

    await expect(client.getNameByNode(node)).resolves.toMatchObject({
      ok: true,
      value: {
        canonicalName: null,
        node,
        record: {
          owner,
        },
      },
    })
    await expect(client.getNameByNode('0x1234')).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_node' },
    })
    expect(calls).toHaveLength(1)
  })

  it('reports missing names through owner and record helpers', async () => {
    const { client } = onChainClient(() => ({ node: hexBytes(node), record: null }))

    await expect(client.getNameOwner('aurora.dusk')).resolves.toMatchObject({
      ok: false,
      error: { code: 'missing_name' },
    })
    await expect(client.getRecord('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: false,
      error: { code: 'missing_name' },
    })
  })

  it('reads a canonical record by alias without using the indexer', async () => {
    const { client, calls } = onChainClient((call) => {
      if (call.functionName === 'get_name') return nameResponse()
      if (call.functionName === 'read_record') {
        return recordResponse('moonlight_address', endpointValue)
      }
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.getRecord('aurora.dusk', 'dusk_public_address')).resolves.toMatchObject({
      ok: true,
      value: {
        key: 'moonlight_address',
        value: endpointValue,
        visibility: 'public',
        ttlSeconds: 300,
        updatedAtBlock: 2_001,
      },
    })

    expect(calls.map((call) => call.functionName)).toEqual(['get_name', 'read_record'])
    expect(toDuskDomainWireArgs(calls[1])).toEqual({
      node: hexBytes(node),
      key: 'moonlight_address',
    })
  })

  it('reads a bounded set of known records and ignores unset keys', async () => {
    const { client, calls } = onChainClient((call) => {
      if (call.functionName === 'get_name') return nameResponse()
      if (call.functionName === 'read_record' && call.args && 'key' in call.args) {
        if (call.args.key === 'website') return recordResponse('website', 'https://dusk.domains', 3_600)
        return { node: hexBytes(node), key: call.args.key, record: null }
      }
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.getRecords('aurora.dusk', ['moonlight_address', 'website'])).resolves.toMatchObject({
      ok: true,
      value: [{
        key: 'website',
        value: 'https://dusk.domains',
      }],
    })
    expect(calls.map((call) => call.functionName)).toEqual(['get_name', 'read_record', 'read_record'])
  })

  it('distinguishes missing records from malformed records', async () => {
    const missing = onChainClient((call) => {
      if (call.functionName === 'get_name') return nameResponse()
      return { node: hexBytes(node), key: 'moonlight_address', record: null }
    })
    await expect(missing.client.getRecord('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: false,
      error: { code: 'record_missing' },
    })

    const malformed = onChainClient((call) => {
      if (call.functionName === 'get_name') return nameResponse()
      return recordResponse('moonlight_address', 'not-a-dusk-address', 300, true)
    })
    await expect(malformed.client.getRecord('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_record' },
    })
  })

  it('verifies primary names with read_primary_name plus a forward record check', async () => {
    const { client, calls } = onChainClient((call) => {
      if (call.functionName === 'read_primary_name') return primaryNameResponse(endpointValue)
      if (call.functionName === 'get_name') return nameResponse()
      if (call.functionName === 'read_record') return recordResponse('moonlight_address', endpointValue)
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.verifyPrimaryName({
      type: 'moonlight_address',
      value: endpointValue,
    }, 'aurora.dusk')).resolves.toMatchObject({
      ok: true,
      value: {
        primaryName: 'aurora.dusk',
        node,
        verified: true,
      },
    })

    expect(calls.map((call) => call.functionName)).toEqual(['read_primary_name', 'get_name', 'read_record'])
  })

  it('rejects forward/reverse mismatches without falling back to the indexer', async () => {
    const { client } = onChainClient((call) => {
      if (call.functionName === 'read_primary_name') return primaryNameResponse(endpointValue)
      if (call.functionName === 'get_name') return nameResponse()
      if (call.functionName === 'read_record') return recordResponse('moonlight_address', 'dusk1localresolverproof02')
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.verifyPrimaryName({
      type: 'moonlight_address',
      value: endpointValue,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'forward_reverse_mismatch' },
    })
  })

  it('fails closed for expired direct routing reads', async () => {
    const { client } = onChainClient((call) => {
      if (call.functionName === 'get_name') return nameResponse({ expiresAtBlock: 11_999 })
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.getRecord('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: false,
      error: { code: 'expired_name' },
    })
    await expect(client.resolveName('aurora.dusk')).resolves.toMatchObject({
      ok: false,
      error: { code: 'expired_name' },
    })
  })

  it('fails closed for expired primary-name direct reads', async () => {
    const { client } = onChainClient((call) => {
      if (call.functionName === 'read_primary_name') return primaryNameResponse(endpointValue)
      if (call.functionName === 'get_name') return nameResponse({ expiresAtBlock: 11_999 })
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    const endpoint = {
      type: 'moonlight_address' as const,
      value: endpointValue,
    }
    await expect(client.getPrimaryName(endpoint)).resolves.toMatchObject({
      ok: false,
      error: { code: 'expired_name' },
    })
    await expect(client.verifyPrimaryName(endpoint)).resolves.toMatchObject({
      ok: false,
      error: { code: 'expired_name' },
    })
  })

  it('requires current block height for direct routing reads', async () => {
    const { client } = onChainClient((call) => {
      if (call.functionName === 'get_name') return nameResponse()
      throw new Error(`unexpected call: ${call.functionName}`)
    }, () => null)

    await expect(client.getRecord('aurora.dusk', 'moonlight_address')).resolves.toMatchObject({
      ok: false,
      error: { code: 'lifecycle_unavailable' },
    })
  })

  it('rejects primary records whose displayed name does not match the stored node', async () => {
    const { client } = onChainClient((call) => {
      if (call.functionName === 'read_primary_name') {
        return primaryNameResponse(endpointValue, {
          nodeOverride: evilNode,
          nameOverride: 'aurora.dusk',
        })
      }
      if (call.functionName === 'read_record') return recordResponse('moonlight_address', endpointValue)
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.verifyPrimaryName({
      type: 'moonlight_address',
      value: endpointValue,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'forward_reverse_mismatch' },
    })
  })

  it('maps pending commitment and fee config direct reads', async () => {
    const { client, calls } = onChainClient((call) => {
      if (call.functionName === 'pending_commitment') {
        return {
          commitment: hexBytes(commitment),
          pending: {
            controller: hexBytes(owner),
            created_at: 987,
          },
        }
      }
      if (call.functionName === 'fee_config') {
        return {
          three_char_year_lux: 150_000_000_000,
          four_char_year_lux: 50_000_000_000,
          five_plus_year_lux: 10_000_000_000,
          referral_reward_bps: 2_000,
          renewal_referral_reward_bps: 1_000,
          premium_referral_reward_bps: 0,
          version: 3,
          updated_at: 12_000,
        }
      }
      throw new Error(`unexpected call: ${call.functionName}`)
    })

    await expect(client.getPendingCommitment(commitment)).resolves.toMatchObject({
      ok: true,
      value: {
        commitment,
        pending: {
          controller: owner,
          createdAtBlock: 987,
        },
      },
    })
    await expect(client.getFeeConfig()).resolves.toMatchObject({
      ok: true,
      value: {
        fivePlusYearLux: 10_000_000_000,
        renewalReferralRewardBps: 1_000,
        version: 3,
      },
    })
    expect(calls.map((call) => call.functionName)).toEqual(['pending_commitment', 'fee_config'])
  })
})

function onChainClient(
  handler: (call: DuskDomainCallMetadata) => unknown,
  currentBlockHeight: number | (() => number | null | Promise<number | null>) = 12_000,
) {
  const calls: DuskDomainCallMetadata[] = []
  const read: DuskDomainsOnChainReadTransport = {
    async read(call) {
      calls.push(call)
      return handler(call)
    },
  }

  return {
    client: createDuskDomainsOnChainClient({ read, currentBlockHeight }),
    calls,
  }
}

function nameResponse(options: { expiresAtBlock?: number; graceEndsAtBlock?: number } = {}) {
  const expiresAtBlock = options.expiresAtBlock ?? 12_345
  return {
    node: hexBytes(node),
    marketplace_transferable: true,
    record: {
      label: 'aurora',
      owner: hexBytes(owner),
      manager: hexBytes(manager),
      lifecycle: {
        expires_at: expiresAtBlock,
        grace_ends_at: options.graceEndsAtBlock ?? expiresAtBlock + 2_592,
      },
      referrer: null,
    },
  }
}

function recordResponse(key: string, value: string, ttlSeconds = 300, rawString = false) {
  return {
    node: hexBytes(node),
    key,
    record: {
      key,
      value: rawString ? value : recordBytes(key, value),
      ttl_seconds: ttlSeconds,
      updated_at: 2_001,
    },
  }
}

function primaryNameResponse(value: string, options: { nodeOverride?: string; nameOverride?: string } = {}) {
  return {
    endpoint: {
      kind: 'MoonlightAddress',
      value: recordBytes('moonlight_address', value),
    },
    record: {
      node: hexBytes(options.nodeOverride ?? node),
      name: options.nameOverride ?? 'aurora.dusk',
      updated_at: 3_001,
    },
  }
}

function recordBytes(key: string, value: string) {
  if (key === 'moonlight_address') {
    return Array.from(decodeBase58(value) ?? new TextEncoder().encode(value))
  }
  return Array.from(new TextEncoder().encode(value))
}

function hexBytes(value: string) {
  const hex = value.slice(2)
  return Array.from({ length: hex.length / 2 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}
