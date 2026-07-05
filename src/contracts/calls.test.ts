import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { dataDrivers } from '@dusk/w3sper'
import { describe, expect, it } from 'vitest'
import {
  DUSK_DOMAINS_CONTRACTS,
  coreClearPrimaryNameRuntimeCall,
  coreClearRecordSenderRuntimeCall,
  coreCommitRuntimeCall,
  coreCompleteRegistrationRuntimeCall,
  coreCreateSubnameRuntimeCall,
  coreFeeConfigCall,
  coreGetNameCall,
  coreInitCall,
  coreMutateRecordsSenderRuntimeCall,
  corePendingCommitmentCall,
  coreReadPrimaryNameCall,
  coreReadRecordCall,
  coreRenewRuntimeCall,
  coreSetFeeConfigRuntimeCall,
  coreUpdateAuthoritiesRuntimeCall,
  coreSetPrimaryNameRuntimeCall,
  coreSetReferralConfigRuntimeCall,
  coreSetRecordSenderRuntimeCall,
  decodeDuskDomainOutput,
  decodedDuskDomainContext,
  duskDomainCallDepositLux,
  encodeDuskDomainCall,
  prepareDuskDomainContractCall,
  toDuskDomainWireArgs,
  treasuryClaimAllReferralRewardsRuntimeCall,
  treasuryClaimAllRuntimeCall,
  treasuryClaimReferralRewardRuntimeCall,
  treasuryClaimRuntimeCall,
  treasuryInitCall,
  treasuryReadStateCall,
  treasuryUpdateOperatorRuntimeCall,
  type DuskConnectAppLike,
  type DuskDataDriverLike,
  type DuskDomainCallMetadata,
} from './calls'
import { registrationCommitmentHex, registrationCommitWindow } from '../core/commitment'
import { decodeBase58 } from '../core/principal'
import type { DuskPrincipal } from '../core/principal'

const node = `0x${'07'.repeat(32)}`
const parentNode = `0x${'08'.repeat(32)}`
const commitment = `0x${'31'.repeat(32)}`
const secret = `0x${'03'.repeat(32)}`
const owner = `0x${'09'.repeat(32)}`
const treasuryContract = `0x${'43'.repeat(32)}`
const coreContract = `0x${'44'.repeat(32)}`
const recipient = '244Sywxj7PuMHpcPxemaXLcrY5rPgztra6H9Vz8cU1Ro5v23SxKTfVqr2yS7NXAXE1iq59ndn4aMZmYxuzu3Te3e9fokQKTUkYvFxYg2P2E8EEg1gWUbs3AFL2aNx62HQd7r'
const endpointValue = recipient
const endpointBytes = Array.from(decodeBase58(endpointValue) ?? [])

function fakeDriver(): DuskDataDriverLike {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return {
    encodeInputFn(fnName, json) {
      return encoder.encode(JSON.stringify({ fnName, json: JSON.parse(json) }))
    },
    decodeOutputFn(fnName, bytes) {
      return {
        fnName,
        output: JSON.parse(decoder.decode(bytes)),
      }
    },
  }
}

function operatorPrincipal(): DuskPrincipal {
  return {
    kind: 'Moonlight',
    bytes: Array.from({ length: 96 }, (_, index) => index + 1),
  }
}

function registrationCall() {
  return coreCompleteRegistrationRuntimeCall({
    commitment,
    secret,
    node,
    label: 'aurora',
    durationYears: 1,
    feeLux: 50_000_000_000,
    records: [{
      key: 'moonlight_address',
      value: endpointValue,
      visibility: 'public',
      updatedAt: '2026-06-17T00:00:00.000Z',
      ttlSeconds: 300,
    }],
    primaryEndpoint: {
      endpointType: 'moonlight_address',
      endpointValue,
    },
    referrer: operatorPrincipal(),
  })
}

function schemaCalls(): DuskDomainCallMetadata[] {
  return [
    coreInitCall({
      treasuryContract,
      recordSourceContract: coreContract,
      operator: operatorPrincipal(),
      referralRewardBps: 1500,
    }),
    coreSetReferralConfigRuntimeCall({ referralRewardBps: 1000 }),
    coreSetFeeConfigRuntimeCall({
      threeCharYearLux: 150_000_000_000,
      fourCharYearLux: 50_000_000_000,
      fivePlusYearLux: 10_000_000_000,
      referralRewardBps: 2_000,
      renewalReferralRewardBps: 1_000,
      premiumReferralRewardBps: 0,
    }),
    coreCommitRuntimeCall({ commitment }),
    registrationCall(),
    coreRenewRuntimeCall({ node, durationYears: 1, feeLux: 50_000_000_000 }),
    coreUpdateAuthoritiesRuntimeCall({
      node,
      owner,
      manager: `0x${'10'.repeat(32)}`,
    }),
    coreSetRecordSenderRuntimeCall({
      node,
      record: {
        key: 'website',
        value: 'https://dusk.domains',
        visibility: 'public',
        updatedAt: '2026-06-17T00:00:00.000Z',
        ttlSeconds: 3600,
      },
    }),
    coreClearRecordSenderRuntimeCall({ node, key: 'website' }),
    coreMutateRecordsSenderRuntimeCall({
      node,
      mutations: [
        {
          action: 'set',
          key: 'website',
          value: 'https://dusk.domains',
          ttlSeconds: 3600,
        },
        {
          action: 'clear',
          key: 'avatar',
        },
      ],
    }),
    coreSetPrimaryNameRuntimeCall({
      endpointType: 'moonlight_address',
      endpointValue,
      node,
      name: 'aurora.dusk',
    }),
    coreClearPrimaryNameRuntimeCall({ endpointType: 'moonlight_address', endpointValue }),
    coreCreateSubnameRuntimeCall({
      parentNode,
      node,
      parentName: 'aurora.dusk',
      name: 'settlement.aurora.dusk',
      label: 'settlement',
      owner,
      manager: owner,
      expiresAt: 1_820_000_000,
      expiryPolicy: 'inherits_parent',
      revocationPolicy: 'parent_revocable',
    }),
    coreGetNameCall({ node }),
    coreReadRecordCall({ node, key: 'moonlight_address' }),
    coreReadPrimaryNameCall({ endpointType: 'moonlight_address', endpointValue }),
    corePendingCommitmentCall({ commitment }),
    coreFeeConfigCall(),
    treasuryInitCall({
      operator: operatorPrincipal(),
      operatorRecipient: recipient,
      allowedFeeSources: [coreContract],
    }),
    treasuryUpdateOperatorRuntimeCall({
      operator: operatorPrincipal(),
      operatorRecipient: recipient,
    }),
    treasuryClaimRuntimeCall({ amountLux: 10_000_000_000 }),
    treasuryClaimAllRuntimeCall(),
    treasuryClaimReferralRewardRuntimeCall({ amountLux: 1_000_000_000, recipient }),
    treasuryClaimAllReferralRewardsRuntimeCall({ recipient }),
    treasuryReadStateCall(),
  ]
}

describe('Dusk Domains contract call helpers', () => {
  it('derives deterministic hidden registration commitments', () => {
    const input = {
      node,
      controller: owner,
      label: 'aurora',
      secret,
    }

    expect(registrationCommitmentHex(input)).toBe(registrationCommitmentHex(input))
    expect(registrationCommitmentHex(input)).not.toBe(input.node)
  })

  it('classifies registration commitments by block height', () => {
    expect(registrationCommitWindow(null, 100)).toMatchObject({ status: 'missing' })
    expect(registrationCommitWindow(100, null)).toMatchObject({ status: 'missing' })
    expect(registrationCommitWindow(100, 103)).toMatchObject({ status: 'waiting', waitBlocks: 2 })
    expect(registrationCommitWindow(100, 105)).toMatchObject({ status: 'ready', waitBlocks: 0 })
    expect(registrationCommitWindow(100, 8_741)).toMatchObject({ status: 'stale' })
  })

  it('keeps the public contract surface to core and treasury', () => {
    expect(Object.keys(DUSK_DOMAINS_CONTRACTS)).toEqual(['core', 'treasury'])
  })

  it('encodes core registration payloads for the data-driver schema', () => {
    expect(toDuskDomainWireArgs(registrationCall())).toMatchObject({
      commitment: Array(32).fill(49),
      secret: Array(32).fill(3),
      node: Array(32).fill(7),
      label: 'aurora',
      duration_years: 1,
      fee_lux: 50_000_000_000,
      records: [{
        key: 'moonlight_address',
        value: endpointBytes,
        ttl_seconds: 300,
        updated_at: 1_781_654_400,
      }],
      primary_endpoint: {
        kind: 'MoonlightAddress',
        value: endpointBytes,
      },
      referrer: operatorPrincipal(),
    })
  })

  it('encodes core record and primary-name calls as sender-bound one-step writes', () => {
    expect(toDuskDomainWireArgs(coreUpdateAuthoritiesRuntimeCall({
      node,
      owner,
      manager: `0x${'10'.repeat(32)}`,
    }))).toEqual({
      node: Array(32).fill(7),
      owner: Array(32).fill(9),
      manager: Array(32).fill(16),
    })

    expect(toDuskDomainWireArgs(coreSetRecordSenderRuntimeCall({
      node,
      record: {
        key: 'website',
        value: 'https://dusk.domains',
        visibility: 'public',
        updatedAt: '2026-06-17T00:00:00.000Z',
        ttlSeconds: 3600,
      },
    }))).toEqual({
      node: Array(32).fill(7),
      record: {
        key: 'website',
        value: Array.from(new TextEncoder().encode('https://dusk.domains')),
        ttl_seconds: 3600,
        updated_at: 1_781_654_400,
      },
    })

    expect(toDuskDomainWireArgs(coreSetPrimaryNameRuntimeCall({
      endpointType: 'moonlight_address',
      endpointValue,
      node,
      name: 'aurora.dusk',
    }))).toEqual({
      endpoint: {
        kind: 'MoonlightAddress',
        value: endpointBytes,
      },
      node: Array(32).fill(7),
      name: 'aurora.dusk',
    })

    expect(toDuskDomainWireArgs(coreMutateRecordsSenderRuntimeCall({
      node,
      mutations: [
        {
          action: 'set',
          key: 'website',
          value: 'https://dusk.domains',
          ttlSeconds: 3600,
        },
        {
          action: 'clear',
          key: 'avatar',
        },
      ],
    }))).toEqual({
      node: Array(32).fill(7),
      mutations: [
        {
          action: 'Set',
          key: 'website',
          value: Array.from(new TextEncoder().encode('https://dusk.domains')),
          ttl_seconds: 3600,
        },
        {
          action: 'Clear',
          key: 'avatar',
          value: [],
          ttl_seconds: 0,
        },
      ],
    })
  })

  it('rejects malformed arguments for recognized contract methods before wallet preparation', () => {
    expect(() => toDuskDomainWireArgs({
      contract: 'core',
      functionName: 'complete_registration_runtime',
      kind: 'write',
      args: { commitment },
    })).toThrow('Invalid Dusk Domains core.complete_registration_runtime arguments')

    expect(() => toDuskDomainWireArgs({
      contract: 'treasury',
      functionName: 'claim_referral_reward_runtime',
      kind: 'write',
      args: { amountLux: 10_000_000_000 },
    })).toThrow('Invalid Dusk Domains treasury.claim_referral_reward_runtime arguments')
  })

  it('keeps raw passthrough available only for unknown debug calls', () => {
    const raw = { opaque: true }
    expect(toDuskDomainWireArgs({
      contract: 'core',
      functionName: 'debug_passthrough',
      kind: 'read',
      args: raw,
    })).toBe(raw)
  })

  it('attaches deposits only to paid core registration and renewal calls', async () => {
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async writeContract() {
        throw new Error('unused')
      },
      async prepareContractCall(params) {
        return params
      },
    }

    await expect(prepareDuskDomainContractCall(app, registrationCall())).resolves.toMatchObject({
      contract: { name: 'Dusk Domains Core' },
      functionName: 'complete_registration_runtime',
      deposit: '50000000000',
    })
    expect(duskDomainCallDepositLux(coreRenewRuntimeCall({ node, durationYears: 1, feeLux: 50_000_000_000 }))).toBe('50000000000')
    expect(duskDomainCallDepositLux(coreCommitRuntimeCall({ commitment }))).toBeUndefined()
    expect(duskDomainCallDepositLux(treasuryClaimRuntimeCall({ amountLux: 1_000_000_000 }))).toBeUndefined()
  })

  it('provides wallet approval context for core and treasury writes', () => {
    expect(decodedDuskDomainContext(registrationCall())).toMatchObject({
      title: 'Register aurora.dusk',
      fields: expect.arrayContaining([
        { label: 'Registration fee', value: '50 DUSK' },
        { label: 'Records', value: '1' },
      ]),
    })
    expect(decodedDuskDomainContext(treasuryClaimAllRuntimeCall())).toMatchObject({
      title: 'Claim all collected fees',
    })
    expect(decodedDuskDomainContext(treasuryUpdateOperatorRuntimeCall({
      operator: operatorPrincipal(),
      operatorRecipient: recipient,
    }))).toMatchObject({
      title: 'Update treasury operator',
      fields: expect.arrayContaining([
        { label: 'Operator', value: recipient },
        { label: 'Claim recipient', value: recipient },
      ]),
    })
    expect(decodedDuskDomainContext(coreSetRecordSenderRuntimeCall({
      node,
      record: {
        key: 'website',
        value: 'https://dusk.domains',
        visibility: 'public',
        updatedAt: '2026-06-17T00:00:00.000Z',
        ttlSeconds: 3600,
      },
    }))).toMatchObject({
      title: 'Update website',
    })
    expect(decodedDuskDomainContext(coreUpdateAuthoritiesRuntimeCall({
      node,
      owner,
      manager: `0x${'10'.repeat(32)}`,
    }))).toMatchObject({
      title: 'Update domain authorities',
      fields: expect.arrayContaining([
        { label: 'Owner authority', value: owner },
        { label: 'Manager authority', value: `0x${'10'.repeat(32)}` },
      ]),
    })
  })

  it('encodes and decodes through a data-driver-like adapter', () => {
    const driver = fakeDriver()
    const call = coreCommitRuntimeCall({ commitment })
    const encoded = encodeDuskDomainCall(driver, call)
    const decoded = decodeDuskDomainOutput(driver, call, new TextEncoder().encode(JSON.stringify({ ok: true })))

    expect(JSON.parse(new TextDecoder().decode(encoded))).toEqual({
      fnName: 'commit_runtime',
      json: { commitment: Array(32).fill(49) },
    })
    expect(decoded).toEqual({
      fnName: 'commit_runtime',
      output: { ok: true },
    })
  })

  it('covers every configured method with a fixture', () => {
    const expectedMethods = Object.entries(DUSK_DOMAINS_CONTRACTS)
      .flatMap(([contract, preset]) => Object.keys(preset.methodSigs).map((functionName) => `${contract}.${functionName}`))
      .sort()
    const actualMethods = schemaCalls().map((call) => `${call.contract}.${call.functionName}`).sort()

    expect(new Set(actualMethods).size).toBe(actualMethods.length)
    expect(actualMethods).toEqual(expectedMethods)
  })

  it('encodes configured calls with generated data-driver schemas when artifacts are present', async () => {
    const driverFiles = {
      core: 'dusk-domains-core.data-driver.wasm',
      treasury: 'dusk-domains-treasury.data-driver.wasm',
    } as const
    const publicContractsDir = resolve(process.cwd(), 'public/contracts')

    if (!Object.values(driverFiles).every((file) => existsSync(resolve(publicContractsDir, file)))) {
      console.warn('Skipping generated data-driver call validation; run `npm run deploy:contracts -- --build --validate-drivers` first.')
      return
    }

    const drivers = Object.fromEntries(await Promise.all(Object.entries(driverFiles).map(async ([key, file]) => {
      const driver = await dataDrivers.load(await readFile(resolve(publicContractsDir, file)))
      driver.init?.()
      return [key, driver as DuskDataDriverLike & { getSchema?: () => { functions?: Array<{ name: string }> } }]
    }))) as Record<keyof typeof driverFiles, DuskDataDriverLike & { getSchema?: () => { functions?: Array<{ name: string }> } }>

    for (const [contract, driver] of Object.entries(drivers) as Array<[keyof typeof driverFiles, DuskDataDriverLike & { getSchema?: () => { functions?: Array<{ name: string }> } }]>) {
      const schemaFunctions = driver.getSchema?.().functions?.map((fn) => fn.name).filter((name) => (
        !['receive_fee', 'accrue_referral_reward'].includes(name)
      )).sort() ?? []
      const configuredFunctions = Object.keys(DUSK_DOMAINS_CONTRACTS[contract].methodSigs).sort()
      expect(schemaFunctions).toEqual(configuredFunctions)
    }

    for (const call of schemaCalls()) {
      const schemaFunctions = drivers[call.contract].getSchema?.().functions?.map((fn) => fn.name) ?? []
      expect(schemaFunctions).toContain(call.functionName)
      try {
        encodeDuskDomainCall(drivers[call.contract], call)
      } catch (error) {
        throw new Error(`${call.contract}.${call.functionName}: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        })
      }
    }
  })
})
