# SDK Source Layout

Implementation code is grouped by responsibility:

- `core/`: domain rules, namehashing, records, principals, registration helpers and subname helpers.
- `contracts/`: core and treasury call builders, wire argument conversion, runtime-bound guards and wallet display context.
- `client/`: public SDK clients, combined read paths, SDK result helpers and validation.
- `onchain/`: direct contract read client and response decoders.
- `indexer/`: event types, projectors, indexer fetch client, read models and compatibility helpers.
- `wallet/`: Dusk Connect app/runtime adapters.
- `writes/`: transaction submission, tracking and confirmation helpers.
- `proof/`: browser write proof capture and storage helpers.
- `runtime/`: environment config and release manifest validation.
- `dev/`: local development wallet utilities.

Root files are public package facades. Do not add implementation modules at the root unless they are new package entrypoints.
