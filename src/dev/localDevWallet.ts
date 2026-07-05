import {
  DUSK_ANNOUNCE_PROVIDER_EVENT,
  DUSK_REQUEST_PROVIDER_EVENT,
} from '../wallet/duskConnect'

type ChainId = string

type DuskProfile = {
  profileId: string
  account: string
  shieldedAddress?: string
}

type DuskProviderInfo = {
  uuid: string
  name: string
  icon: string
  rdns: string
}

type DuskProviderCapabilities = {
  provider: string
  walletVersion: string
  chainId: ChainId
  nodeUrl: string
  networkName: string
  methods: string[]
  txKinds: string[]
  limits: {
    maxFnArgsBytes: number
    maxFnNameChars: number
    maxMemoBytes: number
  }
  features: {
    shieldedRead: boolean
    shieldedRecipients: boolean
    shieldedReceiveAddress: boolean
    signMessage: boolean
    signAuth: boolean
    contractCallPrivacy: boolean
  }
}

type SwitchChainParams = {
  chainId?: string
  nodeUrl?: string
}

type DuskProviderEventHandler = (...args: unknown[]) => void

type DuskProvider = {
  isDusk: true
  readonly chainId: ChainId
  readonly profiles: DuskProfile[]
  readonly isAuthorized: boolean
  request: <T>(request: { method: string; params?: unknown }) => Promise<T>
  on: (eventName: string, handler: DuskProviderEventHandler) => void
  once: (eventName: string, handler: DuskProviderEventHandler) => void
  removeListener: (eventName: string, handler: DuskProviderEventHandler) => void
  off: (eventName: string, handler: DuskProviderEventHandler) => void
  removeAllListeners: (eventName?: string) => void
  isConnected: () => boolean
}

export type LocalDevWalletOptions = {
  account?: string
  shieldedAddress?: string
  chainId?: string
  nodeUrl?: string
  providerName?: string
  writeBridgeUrl?: string
  publicBalanceLux?: string
  fetch?: typeof globalThis.fetch
  rejectProfileRequest?: boolean
  autoLockDelayMs?: number
  profileRequestDelayMs?: number
  startLocked?: boolean
}

export type LocalDevWalletInstall = {
  provider: DuskProvider
  info: DuskProviderInfo
  cleanup: () => void
}

type BrowserTarget = Window & typeof globalThis

const defaultAccount = 'dusk1qz9p7m3ct4un8k6ry4l0vx2wjs5h9t7pa2f3c'
const defaultShieldedAddress = 'dusk1shieldedlocaldevreceiveaddress0001'
const defaultChainId = 'dusk:0'
const defaultNodeUrl = 'http://127.0.0.1:18180/'
const unsupportedWriteMessage = 'This local wallet is read-only. Use a transaction-capable Dusk wallet or the trusted local write bridge to update deployed state.'
const localPreparedCallPrefix = 'local-dev-prepared'

export const LOCAL_DEV_WALLET_PREPARED_CALL_EVENT = 'dusk-domains:local-dev-wallet:prepared-call'

export function installLocalDevDuskWallet(
  options: LocalDevWalletOptions = {},
  target: BrowserTarget | undefined = typeof window === 'undefined' ? undefined : window,
): LocalDevWalletInstall | null {
  if (!target) return null

  const account = options.account?.trim() || defaultAccount
  const shieldedAddress = options.shieldedAddress?.trim() || defaultShieldedAddress
  const providerName = options.providerName?.trim() || 'Local Dusk Wallet'
  const writeBridgeUrl = options.writeBridgeUrl?.trim()
  const configuredPublicBalanceLux = options.publicBalanceLux?.trim() ?? ''
  const publicBalanceLux = /^\d+$/u.test(configuredPublicBalanceLux) ? configuredPublicBalanceLux : '0'
  let chainId = options.chainId?.trim() || defaultChainId
  let nodeUrl = options.nodeUrl?.trim() || defaultNodeUrl
  let authorized = Boolean(options.startLocked)
  let profiles: DuskProfile[] = []
  let autoLockTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const info: DuskProviderInfo = {
    uuid: 'dusk-domains-local-dev-wallet',
    name: providerName,
    icon: '',
    rdns: 'network.dusk.local-dev-wallet',
  }

  const provider: DuskProvider = {
    isDusk: true,
    get chainId() {
      return chainId
    },
    get profiles() {
      return profiles
    },
    get isAuthorized() {
      return authorized
    },
    async request<T>({ method, params }: { method: string; params?: unknown }) {
      if (method === 'dusk_requestProfiles') {
        await waitForProfileDelay(options.profileRequestDelayMs)

        if (options.rejectProfileRequest) {
          throw new Error('Local dev wallet rejected the profile request.')
        }

        authorized = true
        profiles = [{
          profileId: 'local-dev',
          account,
          ...(connectWantsShieldedAddress(params) ? { shieldedAddress } : {}),
        }]
        emit('connect', { chainId })
        emit('profilesChanged', profiles)
        scheduleAutoLock()
        return profiles as T
      }

      if (method === 'dusk_requestShieldedAddress') {
        authorized = true
        profiles = [{
          profileId: 'local-dev',
          account,
          shieldedAddress,
        }]
        emit('profilesChanged', profiles)
        scheduleAutoLock()
        return {
          address: shieldedAddress,
          account,
          profileId: 'local-dev',
          chainId,
        } as T
      }

      if (method === 'dusk_profiles') return profiles as T
      if (method === 'dusk_chainId') return chainId as T
      if (method === 'dusk_disconnect') {
        clearAutoLock()
        authorized = false
        profiles = []
        emit('disconnect', { code: 4900, message: 'Disconnected from local dev wallet.' })
        return true as T
      }

      if (method === 'dusk_switchNetwork') {
        const next = firstSwitchParam(params)
        chainId = next?.chainId?.trim() || chainId
        nodeUrl = next?.nodeUrl?.trim() || nodeUrl
        emit('chainChanged', chainId)
        emit('duskNodeChanged', {
          chainId,
          nodeUrl,
          networkName: chainId === 'dusk:0' ? 'local-rusk-private' : 'custom',
        })
        return null as T
      }

      if (method === 'dusk_getCapabilities') {
        return capabilities({ chainId, nodeUrl, providerName, writeBridgeUrl }) as T
      }

      if (method === 'dusk_getPublicBalance') {
        return { nonce: '0', value: publicBalanceLux } as T
      }

      if (method === 'dusk_prepareContractCall') {
        return prepareContractCall(params, target) as T
      }

      if (method === 'dusk_sendTransaction') {
        if (writeBridgeUrl) {
          return await submitToWriteBridge({
            url: writeBridgeUrl,
            params,
            fetchImpl: options.fetch,
          }) as T
        }

        throw new Error(unsupportedWriteMessage)
      }

      throw new Error(`Local dev wallet does not support ${method}.`)
    },
    on(eventName, handler) {
      const handlers = listeners.get(eventName) ?? new Set()
      handlers.add(handler)
      listeners.set(eventName, handlers)
    },
    once(eventName, handler) {
      const onceHandler = (...args: unknown[]) => {
        provider.off(eventName, onceHandler)
        handler(...args)
      }
      provider.on(eventName, onceHandler)
    },
    removeListener(eventName, handler) {
      provider.off(eventName, handler)
    },
    off(eventName, handler) {
      listeners.get(eventName)?.delete(handler)
    },
    removeAllListeners(eventName) {
      if (eventName) {
        listeners.delete(eventName)
        return
      }
      listeners.clear()
    },
    isConnected() {
      return true
    },
  }

  function emit(eventName: string, ...args: unknown[]) {
    for (const handler of listeners.get(eventName) ?? []) {
      handler(...args)
    }
  }

  function scheduleAutoLock() {
    clearAutoLock()
    const delayMs = Number(options.autoLockDelayMs)
    if (!Number.isFinite(delayMs) || delayMs <= 0) return

    autoLockTimer = globalThis.setTimeout(() => {
      autoLockTimer = null
      if (!authorized || profiles.length === 0) return
      profiles = []
      emit('profilesChanged', profiles)
    }, delayMs)
  }

  function clearAutoLock() {
    if (!autoLockTimer) return
    globalThis.clearTimeout(autoLockTimer)
    autoLockTimer = null
  }

  const announce = () => {
    target.dispatchEvent(new CustomEvent(DUSK_ANNOUNCE_PROVIDER_EVENT, {
      detail: { info, provider },
    }))
  }
  const onRequestProvider = () => announce()

  target.addEventListener(DUSK_REQUEST_PROVIDER_EVENT, onRequestProvider)
  target.queueMicrotask(announce)

  return {
    provider,
    info,
    cleanup() {
      clearAutoLock()
      target.removeEventListener(DUSK_REQUEST_PROVIDER_EVENT, onRequestProvider)
      provider.removeAllListeners()
    },
  }
}

async function waitForProfileDelay(delayMs: number | undefined) {
  if (!Number.isFinite(delayMs) || Number(delayMs) <= 0) return
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, Number(delayMs))
  })
}

function capabilities(args: {
  chainId: ChainId
  nodeUrl: string
  providerName: string
  writeBridgeUrl?: string
}): DuskProviderCapabilities {
  return {
    provider: args.providerName,
    walletVersion: 'local-dev',
    chainId: args.chainId,
    nodeUrl: args.nodeUrl,
    networkName: args.chainId === 'dusk:0' ? 'local-rusk-private' : 'custom',
    methods: [
      'dusk_requestProfiles',
      'dusk_requestShieldedAddress',
      'dusk_profiles',
      'dusk_chainId',
      'dusk_disconnect',
      'dusk_switchNetwork',
      'dusk_getCapabilities',
      'dusk_getPublicBalance',
      'dusk_prepareContractCall',
      'dusk_sendTransaction',
    ],
    txKinds: args.writeBridgeUrl ? ['contract_call'] : [],
    limits: {
      maxFnArgsBytes: 65_536,
      maxFnNameChars: 128,
      maxMemoBytes: 512,
    },
    features: {
      shieldedRead: false,
      shieldedRecipients: false,
      shieldedReceiveAddress: true,
      signMessage: false,
      signAuth: false,
      contractCallPrivacy: false,
    },
  }
}

function connectWantsShieldedAddress(params: unknown) {
  return Boolean(params && typeof params === 'object' && 'shieldedReceiveAddress' in params
    && (params as { shieldedReceiveAddress?: unknown }).shieldedReceiveAddress)
}

async function submitToWriteBridge(args: {
  url: string
  params: unknown
  fetchImpl?: typeof globalThis.fetch
}) {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error('Local wallet write bridge is configured, but fetch is unavailable.')
  }

  const response = await fetchImpl(args.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      method: 'dusk_sendTransaction',
      params: args.params,
    }),
  })

  const text = await response.text()
  const payload = text ? parseBridgeJson(text) : null
  if (!response.ok) {
    throw new Error(bridgeErrorMessage(payload, response.status))
  }

  if (isObjectRecord(payload) && 'result' in payload) return payload.result
  return payload
}

function parseBridgeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return {
      error: `Local wallet write bridge returned non-JSON response: ${text.slice(0, 160)}`,
    }
  }
}

function bridgeErrorMessage(payload: unknown, status: number) {
  if (isObjectRecord(payload)) {
    const error = payload.error
    if (typeof error === 'string' && error.trim()) return error
    if (isObjectRecord(error) && typeof error.message === 'string' && error.message.trim()) return error.message
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
  }
  return `Local wallet write bridge failed with HTTP ${status}.`
}

function prepareContractCall(params: unknown, target?: EventTarget) {
  const request = isObjectRecord(params) ? params : {}
  const contract = isObjectRecord(request.contract) ? request.contract : {}
  const functionName = typeof request.functionName === 'string' ? request.functionName : 'unknown'
  const contractId = typeof contract.contractId === 'string' ? contract.contractId : undefined
  const display = isObjectRecord(request.display) ? request.display : undefined

  const prepared = {
    id: `${localPreparedCallPrefix}:${contractId ?? 'unknown'}:${functionName}:${Date.now()}`,
    kind: 'contract_call',
    contractId,
    functionName,
    args: request.args,
    privacy: request.privacy ?? 'public',
    deposit: typeof request.deposit === 'string' ? request.deposit : undefined,
    display,
    localOnly: true,
  }
  target?.dispatchEvent(new CustomEvent(LOCAL_DEV_WALLET_PREPARED_CALL_EVENT, {
    detail: prepared,
  }))
  rememberPreparedCall(target, prepared)
  return prepared
}

function rememberPreparedCall(target: EventTarget | undefined, prepared: unknown) {
  if (!target || !('window' in target)) return
  const browserTarget = target as BrowserTarget & {
    __duskDomainsPreparedCalls?: unknown[]
  }
  browserTarget.__duskDomainsPreparedCalls ??= []
  browserTarget.__duskDomainsPreparedCalls.push(prepared)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function firstSwitchParam(value: unknown): SwitchChainParams | null {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate || typeof candidate !== 'object') return null
  return candidate as SwitchChainParams
}
