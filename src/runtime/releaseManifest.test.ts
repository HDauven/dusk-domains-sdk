import { describe, expect, it } from 'vitest'
import {
  contractsFromDuskDomainsReleaseManifest,
  validateDuskDomainsReleaseManifest,
  type DuskDomainsReleaseManifest,
} from './releaseManifest'

const coreId = `0x${'11'.repeat(32)}`
const treasuryId = `0x${'22'.repeat(32)}`
const hash = 'a'.repeat(64)

describe('Dusk Domains release manifest helpers', () => {
  it('validates release manifests and derives contract presets', () => {
    const manifest = releaseManifest()

    expect(validateDuskDomainsReleaseManifest(manifest)).toMatchObject({ ok: true })
    expect(contractsFromDuskDomainsReleaseManifest(manifest, 'https://static.example/releases/devnet')).toMatchObject({
      core: {
        contractId: coreId,
        driverUrl: 'https://static.example/releases/devnet/contracts/dusk-domains-core.data-driver.wasm',
        methodSigs: {
          get_name: 'get_name(GetName)',
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
      routes: [],
    },
  }
}
