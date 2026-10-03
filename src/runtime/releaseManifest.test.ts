import { describe, expect, it } from 'vitest'
import {
  contractsFromDuskDomainsReleaseManifest,
  validateDuskDomainsReleaseManifest,
  type DuskDomainsReleaseManifest,
} from './releaseManifest'

const routerId = `0x${'33'.repeat(32)}`
const coreId = `0x${'11'.repeat(32)}`
const treasuryId = `0x${'22'.repeat(32)}`
const hash = 'a'.repeat(64)

describe('Dusk Domains release manifest helpers', () => {
  it('validates release manifests and derives contract presets', () => {
    const manifest = releaseManifest()

    expect(validateDuskDomainsReleaseManifest(manifest)).toMatchObject({ ok: true })
    expect(contractsFromDuskDomainsReleaseManifest(manifest, 'https://static.example/releases/devnet')).toMatchObject({
      router: {
        contractId: routerId,
        driverUrl: 'https://static.example/releases/devnet/contracts/dusk-domains-router.data-driver.wasm',
      },
      core: {
        contractId: coreId,
        driverUrl: 'https://static.example/releases/devnet/contracts/dusk-domains-core.data-driver.wasm',
        methodSigs: {
          get_name: 'get_name(GetName)',
          registration_premium: 'registration_premium(GetName)',
          read_record: 'read_record(ReadRecord)',
        },
      },
      treasury: {
        contractId: treasuryId,
      },
    })
  })

  it('rejects manifests missing required SDK method signatures', () => {
    const manifest = releaseManifest()
    delete manifest.contracts.core.methodSigs.read_record

    expect(validateDuskDomainsReleaseManifest(manifest)).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_manifest',
      },
    })
  })

  it('rejects manifests with malformed contract IDs or artifact hashes', () => {
    const invalidContract = releaseManifest()
    invalidContract.contracts.core.contractId = '0x1234'
    expect(validateDuskDomainsReleaseManifest(invalidContract)).toMatchObject({
      ok: false,
      error: { code: 'invalid_manifest' },
    })

    const invalidHash = releaseManifest()
    invalidHash.contracts.treasury.dataDriver.sha256 = 'bad'
    expect(validateDuskDomainsReleaseManifest(invalidHash)).toMatchObject({
      ok: false,
      error: { code: 'invalid_manifest' },
    })
  })

  it('rejects malformed source commits', () => {
    const manifest = releaseManifest()
    manifest.sourceCommit = 'not a git commit'

    expect(validateDuskDomainsReleaseManifest(manifest)).toMatchObject({
      ok: false,
      error: { code: 'invalid_manifest' },
    })
  })
})

function releaseManifest(): DuskDomainsReleaseManifest {
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
      sdk: '@duskdomains/sdk',
      artifacts: '@dusk-domains/artifacts',
      indexerClient: '@dusk-domains/indexer-client',
      indexer: '@dusk-domains/indexer',
    },
    contracts: {
      router: {
        key: 'router',
        name: 'Dusk Domains Router',
        crate: 'dusk-domains-router',
        contractId: routerId,
        contractWasm: null,
        dataDriver: {
          path: 'contracts/dusk-domains-router.data-driver.wasm',
          bytes: 1,
          sha256: hash,
          blake2b256: hash,
        },
        methodSigs: {
          init: 'init(InitRouter)',
          add_registry_runtime: 'add_registry_runtime(AddPoolMember)',
          add_resolver_runtime: 'add_resolver_runtime(AddPoolMember)',
          propose_operator_runtime: 'propose_operator_runtime(ProposeRouterOperatorRuntime)',
          accept_operator_runtime: 'accept_operator_runtime',
          cancel_operator_runtime: 'cancel_operator_runtime',
          set_registrations_paused_runtime: 'set_registrations_paused_runtime(SetRegistrationsPausedRuntime)',
          set_fee_config_runtime: 'set_fee_config_runtime(SetFeeConfigRuntime)',
          issue_reserved_name_runtime: 'issue_reserved_name_runtime(IssueReservedNameRuntime)',
          set_referral_config_runtime: 'set_referral_config_runtime(SetReferralConfigRuntime)',
          config: 'config',
          fee_config: 'fee_config',
          active_registry: 'active_registry',
          active_resolver: 'active_resolver',
          locate_name: 'locate_name(HoldsName)',
          locate_primary: 'locate_primary(LocatePrimary)',
        },
        methods: [],
        examples: [],
      },
      core: {
        key: 'core',
        name: 'Dusk Domains Core',
        crate: 'dusk-domains-core',
        contractId: coreId,
        contractWasm: null,
        dataDriver: {
          path: 'contracts/dusk-domains-core.data-driver.wasm',
          bytes: 1,
          sha256: hash,
          blake2b256: hash,
        },
        methodSigs: {
          init: 'init(InitCoreRuntime)',
          router: 'router',
          commit_runtime: 'commit_runtime(CommitRegistrationRuntime)',
          complete_registration_runtime: 'complete_registration_runtime(CompleteRegistrationRuntime)',
          renew_runtime: 'renew_runtime(RenewNameRuntime)',
          update_authorities_runtime: 'update_authorities_runtime(UpdateAuthoritiesRuntime)',
          escrow_fixed_sale_runtime: 'escrow_fixed_sale_runtime(EscrowFixedSaleRuntime)',
          escrow_auction_runtime: 'escrow_auction_runtime(EscrowAuctionRuntime)',
          accept_marketplace_offer_runtime: 'accept_marketplace_offer_runtime(AcceptMarketplaceOfferRuntime)',
          set_record_sender_runtime: 'set_record_sender_runtime(SetRecordSenderRuntime)',
          clear_record_sender_runtime: 'clear_record_sender_runtime(ClearRecordSenderRuntime)',
          mutate_records_sender_runtime: 'mutate_records_sender_runtime(MutateRecordsSenderRuntime)',
          set_primary_name_runtime: 'set_primary_name_runtime(SetPrimaryNameRuntime)',
          clear_primary_name_runtime: 'clear_primary_name_runtime(ClearPrimaryNameRuntime)',
          create_subname_runtime: 'create_subname_runtime(CreateSubnameRuntime)',
          prune_subname_runtime: 'prune_subname_runtime(PruneSubnameRuntime)',
          remove_subname_runtime: 'remove_subname_runtime(RemoveSubnameRuntime)',
          take_back_subnames_runtime: 'take_back_subnames_runtime(TakeBackSubnamesRuntime)',
          get_name: 'get_name(GetName)',
          registration_premium: 'registration_premium(GetName)',
          read_record: 'read_record(ReadRecord)',
          read_primary_name: 'read_primary_name(ReadPrimaryName)',
          pending_commitment: 'pending_commitment(PendingCommitmentQuery)',
          move_records_runtime: 'move_records_runtime(MoveRecordsRuntime)',
          holds_name: 'holds_name(HoldsName)',
          holds_primary: 'holds_primary(LocatePrimary)',
          record_slot: 'record_slot(HoldsName)',
          accepts_new_names: 'accepts_new_names',
        },
        methods: [],
        examples: [],
      },
      treasury: {
        key: 'treasury',
        name: 'Dusk Domain Treasury',
        crate: 'dusk-domains-treasury',
        contractId: treasuryId,
        contractWasm: null,
        dataDriver: {
          path: 'contracts/dusk-domains-treasury.data-driver.wasm',
          bytes: 1,
          sha256: hash,
          blake2b256: hash,
        },
        methodSigs: {
          init: 'init(InitTreasury)',
          propose_operator_runtime: 'propose_operator_runtime(ProposeTreasuryOperatorRuntime)',
          accept_operator_runtime: 'accept_operator_runtime',
          cancel_operator_runtime: 'cancel_operator_runtime',
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
      routes: [],
    },
  }
}
