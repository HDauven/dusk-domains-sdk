import type { ActivityEntry } from './activity'
import type { ResolverRecord } from './records'
import type {
  FeeConfigEvent,
  IndexedEndpoint,
  IndexerEventMeta,
  NameLifecycleEvent,
  ReferralEvent,
  RegistrationControllerEvent,
  ResolverRecordEvent,
  ReverseRegistryEvent,
  SubnameRegistryEvent,
  TreasuryEvent,
} from './indexerEventTypes'
import type {
  IndexedFeeConfig,
  IndexedLifecycleName,
  IndexedReferralState,
  IndexedRegistrationCommitment,
  IndexedReversePrimaryName,
  IndexedSubname,
  IndexedTreasuryState,
} from './indexerStateTypes'

export type LifecycleEventProjector = {
  apply: (event: NameLifecycleEvent, meta?: IndexerEventMeta) => ActivityEntry
  applyController: (event: RegistrationControllerEvent, meta?: IndexerEventMeta) => IndexedRegistrationCommitment
  applyResolver: (event: ResolverRecordEvent, meta?: IndexerEventMeta) => ActivityEntry
  applyReverse: (event: ReverseRegistryEvent, meta?: IndexerEventMeta) => IndexedReversePrimaryName | null
  applySubname: (event: SubnameRegistryEvent, meta?: IndexerEventMeta) => IndexedSubname
  applyTreasury: (event: TreasuryEvent, meta?: IndexerEventMeta) => IndexedTreasuryState
  applyReferral: (event: ReferralEvent, meta?: IndexerEventMeta) => IndexedReferralState
  applyFeeConfig: (event: FeeConfigEvent, meta?: IndexerEventMeta) => IndexedFeeConfig
  getNameByNode: (node: string) => IndexedLifecycleName | null
  getCommitment: (commitment: string) => IndexedRegistrationCommitment | null
  getResolverRecords: (node: string) => ResolverRecord[]
  getPrimaryNameByEndpoint: (endpoint: IndexedEndpoint) => IndexedReversePrimaryName | null
  getSubnameByNode: (node: string) => IndexedSubname | null
  getSubnamesByParent: (parentNode: string) => IndexedSubname[]
  getTreasuryState: () => IndexedTreasuryState
  getReferralState: (referrer: string) => IndexedReferralState
  getFeeConfig: () => IndexedFeeConfig
  getActivity: (node: string) => ActivityEntry[]
}
