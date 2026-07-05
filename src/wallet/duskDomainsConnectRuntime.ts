import { createDuskApp } from '@dusk/connect'
import type { DuskApp, DuskWallet, DuskWalletOptions } from '@dusk/connect'
import { createDuskDomainsConnectApp } from './duskConnectApp'
import { isPlaceholderContractId, type DuskDomainsRuntimeConfig } from '../runtime/config'
import type { DuskConnectAppLike } from '../contracts/calls'

export type DuskDomainsLiveAppOptions = {
  runtimeConfig: DuskDomainsRuntimeConfig
  wallet?: DuskWallet | DuskWalletOptions
  autoConnect?: boolean
}

export type DuskDomainsLiveApp = {
  dusk: DuskApp
  names: DuskConnectAppLike
}

export function canUseLiveDuskDomainsWrites(config: DuskDomainsRuntimeConfig): boolean {
  return (
    config.liveWritesEnabled
    && !isPlaceholderContractId(config.contracts.core.contractId)
    && !isPlaceholderContractId(config.contracts.treasury.contractId)
  )
}

export function createDuskDomainsLiveApp(options: DuskDomainsLiveAppOptions): DuskDomainsLiveApp {
  if (!canUseLiveDuskDomainsWrites(options.runtimeConfig)) {
    throw new Error('Dusk Domains live writes require configured contract IDs and VITE_DUSK_DOMAINS_ENABLE_LIVE_WRITES=true.')
  }

  const dusk = createDuskApp({
    wallet: options.wallet,
    nodeUrl: options.runtimeConfig.nodeUrl,
    chain: { chainId: options.runtimeConfig.chainId },
    autoConnect: options.autoConnect ?? true,
    contracts: options.runtimeConfig.contracts,
  })

  return {
    dusk,
    names: createDuskDomainsConnectApp(dusk),
  }
}
