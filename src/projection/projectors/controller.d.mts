import type { IndexedRegistrationCommitment, IndexerEventMeta, RegistrationControllerEvent } from '../../indexer/indexerTypes'
import type { ProjectionState } from '../state.mjs'

export function applyControllerEvent(store: ProjectionState, event: RegistrationControllerEvent, meta: IndexerEventMeta): IndexedRegistrationCommitment
export function commitmentKey(controller: string, commitment: string): string
