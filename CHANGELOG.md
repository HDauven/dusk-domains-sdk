# Changelog

## Unreleased

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
