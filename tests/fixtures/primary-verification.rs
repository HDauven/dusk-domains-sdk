// Run as a dusk-domains-types example with --features serde at the pinned
// protocol revision in README.md. stdout is primary-verification.json.
use dusk_domains_types::frozen::*;
use serde_json::{Value, json};

fn row<T: serde::Serialize + rkyv::Serialize<wire::Serializer>>(value: &T) -> Value {
    let bytes = wire::encode(value, MAX_WIRE_BYTES).unwrap();
    json!({ "json": value, "rkyv": bytes.iter().map(|b| format!("{b:02x}")).collect::<String>() })
}

fn main() {
    let endpoint = [12; 96];
    let holder = digest::authority(&TypedPrincipal::moonlight(endpoint)).unwrap();
    let node = digest::root_node("example").unwrap();
    let key = NameKey { root: node, node };
    let incarnation = Incarnation {
        generation: 7,
        serial: 1,
    };
    let record = RecordValue {
        key: "moonlight_address".into(),
        value: endpoint.to_vec(),
        ttl_seconds: 1,
        updated_at: 50,
    };
    let primary = PrimaryView {
        primary: Primary {
            endpoint,
            name: NameRef { key, incarnation },
            mapping_id: 42,
            updated_at: 50,
        },
        spelling: "example.dusk".into(),
    };
    let original = NameView {
        name: Name {
            key,
            label: "example".into(),
            incarnation,
            owner: holder,
            manager: holder,
            expires_at: 200,
            grace_end: 300,
            referrer: None,
            subname: None,
            custody: None,
            records: Some(SlotPointer {
                resolver: [5; 32],
                epoch: 1,
                count: 1,
                digest: digest::records_hash(&[record.clone()]).unwrap(),
            }),
        },
        counters: None,
        active: true,
        renewable: true,
        move_pending: None,
    };
    let mut cases = serde_json::Map::new();
    for case in [
        "holder",
        "escrow",
        "transfer with identity kept",
        "manager-only",
        "owner-only",
        "before expiry",
        "expiry",
        "grace",
        "re-registration",
        "transfer back",
    ] {
        let mut name = original.clone();
        let mut height = 100;
        match case {
            "escrow" => {
                name.name.owner = [6; 32];
                name.name.manager = [6; 32];
                name.name.custody = Some(Custody {
                    nonce: 1,
                    incarnation,
                    custodian: [6; 32],
                    origin_owner: holder,
                    origin_manager: holder,
                });
            }
            "transfer with identity kept" => {
                name.name.owner = [9; 32];
                name.name.manager = [9; 32];
            }
            "manager-only" => name.name.owner = [9; 32],
            "owner-only" => name.name.manager = [9; 32],
            "before expiry" => height = 199,
            "expiry" => {
                height = 200;
                name.active = false;
            }
            "grace" => {
                height = 250;
                name.active = false;
            }
            "re-registration" => name.name.incarnation.generation += 1,
            "transfer back" => height = 150,
            _ => {}
        }
        // Independent transcription of entrypoints/records.rs::resolve_primary
        // at the pinned revision. All cases keep the exact forward record.
        let resolves = name.active
            && name.name.incarnation == primary.primary.name.incarnation
            && (name.name.owner == holder || name.name.manager == holder);
        let resolved = resolves.then_some(primary.clone());
        let resolved_record = name.active.then_some(record.clone());
        cases.insert(
            case.into(),
            json!({
                "height": height,
                "get_name": row(&Located::Local(name)),
                "resolve_primary": row(&resolved),
                "resolve_record": row(&Located::Local(resolved_record)),
            }),
        );
    }
    let admission = |id, ordinal| Admission {
        id: [id; 32],
        interface_version: 1,
        code_hash: [0; 32],
        init_hash: [0; 32],
        ordinal,
        admitted_at: 1,
        accepts_moves: true,
        retiring: false,
        governance_version: 1,
    };
    let members = |rows| row(&Members { rows, next: None });
    println!(
        "{}",
        json!({
            "binding": row(&Binding { directory: [1; 32], vault: [2; 32], network: 1 }),
            "interface_version": row(&Interface { kind: ContractKind::Store, version: 1, move_version: 1, custody_version: 1 }),
            "members": members(vec![admission(4, 0)]),
            "members_two": members(vec![admission(4, 0), admission(8, 1)]),
            "home": row(&Home::Local),
            "forwarded_home": row(&Home::Forwarded(Forward {
                root: node, destination: [8; 32], destination_ordinal: 1,
                move_id: [10; 32], generation: 7, completed_at: 100,
            })),
            "read_primary": row(&Some(primary)),
            "no_primary": row(&None::<PrimaryView>),
            "read_record": row(&Located::Local(Some(record))),
            "no_record": row(&Located::Local(None::<RecordValue>)),
            "cases": cases,
        })
    );
}
