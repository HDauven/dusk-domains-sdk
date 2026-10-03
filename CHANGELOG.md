# Changelog

## Unreleased

- Add validated Bitcoin, Ethereum, Solana and default EVM address records with canonical write values. ([#242])
- Export shared chain-address validators for plain Node consumers. ([#242])
- Distinguish primary-name set and cleared activity while retaining legacy activity support. ([#243])

- Return chain- and contract-bound preparation envelopes and reject stale or unbound submissions. ([#239])
- Require the current wallet chain for call preparation. ([#239])
- Reject zero contract overrides and configured placeholders at live call boundaries. ([#239])
- Export dense, non-zero contract ID decoding through the writes entrypoint. ([#239])
- Bind exact indexer lookups to their requested identities. ([#239])
- Require canonical authorities and lifecycle status for indexed-name verification. ([#239])
- Require the caller’s expected name for indexed-resolution verification. ([#239])
- Scope bounded route caches to successful operations on a transport, chain and router. ([#239])
- Reject sparse and zero registry contract IDs. ([#239])
- Expose immutable offer IDs and fees in canonical reads and acceptance payloads. ([#239])

- Document rejection of unchanged ancestor assignments and take-back entries. ([#237])
- Expose raw on-chain primary mappings for endpoint cleanup after expiry. ([#237])
- Explain mandatory identity clearing for ancestor owner or manager changes. ([#237])

- Clarify that clearing a primary name requires only endpoint control. ([#237])

- Expose optional transfer reset in call builders and wire encoding. ([#237])
- Distinguish name permissions from ancestor namespace control. ([#237])

- Add namespace call builders, event decoding and indexer response types. ([#237])
- Project subname authority changes and cleared identity without duplicate root rows. ([#237])

- Explain marketplace escrow renewal failures with guidance to close the listing. ([#235])
- Describe open root renewal and identify the renewal actor as the payer. ([#235])
- Explain the 16-reservation cap in wallet errors. ([#235])
- Apply reserved-name policy only to roots while keeping subnames out of public registration. ([#235])

[#235]: https://github.com/HDauven/dusk-domains-protocol/issues/235

[#237]: https://github.com/HDauven/dusk-domains-protocol/issues/237

[#239]: https://github.com/HDauven/dusk-domains-protocol/issues/239

[#242]: https://github.com/HDauven/dusk-domains-protocol/issues/242
[#243]: https://github.com/HDauven/dusk-domains-protocol/issues/243
