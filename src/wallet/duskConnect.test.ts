import { afterEach, describe, expect, it } from 'vitest'
import {
  createDuskWallet,
  DUSK_ANNOUNCE_PROVIDER_EVENT,
  DUSK_SELECTED_PROVIDER_STORAGE_KEY,
  type DuskProfile,
} from './duskConnect'

type ProviderRequest = {
  method: string
  params?: unknown
}

type TestProvider = {
  isDusk: true
  isAuthorized?: boolean
  chainId?: string
  profiles?: DuskProfile[]
  requests: ProviderRequest[]
  request: <T>(request: ProviderRequest) => Promise<T>
  on: (event: string, handler: (payload: unknown) => void) => void
  once: (event: string, handler: (payload: unknown) => void) => void
  off: (event: string, handler: (payload: unknown) => void) => void
  removeListener: (event: string, handler: (payload: unknown) => void) => void
  removeAllListeners: (event?: string) => void
  isConnected: () => boolean
  emit: (event: string, payload?: unknown) => void
}

type TestWindow = EventTarget & {
  localStorage: Storage
  setTimeout: typeof globalThis.setTimeout
  clearTimeout: typeof globalThis.clearTimeout
}

type GlobalWindow = Window & typeof globalThis

const globalWithWindow = globalThis as typeof globalThis & { window?: GlobalWindow; localStorage?: Storage }
const originalWindow = globalWithWindow.window
const originalLocalStorage = globalWithWindow.localStorage

afterEach(() => {
  globalWithWindow.window = originalWindow
  globalWithWindow.localStorage = originalLocalStorage
})

describe('Dusk Connect wallet integration', () => {
  it('prefers a remembered provider when multiple wallets announce', async () => {
    const testWindow = installTestWindow()
    testWindow.localStorage.setItem(DUSK_SELECTED_PROVIDER_STORAGE_KEY, 'provider-b')
    const wallet = createDuskWallet()

    announceProvider('provider-a', 'Wallet A', createTestProvider())
    expect(wallet.state.providerId).toBeNull()

    announceProvider('provider-b', 'Wallet B', createTestProvider())
    await wallet.ready()
    expect(wallet.state.providerId).toBe('provider-b')
    expect(wallet.state.availableProviders.map((provider) => provider.uuid)).toEqual(['provider-a', 'provider-b'])

    wallet.destroy()
  })

  it('passes scoped profile request options and tracks provider events', async () => {
    installTestWindow()
    const provider = createTestProvider({
      profiles: [{ profileId: 'primary', account: 'dusk1account' }],
      chainId: 'dusk:2',
    })
    const wallet = createDuskWallet()

    announceProvider('provider-a', 'Wallet A', provider)
    const profiles = await wallet.connect({
      shieldedReceiveAddress: false,
      reason: 'Manage public .dusk domains and public domain records.',
      label: 'Dusk Domains',
    })

    expect(profiles).toEqual([{ profileId: 'primary', account: 'dusk1account' }])
    expect(provider.requests[0]).toEqual({
      method: 'dusk_requestProfiles',
      params: {
        shieldedReceiveAddress: false,
        reason: 'Manage public .dusk domains and public domain records.',
        label: 'Dusk Domains',
      },
    })
    expect(wallet.state).toMatchObject({
      authorized: true,
      chainId: 'dusk:2',
      selectedAddress: 'dusk1account',
    })

    provider.emit('chainChanged', 'dusk:1')
    provider.emit('profilesChanged', [{ profileId: 'secondary', account: 'dusk1next' }])
    expect(wallet.state).toMatchObject({
      authorized: true,
      chainId: 'dusk:1',
      selectedAddress: 'dusk1next',
    })

    provider.emit('disconnect')
    expect(wallet.state).toMatchObject({
      authorized: false,
      selectedAddress: null,
      profiles: [],
    })

    wallet.destroy()
  })
})

function installTestWindow() {
  const target = new EventTarget() as TestWindow
  target.localStorage = createMemoryStorage()
  target.setTimeout = globalThis.setTimeout
  target.clearTimeout = globalThis.clearTimeout
  globalWithWindow.window = target as unknown as GlobalWindow
  globalWithWindow.localStorage = target.localStorage
  return target
}

function announceProvider(uuid: string, name: string, provider: TestProvider) {
  window.dispatchEvent(new CustomEvent(DUSK_ANNOUNCE_PROVIDER_EVENT, {
    detail: {
      info: {
        uuid,
        name,
        icon: '',
        rdns: `network.dusk.${uuid}`,
      },
      provider,
    },
  }))
}

function createTestProvider(options: {
  profiles?: DuskProfile[]
  chainId?: string
} = {}): TestProvider {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const provider: TestProvider = {
    isDusk: true,
    isAuthorized: false,
    chainId: options.chainId,
    profiles: options.profiles ?? [],
    requests: [],
    async request<T>(request: ProviderRequest) {
      provider.requests.push(request)
      if (request.method === 'dusk_requestProfiles') {
        provider.isAuthorized = true
        return provider.profiles as T
      }
      if (request.method === 'dusk_disconnect') {
        provider.isAuthorized = false
        return true as T
      }
      if (request.method === 'dusk_chainId') return provider.chainId as T
      if (request.method === 'dusk_profiles') return provider.profiles as T
      if (request.method === 'dusk_getCapabilities') {
        return {
          provider: 'test',
          walletVersion: '0.0.0-test',
          chainId: provider.chainId ?? 'dusk:2',
          nodeUrl: 'https://testnet.nodes.dusk.network',
          networkName: 'testnet',
          methods: ['dusk_requestProfiles', 'dusk_profiles', 'dusk_chainId'],
          txKinds: ['contract_call'],
          limits: {
            maxFnArgsBytes: 65_536,
            maxFnNameChars: 128,
            maxMemoBytes: 512,
          },
          features: {
            shieldedRead: false,
            shieldedRecipients: false,
            signMessage: false,
            signAuth: false,
            contractCallPrivacy: true,
          },
        } as T
      }
      return null as T
    },
    on(event, handler) {
      const eventListeners = listeners.get(event) ?? new Set()
      eventListeners.add(handler)
      listeners.set(event, eventListeners)
    },
    once(event, handler) {
      const onceHandler = (payload: unknown) => {
        provider.off(event, onceHandler)
        handler(payload)
      }
      provider.on(event, onceHandler)
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler)
    },
    removeListener(event, handler) {
      provider.off(event, handler)
    },
    removeAllListeners(event) {
      if (event) {
        listeners.delete(event)
        return
      }
      listeners.clear()
    },
    isConnected() {
      return true
    },
    emit(event, payload) {
      for (const handler of listeners.get(event) ?? []) handler(payload)
    },
  }
  return provider
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}
