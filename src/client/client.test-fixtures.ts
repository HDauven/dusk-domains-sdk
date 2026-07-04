import type { ForwardResolutionResponse, IndexedNameSummary } from '../indexer/indexer'
import type { DuskNamesIndexerClient } from '../indexer/indexerClient'
import { namehashHex } from '../core/namehash'
import type { DuskNamesOnChainClient } from '../onchain/sdkOnChain'

export const node = namehashHex('aurora.dusk')
export const endpointValue = 'dusk1localresolverproof01'

export function fakeIndexer(overrides: Partial<DuskNamesIndexerClient>): DuskNamesIndexerClient {
  return {
    async getHealth() {
      throw new Error('not implemented')
    },
    async searchName() {
      throw new Error('not implemented')
    },
    async getCommitment() {
      throw new Error('not implemented')
    },
    async resolveForward() {
      throw new Error('not implemented')
    },
    async getRecords() {
      throw new Error('not implemented')
    },
    async getNodeRecords() {
      throw new Error('not implemented')
    },
    async getNodeRecord() {
      throw new Error('not implemented')
    },
    async getRecordHistory() {
      throw new Error('not implemented')
    },
    async getPrimaryName() {
      throw new Error('not implemented')
    },
    async getNameState() {
      throw new Error('not implemented')
    },
    async getNames() {
      throw new Error('not implemented')
    },
    async getActivity() {
      throw new Error('not implemented')
    },
    async getSubnames() {
      throw new Error('not implemented')
    },
    async getSubname() {
      throw new Error('not implemented')
    },
    async getTreasury() {
      throw new Error('not implemented')
    },
    async getReferralState() {
      throw new Error('not implemented')
    },
    async getFeeConfig() {
      throw new Error('not implemented')
    },
    ...overrides,
  }
}

export function fakeOnChain(overrides: Partial<DuskNamesOnChainClient>): DuskNamesOnChainClient {
  return {
    async getName() {
      throw new Error('not implemented')
    },
    async getNameByNode() {
      throw new Error('not implemented')
    },
    async getNameOwner() {
      throw new Error('not implemented')
    },
    async getRecords() {
      throw new Error('not implemented')
    },
    async getRecord() {
      throw new Error('not implemented')
    },
    async resolveName() {
      throw new Error('not implemented')
    },
    async getPrimaryName() {
      throw new Error('not implemented')
    },
    async verifyPrimaryName() {
      throw new Error('not implemented')
    },
    async getPendingCommitment() {
      throw new Error('not implemented')
    },
    async getFeeConfig() {
      throw new Error('not implemented')
    },
    ...overrides,
  }
}

export function indexedNameSummary(overrides: Partial<IndexedNameSummary> = {}): IndexedNameSummary {
  return {
    node,
    canonicalName: 'aurora.dusk',
    owner: '0xowner',
    manager: '0xowner',
    resolverId: null,
    expiresAt: null,
    graceEndsAt: null,
    status: 'active',
    lastEventType: 'name_registered',
    records: [],
    subnameCount: 0,
    activityCount: 0,
    ...overrides,
  }
}

export function releaseManifest() {
  const coreId = `0x${'11'.repeat(32)}`
  const treasuryId = `0x${'22'.repeat(32)}`
  const hash = 'a'.repeat(64)
  return {
    product: 'Dusk Domains',
    manifestVersion: 1,
    release: '0.1.0',
    sdkVersion: '0.1.0',
    sourceCommit: 'abc123',
    generatedAt: '2026-06-27T00:00:00.000Z',
    network: 'devnet',
    chainId: 'dusk:3',
    eventSchemaVersion: '1',
    trustModel: {
      canonicalReads: 'core contract read entrypoints',
      indexedReads: 'derived convenience read model; not canonical',
    },
    packages: {
      sdk: '@dusk-domains/sdk',
      artifacts: '@dusk-domains/artifacts',
      indexerClient: '@dusk-domains/indexer-client',
      indexer: '@dusk-domains/indexer',
    },
    contracts: {
      core: {
        key: 'core',
        name: 'Dusk Domains Core',
        crate: 'dusk-names-core',
        contractId: coreId,
        contractWasm: null,
        dataDriver: {
          path: 'contracts/dusk-names-core.data-driver.wasm',
          bytes: 1,
          sha256: hash,
          blake2b256: hash,
        },
        methodSigs: {
          init: 'init(InitCoreRuntime)',
          set_referral_config_runtime: 'set_referral_config_runtime(SetReferralConfigRuntime)',
          set_fee_config_runtime: 'set_fee_config_runtime(SetFeeConfigRuntime)',
          commit_runtime: 'commit_runtime(CommitRegistrationRuntime)',
          complete_registration_runtime: 'complete_registration_runtime(CompleteRegistrationRuntime)',
          renew_runtime: 'renew_runtime(RenewNameRuntime)',
          update_authorities_runtime: 'update_authorities_runtime(UpdateAuthoritiesRuntime)',
          set_record_sender_runtime: 'set_record_sender_runtime(SetRecordSenderRuntime)',
          clear_record_sender_runtime: 'clear_record_sender_runtime(ClearRecordSenderRuntime)',
          mutate_records_sender_runtime: 'mutate_records_sender_runtime(MutateRecordsSenderRuntime)',
          set_primary_name_runtime: 'set_primary_name_runtime(SetPrimaryNameRuntime)',
          clear_primary_name_runtime: 'clear_primary_name_runtime(ClearPrimaryNameRuntime)',
          create_subname_runtime: 'create_subname_runtime(CreateSubnameRuntime)',
          get_name: 'get_name(GetName)',
          read_record: 'read_record(ReadRecord)',
          read_primary_name: 'read_primary_name(ReadPrimaryName)',
          pending_commitment: 'pending_commitment(PendingCommitmentQuery)',
          fee_config: 'fee_config',
        },
        methods: [],
        examples: [],
      },
      treasury: {
        key: 'treasury',
        name: 'Dusk Domain Treasury',
        crate: 'dusk-name-treasury',
        contractId: treasuryId,
        contractWasm: null,
        dataDriver: {
          path: 'contracts/dusk-name-treasury.data-driver.wasm',
          bytes: 1,
          sha256: hash,
          blake2b256: hash,
        },
        methodSigs: {
          init: 'init(InitTreasury)',
          update_operator_runtime: 'update_operator_runtime(UpdateTreasuryOperatorRuntime)',
          claim_runtime: 'claim_runtime(ClaimTreasuryRuntime)',
          claim_all_runtime: 'claim_all_runtime',
          claim_referral_reward_runtime: 'claim_referral_reward_runtime(ClaimReferralRewardRuntime)',
          claim_all_referral_rewards_runtime: 'claim_all_referral_rewards_runtime(ClaimAllReferralRewardsRuntime)',
          read_state: 'read_state',
        },
        methods: [],
        examples: [],
      },
    },
    indexer: {
      apiVersion: 'v1',
      schemaVersion: '1',
      canonical: false,
      routes: ['/health', '/search', '/names', '/resolve'],
    },
  } as const
}

export function forwardResponse(value: string): ForwardResolutionResponse {
  return {
    canonicalName: 'aurora.dusk',
    node,
    records: [{
      key: 'moonlight_address',
      value,
      visibility: 'public',
      updatedAt: '2026-06-27T00:00:00.000Z',
      ttlSeconds: 300,
    }],
    resolver: {
      resolverId: null,
      health: 'ok',
    },
    expiry: {
      status: 'active',
      expiresAt: null,
    },
    cache: {
      asOf: '2026-06-27T00:00:00.000Z',
      ttlSeconds: 300,
      staleAt: '2026-06-27T00:05:00.000Z',
    },
    warnings: [],
    verificationStatus: 'forward_resolved',
    errors: [],
  }
}
