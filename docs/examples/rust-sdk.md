# Rust Read Helpers

Status: MVP example

The Rust helper crate lives at `contracts/crates/dusk-name-sdk`. It is a read-side helper crate for wallets, explorers, services, and contract-adjacent tooling. It does not own canonical state; the deployed Dusk Domains core contract remains authoritative for ownership, records, primary names, and expiry.

## Primary-Name Verification

```rust
use dusk_name_sdk::{verify_primary_name, PrimaryNameVerificationError};
use dusk_name_types::{EndpointKind, RecordValue, TypedEndpoint};

let endpoint = TypedEndpoint {
    kind: EndpointKind::MoonlightAddress,
    value: b"dusk1account".to_vec(),
};

let forward_records = vec![RecordValue {
    key: "moonlight_address".into(),
    value: b"dusk1account".to_vec(),
    ttl_seconds: 300,
    updated_at: 1_781_668_800,
}];

let verification = verify_primary_name(&endpoint, Some("aurora.dusk"), &forward_records);

assert!(verification.verified);
assert_eq!(verification.error, None);
```

Rules:

- Forward records must be typed. Do not compare against a generic address field.
- Phoenix payment endpoints are rejected as public primary-name identities in v1.
- `moonlight_address` is the default wallet-display endpoint.
- `dusk_contract`, `dusk_asset`, and `evm_address` are typed records for explicit flows, not default Dusk transfer targets.

## DuskDS Assumptions

- Contracts or services fetch canonical ownership, record, expiry, and primary-name state from the Dusk Domains core contract.
- The helper crate verifies already-fetched typed records; it does not bypass registry or resolver checks.
- Security-sensitive callers should reject expired names, missing resolvers, unsupported resolvers, and missing forward records before calling business logic.
