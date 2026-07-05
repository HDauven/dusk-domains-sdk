import { createDuskApp } from '@dusk/connect'
import type { DuskApp, DuskWallet, DuskWalletOptions } from '@dusk/connect'
import { createDuskNamesConnectApp } from './duskConnectApp'
import { isPlaceholderContractId, type DuskNamesRuntimeConfig } from '../runtime/config'
import type { DuskConnectAppLike } from '../contracts/calls'

export type DuskNamesLiveAppOptions = {
  runtimeConfig: DuskNamesRuntimeConfig
  wallet?: DuskWallet | DuskWalletOptions
  autoConnect?: boolean
}

export type DuskNamesLiveApp = {
  dusk: DuskApp
  names: DuskConnectAppLike
}

export function canUseLiveDuskNamesWrites(config: DuskNamesRuntimeConfig): boolean {
  return (
    config.liveWritesEnabled
    && !isPlaceholderContractId(config.contracts.core.contractId)
    && !isPlaceholderContractId(config.contracts.treasury.contractId)
  )
}

export function createDuskNamesLiveApp(options: DuskNamesLiveAppOptions): DuskNamesLiveApp {
  if (!canUseLiveDuskNamesWrites(options.runtimeConfig)) {
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
    names: createDuskNamesConnectApp(dusk),
  }
}

export const createDuskDomainsLiveApp = createDuskNamesLiveApp
