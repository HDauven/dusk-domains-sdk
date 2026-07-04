import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DUSK_ANNOUNCE_PROVIDER_EVENT,
  DUSK_REQUEST_PROVIDER_EVENT,
} from '../wallet/duskConnect'
import {
  installLocalDevDuskWallet,
  LOCAL_DEV_WALLET_PREPARED_CALL_EVENT,
} from './localDevWallet'

type TestWindow = EventTarget & {
  queueMicrotask: typeof globalThis.queueMicrotask
}

afterEach(() => {
  vi.useRealTimers()
})

describe('local dev Dusk wallet provider', () => {
  it('announces a discoverable provider when requested', async () => {
    const target = createTestWindow()
    const announced: unknown[] = []
    installLocalDevDuskWallet({ account: 'dusk1localdevwalletaccount000001' }, target)
    target.addEventListener(DUSK_ANNOUNCE_PROVIDER_EVENT, (event) => {
      announced.push((event as CustomEvent).detail)
    })

    target.dispatchEvent(new Event(DUSK_REQUEST_PROVIDER_EVENT))

    expect(announced).toHaveLength(1)
    expect(announced[0]).toMatchObject({
      info: {
        uuid: 'dusk-names-local-dev-wallet',
        name: 'Local Dusk Wallet',
      },
      provider: {
        isDusk: true,
      },
    })
  })

  it('connects, emits profile changes, and disconnects', async () => {
    const target = createTestWindow()
    const installed = installLocalDevDuskWallet({
      account: 'dusk1localdevwalletaccount000001',
      chainId: 'dusk:0',
    }, target)
    expect(installed).not.toBeNull()
    const provider = installed!.provider
    const events: string[] = []
    provider.on('connect', () => events.push('connect'))
    provider.on('profilesChanged', () => events.push('profilesChanged'))
    provider.on('disconnect', () => events.push('disconnect'))

    await expect(provider.request({ method: 'dusk_requestProfiles' })).resolves.toEqual([{
      profileId: 'local-dev',
      account: 'dusk1localdevwalletaccount000001',
    }])
    expect(provider.isAuthorized).toBe(true)
    expect(provider.profiles).toHaveLength(1)

    await expect(provider.request({ method: 'dusk_disconnect' })).resolves.toBe(true)
    expect(provider.isAuthorized).toBe(false)
    expect(provider.profiles).toEqual([])
    expect(events).toEqual(['connect', 'profilesChanged', 'disconnect'])
  })

  it('can reject profile requests for browser wallet-state smoke tests', async () => {
    const installed = installLocalDevDuskWallet({
      account: 'dusk1localdevwalletaccount000001',
      rejectProfileRequest: true,
    }, createTestWindow())
    const provider = installed!.provider

    await expect(provider.request({ method: 'dusk_requestProfiles' }))
      .rejects.toThrow('rejected the profile request')
    expect(provider.isAuthorized).toBe(false)
    expect(provider.profiles).toEqual([])
  })

  it('can start authorized but locked for wallet-state smoke tests', async () => {
    const installed = installLocalDevDuskWallet({
      account: 'dusk1localdevwalletaccount000001',
      startLocked: true,
    }, createTestWindow())
    const provider = installed!.provider

    expect(provider.isAuthorized).toBe(true)
    await expect(provider.request({ method: 'dusk_profiles' })).resolves.toEqual([])

    await expect(provider.request({ method: 'dusk_requestProfiles' })).resolves.toEqual([{
      profileId: 'local-dev',
      account: 'dusk1localdevwalletaccount000001',
    }])
    expect(provider.isAuthorized).toBe(true)
    expect(provider.profiles).toHaveLength(1)
  })

  it('can auto-lock after profile approval for browser timeout smoke tests', async () => {
    vi.useFakeTimers()
    const installed = installLocalDevDuskWallet({
      account: 'dusk1localdevwalletaccount000001',
      autoLockDelayMs: 500,
    }, createTestWindow())
    const provider = installed!.provider
    const profileEvents: unknown[] = []
    provider.on('profilesChanged', (profiles) => profileEvents.push(profiles))

    await expect(provider.request({ method: 'dusk_requestProfiles' })).resolves.toHaveLength(1)
    expect(provider.isAuthorized).toBe(true)
    expect(provider.profiles).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(500)

    expect(provider.isAuthorized).toBe(true)
    expect(provider.profiles).toEqual([])
    expect(profileEvents).toEqual([
      [{ profileId: 'local-dev', account: 'dusk1localdevwalletaccount000001' }],
      [],
    ])
  })

  it('cancels pending auto-lock timers on disconnect', async () => {
    vi.useFakeTimers()
    const installed = installLocalDevDuskWallet({
      account: 'dusk1localdevwalletaccount000001',
      autoLockDelayMs: 500,
    }, createTestWindow())
    const provider = installed!.provider

    await provider.request({ method: 'dusk_requestProfiles' })
    await provider.request({ method: 'dusk_disconnect' })
    await vi.advanceTimersByTimeAsync(500)

    expect(provider.isAuthorized).toBe(false)
    expect(provider.profiles).toEqual([])
  })

  it('reports a configurable public balance for live-write preflight checks', async () => {
    const installed = installLocalDevDuskWallet({
      publicBalanceLux: '1200000000',
    }, createTestWindow())
    const provider = installed!.provider

    await expect(provider.request({ method: 'dusk_getPublicBalance' })).resolves.toEqual({
      nonce: '0',
      value: '1200000000',
    })
  })

  it('returns a shareable shielded receive address after explicit request', async () => {
    const installed = installLocalDevDuskWallet({
      account: 'dusk1localdevwalletaccount000001',
      shieldedAddress: 'dusk1shieldedtestreceiveaddress0001',
    }, createTestWindow())
    const provider = installed!.provider

    await expect(provider.request({
      method: 'dusk_requestProfiles',
      params: { shieldedReceiveAddress: true },
    })).resolves.toEqual([{
      profileId: 'local-dev',
      account: 'dusk1localdevwalletaccount000001',
      shieldedAddress: 'dusk1shieldedtestreceiveaddress0001',
    }])
    await expect(provider.request({ method: 'dusk_requestShieldedAddress' })).resolves.toEqual({
      address: 'dusk1shieldedtestreceiveaddress0001',
      account: 'dusk1localdevwalletaccount000001',
      profileId: 'local-dev',
      chainId: 'dusk:0',
    })
    await expect(provider.request({ method: 'dusk_getCapabilities' })).resolves.toMatchObject({
      methods: expect.arrayContaining(['dusk_requestShieldedAddress']),
      features: {
        shieldedReceiveAddress: true,
      },
    })
  })

  it('prepares local approval context without submitting transactions', async () => {
    const target = createTestWindow()
    const preparedEvents: unknown[] = []
    target.addEventListener(LOCAL_DEV_WALLET_PREPARED_CALL_EVENT, (event) => {
      preparedEvents.push((event as CustomEvent).detail)
    })
    const installed = installLocalDevDuskWallet({}, target)
    const provider = installed!.provider
    const chains: string[] = []
    provider.on('chainChanged', (chainId) => chains.push(String(chainId)))

    await provider.request({
      method: 'dusk_switchNetwork',
      params: [{ chainId: 'dusk:2', nodeUrl: 'https://testnet.nodes.dusk.network' }],
    })

    await expect(provider.request({ method: 'dusk_chainId' })).resolves.toBe('dusk:2')
    await expect(provider.request({ method: 'dusk_getCapabilities' })).resolves.toMatchObject({
      chainId: 'dusk:2',
      methods: expect.arrayContaining(['dusk_prepareContractCall', 'dusk_sendTransaction']),
      txKinds: [],
    })
    await expect(provider.request({
      method: 'dusk_prepareContractCall',
      params: {
        privacy: 'public',
        contract: {
          contractId: `0x${'44'.repeat(32)}`,
        },
        functionName: 'set_record',
        args: { node: `0x${'18'.repeat(32)}` },
        deposit: '35000000000',
        display: {
          title: 'Update Dusk address',
          fields: [{ label: 'Name ID', value: `0x${'18'.repeat(32)}` }],
        },
      },
    })).resolves.toMatchObject({
      kind: 'contract_call',
      contractId: `0x${'44'.repeat(32)}`,
      functionName: 'set_record',
      args: { node: `0x${'18'.repeat(32)}` },
      privacy: 'public',
      deposit: '35000000000',
      display: {
        title: 'Update Dusk address',
      },
      localOnly: true,
    })
    expect(preparedEvents).toMatchObject([{
      kind: 'contract_call',
      contractId: `0x${'44'.repeat(32)}`,
      functionName: 'set_record',
      localOnly: true,
    }])
    await expect(provider.request({
      method: 'dusk_sendTransaction',
      params: { kind: 'contract_call' },
    })).rejects.toThrow('local wallet is read-only')
    expect(chains).toEqual(['dusk:2'])
  })

  it('can submit prepared calls through an explicit local write bridge', async () => {
    const submitted: unknown[] = []
    const installed = installLocalDevDuskWallet({
      writeBridgeUrl: 'http://127.0.0.1:8799/write',
      fetch: async (url, init) => {
        submitted.push({ url, init })
        return new Response(JSON.stringify({
          result: {
            id: 'tx-local-bridge-1',
            status: 'executed',
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    }, createTestWindow())
    const provider = installed!.provider

    await expect(provider.request({ method: 'dusk_getCapabilities' })).resolves.toMatchObject({
      txKinds: ['contract_call'],
    })
    await expect(provider.request({
      method: 'dusk_sendTransaction',
      params: {
        kind: 'contract_call',
        contractId: `0x${'44'.repeat(32)}`,
        functionName: 'set_record_sender_runtime',
      },
    })).resolves.toEqual({
      id: 'tx-local-bridge-1',
      status: 'executed',
    })

    expect(submitted).toHaveLength(1)
    expect(submitted[0]).toMatchObject({
      url: 'http://127.0.0.1:8799/write',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          method: 'dusk_sendTransaction',
          params: {
            kind: 'contract_call',
            contractId: `0x${'44'.repeat(32)}`,
            functionName: 'set_record_sender_runtime',
          },
        }),
      },
    })
  })

  it('surfaces local write bridge errors without reporting success', async () => {
    const installed = installLocalDevDuskWallet({
      writeBridgeUrl: 'http://127.0.0.1:8799/write',
      fetch: async () => new Response(JSON.stringify({
        error: {
          message: 'bridge executor rejected the transaction',
        },
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    }, createTestWindow())
    const provider = installed!.provider

    await expect(provider.request({
      method: 'dusk_sendTransaction',
      params: { kind: 'contract_call' },
    })).rejects.toThrow('bridge executor rejected the transaction')
  })
})

function createTestWindow() {
  const target = new EventTarget() as TestWindow
  target.queueMicrotask = globalThis.queueMicrotask.bind(globalThis)
  return target as unknown as Window & typeof globalThis
}
