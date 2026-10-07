# Frozen schema inputs

`definitions.json` merges the shared frozen v1 and marketplace v1 JSON definitions.
`catalog.json` records the exact function signatures from shared `driver.rs`'s
`get_schema`, shared `decode_event`, and marketplace `definitions.json` (including
its two metadata encoders). These files are reviewable snapshots of the protocol,
not a separately designed ABI.

Run `npm run generate` after updating these snapshots. The generator writes the
wire types, strict validation schemas, read-method types, public call builders,
method catalog and event catalog. `npm run build` additionally regenerates the
committed standalone JavaScript event catalog used by indexer tooling.

The fixture provenance and source hashes are in `tests/fixtures/README.md`.
