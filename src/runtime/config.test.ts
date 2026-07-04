import { describe, expect, it } from 'vitest'
import {
  createDuskDomainsRuntimeConfig,
  createDuskNamesRuntimeConfig,
  isValidDuskContractId,
  isValidLaunchLinkUrl,
  isValidRuntimeUrl,
} from './config'
import { DUSK_NAME_PLACEHOLDER_CONTRACT_ID } from '../contracts/callContracts'

describe('Dusk Domains runtime config', () => {
  it('defaults to preview mode when core, treasury, and indexer are missing', () => {
    const config = createDuskNamesRuntimeConfig()

    expect(config.mode).toBe('preview')
    expect(Object.keys(config.contracts)).toEqual(['core', 'treasury'])
    expect(config.contracts.core.contractId).toBe(DUSK_NAME_PLACEHOLDER_CONTRACT_ID)
    expect(config.contracts.treasury.contractId).toBe(DUSK_NAME_PLACEHOLDER_CONTRACT_ID)
    expect(config.indexerUrl).toBeNull()
    expect(config.nodeUrl).toBe('https://testnet.nodes.dusk.network')
    expect(config.chainId).toBe('dusk:2')
    expect(config.liveWritesEnabled).toBe(false)
    expect(config.capabilities.referralAttribution).toBe(false)
    expect(config.capabilities.referralRewardClaims).toBe(false)
    expect(config.launchLinks).toEqual({
      support: null,
      abuse: null,
      security: null,
      status: null,
    })
    expect(config.missingLiveInputs).toEqual([
      'VITE_DUSK_DOMAINS_INDEXER_URL',
      'VITE_DUSK_DOMAINS_CORE_CONTRACT_ID',
      'VITE_DUSK_DOMAINS_TREASURY_CONTRACT_ID',
    ])
  })

  it('uses live-ready mode when core, treasury, and the indexer URL are configured', () => {
    const config = createDuskDomainsRuntimeConfig({
      VITE_DUSK_DOMAINS_CORE_CONTRACT_ID: `0x${'77'.repeat(32)}`,
      VITE_DUSK_DOMAINS_TREASURY_CONTRACT_ID: `0x${'66'.repeat(32)}`,
      VITE_DUSK_DOMAINS_CORE_DRIVER_URL: '/contracts/dusk-names-core.data-driver.wasm',
      VITE_DUSK_DOMAINS_TREASURY_DRIVER_URL: 'https://cdn.example/dusk-name-treasury.wasm',
      VITE_DUSK_DOMAINS_INDEXER_URL: '/api/dusk-domains',
      VITE_DUSK_DOMAINS_NODE_URL: 'https://nodes.example',
      VITE_DUSK_DOMAINS_CHAIN_ID: 'dusk:3',
      VITE_DUSK_DOMAINS_ENABLE_LIVE_WRITES: 'true',
      VITE_DUSK_DOMAINS_SUPPORT_URL: 'https://support.example',
      VITE_DUSK_DOMAINS_ABUSE_URL: 'mailto:abuse@example.test',
      VITE_DUSK_DOMAINS_SECURITY_URL: '/security',
      VITE_DUSK_DOMAINS_STATUS_URL: 'https://status.example',
    })

    expect(config.mode).toBe('live_ready')
    expect(config.contracts.core).toMatchObject({
      contractId: `0x${'77'.repeat(32)}`,
      driverUrl: '/contracts/dusk-names-core.data-driver.wasm',
    })
    expect(config.contracts.treasury).toMatchObject({
      contractId: `0x${'66'.repeat(32)}`,
      driverUrl: 'https://cdn.example/dusk-name-treasury.wasm',
    })
    expect(config.indexerUrl).toBe('/api/dusk-domains')
    expect(config.nodeUrl).toBe('https://nodes.example')
    expect(config.chainId).toBe('dusk:3')
    expect(config.liveWritesEnabled).toBe(true)
    expect(config.launchLinks).toEqual({
      support: 'https://support.example',
      abuse: 'mailto:abuse@example.test',
      security: '/security',
      status: 'https://status.example',
    })
    expect(config.missingLiveInputs).toEqual([])
    expect(config.warnings).toEqual([])
  })

  it('keeps legacy VITE_DUSK_NAMES env vars as compatibility aliases', () => {
    const config = createDuskNamesRuntimeConfig({
      VITE_DUSK_NAMES_CORE_CONTRACT_ID: `0x${'77'.repeat(32)}`,
      VITE_DUSK_NAMES_TREASURY_CONTRACT_ID: `0x${'66'.repeat(32)}`,
      VITE_DUSK_NAMES_INDEXER_URL: '/api/dusk-names',
      VITE_DUSK_NAMES_ENABLE_LIVE_WRITES: 'true',
    })

    expect(config.mode).toBe('live_ready')
    expect(config.contracts.core.contractId).toBe(`0x${'77'.repeat(32)}`)
    expect(config.contracts.treasury.contractId).toBe(`0x${'66'.repeat(32)}`)
    expect(config.indexerUrl).toBe('/api/dusk-names')
    expect(config.liveWritesEnabled).toBe(true)
  })

  it('enables referral attribution and claims only when requested on the core treasury path', () => {
    const config = createDuskNamesRuntimeConfig({
      VITE_DUSK_NAMES_CORE_CONTRACT_ID: `0x${'77'.repeat(32)}`,
      VITE_DUSK_NAMES_TREASURY_CONTRACT_ID: `0x${'66'.repeat(32)}`,
      VITE_DUSK_NAMES_INDEXER_URL: '/api/dusk-names',
      VITE_DUSK_NAMES_ENABLE_REFERRAL_ATTRIBUTION: 'true',
      VITE_DUSK_NAMES_ENABLE_REFERRAL_CLAIMS: 'true',
    })

    expect(config.mode).toBe('live_ready')
    expect(config.capabilities.referralAttribution).toBe(true)
    expect(config.capabilities.referralRewardClaims).toBe(true)
    expect(config.warnings).toEqual([])
  })

  it('warns when referral features are requested without deployed contracts', () => {
    const config = createDuskNamesRuntimeConfig({
      VITE_DUSK_NAMES_ENABLE_REFERRAL_ATTRIBUTION: 'true',
      VITE_DUSK_NAMES_ENABLE_REFERRAL_CLAIMS: 'true',
    })

    expect(config.capabilities.referralAttribution).toBe(false)
    expect(config.capabilities.referralRewardClaims).toBe(false)
    expect(config.warnings).toEqual([
      'VITE_DUSK_DOMAINS_ENABLE_REFERRAL_ATTRIBUTION is set, but core and treasury contracts are not configured; referral attribution stays local.',
      'VITE_DUSK_DOMAINS_ENABLE_REFERRAL_CLAIMS is set, but no treasury contract is configured; reward claims stay disabled.',
    ])
  })

  it('rejects malformed contract IDs and URLs without throwing', () => {
    const config = createDuskNamesRuntimeConfig({
      VITE_DUSK_NAMES_CORE_CONTRACT_ID: 'core',
      VITE_DUSK_NAMES_TREASURY_CONTRACT_ID: `0x${'66'.repeat(32)}`,
      VITE_DUSK_NAMES_INDEXER_URL: 'ftp://api.example',
      VITE_DUSK_NAMES_NODE_URL: 'ftp://node.example',
      VITE_DUSK_NAMES_CHAIN_ID: '2',
      VITE_DUSK_NAMES_TREASURY_DRIVER_URL: '//cdn.example/treasury.wasm',
      VITE_DUSK_NAMES_SUPPORT_URL: 'javascript:alert(1)',
      VITE_DUSK_NAMES_ABUSE_URL: '//abuse.example',
      VITE_DUSK_NAMES_SECURITY_URL: 'security@example.test',
      VITE_DUSK_NAMES_STATUS_URL: 'ftp://status.example',
    })

    expect(config.mode).toBe('preview')
    expect(config.contracts.core.contractId).toBe(DUSK_NAME_PLACEHOLDER_CONTRACT_ID)
    expect(config.contracts.treasury.contractId).toBe(`0x${'66'.repeat(32)}`)
    expect(config.indexerUrl).toBeNull()
    expect(config.launchLinks).toEqual({
      support: null,
      abuse: null,
      security: null,
      status: null,
    })
    expect(config.missingLiveInputs).toContain('VITE_DUSK_DOMAINS_CORE_CONTRACT_ID')
    expect(config.missingLiveInputs).toContain('VITE_DUSK_DOMAINS_INDEXER_URL')
    expect(config.warnings).toEqual([
      'VITE_DUSK_DOMAINS_CORE_CONTRACT_ID is not a 32-byte hex contract ID; using preview placeholder.',
      'VITE_DUSK_DOMAINS_TREASURY_DRIVER_URL must be an http(s) or root-relative URL; using preview default.',
      'VITE_DUSK_DOMAINS_INDEXER_URL must be an http(s) or root-relative URL; indexer integration disabled.',
      'VITE_DUSK_DOMAINS_NODE_URL must be an http(s) or root-relative URL; using preview default.',
      'VITE_DUSK_DOMAINS_CHAIN_ID must be a Dusk CAIP-2 chain ID such as dusk:2; using dusk:2.',
      'VITE_DUSK_DOMAINS_SUPPORT_URL must be an http(s), mailto, or root-relative URL; launch link disabled.',
      'VITE_DUSK_DOMAINS_ABUSE_URL must be an http(s), mailto, or root-relative URL; launch link disabled.',
      'VITE_DUSK_DOMAINS_SECURITY_URL must be an http(s), mailto, or root-relative URL; launch link disabled.',
      'VITE_DUSK_DOMAINS_STATUS_URL must be an http(s), mailto, or root-relative URL; launch link disabled.',
    ])
  })

  it('validates supported runtime URL and contract ID shapes', () => {
    expect(isValidDuskContractId(`0x${'ab'.repeat(32)}`)).toBe(true)
    expect(isValidDuskContractId(`0x${'ab'.repeat(31)}`)).toBe(false)
    expect(isValidRuntimeUrl('/api/dusk-names')).toBe(true)
    expect(isValidRuntimeUrl('https://api.example')).toBe(true)
    expect(isValidRuntimeUrl('//api.example')).toBe(false)
    expect(isValidRuntimeUrl('ftp://api.example')).toBe(false)
    expect(isValidLaunchLinkUrl('mailto:support@example.test')).toBe(true)
    expect(isValidLaunchLinkUrl('/support')).toBe(true)
    expect(isValidLaunchLinkUrl('https://support.example')).toBe(true)
    expect(isValidLaunchLinkUrl('//support.example')).toBe(false)
    expect(isValidLaunchLinkUrl('javascript:alert(1)')).toBe(false)
  })
})
