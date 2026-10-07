/** Manifest-first runtime configuration; env is supplied explicitly for browser/Node parity. @module */
import {
  validateReleaseManifest,
  type ReleaseManifest,
  type ManifestOptions,
} from '../frozen/manifest.ts'
export type DuskDomainsRuntimeEnv = Record<string, string | boolean | undefined>
export interface DuskDomainsRuntimeConfig {
  manifest: ReleaseManifest
  nodeUrl: string
  indexerUrl: string
  chainId: string
  network: number
}
/** DUSK_DOMAINS_* overrides VITE_DUSK_DOMAINS_*. Numeric chain overrides must match the release network byte. */
export function createDuskDomainsRuntimeConfig(
  manifest: unknown,
  env: DuskDomainsRuntimeEnv = {},
): DuskDomainsRuntimeConfig {
  const read = (key: string): string | undefined => {
    for (const prefix of ['DUSK_DOMAINS_', 'VITE_DUSK_DOMAINS_']) {
      const value = env[`${prefix}${key}`]
      if (value === undefined || value === '') continue
      if (typeof value !== 'string' || !value.trim())
        throw new Error(`Invalid environment setting ${key}`)
      return value.trim()
    }
    return undefined
  }
  const options: ManifestOptions = {
    nodeUrl: read('NODE_URL'),
    indexerUrl: read('INDEXER_URL'),
  }
  let release = validateReleaseManifest(manifest, options)
  const chain = read('CHAIN_ID')
  if (chain !== undefined && chain !== release.chainId) {
    const numeric = /^dusk:(\d+)$/u.exec(chain)?.[1]
    if (numeric === undefined || BigInt(numeric) !== BigInt(release.network))
      throw new Error('Environment chain differs from release')
    release = validateReleaseManifest({ ...release, chainId: chain })
  }
  return {
    manifest: release,
    nodeUrl: release.nodeUrl,
    indexerUrl: release.indexerUrl,
    chainId: release.chainId,
    network: release.network,
  }
}
