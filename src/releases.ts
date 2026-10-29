/**
 * The Dusk Domains release mainnet and testnet run, pinned in this SDK version: each contract's ID,
 * role, code and init commitments and data driver, the read lens and the site that serves the
 * drivers. `contractRole` tells whether a contract ID is one of Dusk Domains' on a network, and which.
 * Pass a release to `createLensReader` (`./lens-reader`) as it is.
 *
 * ```ts
 * import { contractRole, releaseFor } from '@duskdomains/sdk/releases'
 *
 * contractRole('0x4e2de1ed4f1fd53de83f4809a75367301c7645a546030fa199aff804e6854199', 'testnet') // 'store'
 * releaseFor('dusk:1')?.site // 'https://dusk.domains'
 * ```
 *
 * @module
 */
export {
  PINNED_RELEASES,
  contractRole,
  releaseFor,
  type PinnedContract,
  type PinnedRelease,
  type ReleaseNetwork,
  type ReleaseRole,
} from './core/releases.ts'
export type { ContractRole } from './frozen/manifest.ts'
