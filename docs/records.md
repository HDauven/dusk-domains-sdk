# Resolver record keys

`getRecordDefinition` supplies labels, validation, byte limits and TTL defaults.
`validateRecordValue` checks a value; `createResolverRecord` validates and
normalizes it. `recordMutationPlan` uses that normalization for write drafts.
Decoding existing records preserves their stored values.

| Key | Value |
| --- | --- |
| `moonlight_address` | Dusk public address; eligible for primary names and the default Dusk recipient. |
| `phoenix_payment_endpoint` | Explicit wallet-approved Dusk shielded receive address; sensitive public data. |
| `evm_address` | DuskEVM address, specifically; 20-byte `0x` hex. |
| `address.btc` | Bitcoin mainnet P2PKH/P2SH Base58Check or SegWit Bech32/Bech32m, with checksum validation. Bech32 is stored lowercase. |
| `address.eth` | Ethereum address; 20-byte `0x` hex, lowercase or valid EIP-55 input, stored with its EIP-55 checksum. |
| `address.sol` | Solana address; Base58 encoding of exactly 32 bytes, preserving leading zeroes. |
| `address.evm` | Default address for EVM chains; the same validation and EIP-55 normalization as `address.eth`. |
| `dusk_contract`, `dusk_asset` | Dusk contract ID or asset identifier. |
| `website`, `avatar`, `content_pointer` | HTTPS website, display URI or content reference. |
| `attestation_ref`, `compliance_ref` | HTTPS, URN or `dusk:` reference. |
| `text.<key>` | Nonempty public text without control characters. |
| `service_endpoint.<key>` | HTTPS service endpoint. |

The four `address.*` keys are curated, public records with a 300-second default
TTL. They do not establish a Dusk primary name or replace `moonlight_address` as
the default Dusk recipient. Unknown `address.*` keys are unsupported by the SDK.
Solana and EVM address formats do not identify the network or prove ownership.

As a reference mapping, [ENSIP-9](https://docs.ens.domains/ensip/9) uses coin types
0 for Bitcoin, 60 for Ethereum and 501 for Solana.
[ENSIP-11](https://docs.ens.domains/ensip/11) maps EVM chain IDs to coin types, and
[ENSIP-19](https://docs.ens.domains/ensip/19/#default-address) defines `0x80000000` as the
default EVM address; `address.evm` serves that role here. These are Dusk string record
keys, not ENS binary address records or an ENS resolver ABI.

Plain Node consumers can import the shared chain validators and normalizers from
`@duskdomains/sdk/chain-addresses`. They return validation errors or normalized
strings; validate before calling a normalizer directly.
