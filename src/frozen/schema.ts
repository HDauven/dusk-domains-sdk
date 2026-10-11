// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.
export const definitions: Record<string, unknown> = {
  "PrincipalKind": {
    "oneOf": [
      {
        "const": "Moonlight"
      },
      {
        "const": "Phoenix"
      },
      {
        "const": "Contract"
      }
    ]
  },
  "TypedPrincipal": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "bytes"
    ],
    "properties": {
      "kind": {
        "$ref": "#/$defs/PrincipalKind"
      },
      "bytes": {
        "type": "array",
        "maxItems": 193,
        "items": {
          "$ref": "#/$defs/u8"
        }
      }
    }
  },
  "u8": {
    "type": "integer",
    "minimum": 0,
    "maximum": 255
  },
  "NameKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "node"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "node": {
        "$ref": "#/$defs/Node"
      }
    }
  },
  "Node": {
    "type": "array",
    "minItems": 32,
    "maxItems": 32,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "Incarnation": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "generation",
      "serial"
    ],
    "properties": {
      "generation": {
        "$ref": "#/$defs/u64"
      },
      "serial": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "u64": {
    "type": "integer",
    "minimum": 0,
    "maximum": "18446744073709551615"
  },
  "NameRef": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "incarnation"
    ],
    "properties": {
      "key": {
        "$ref": "#/$defs/NameKey"
      },
      "incarnation": {
        "$ref": "#/$defs/Incarnation"
      }
    }
  },
  "Deadline": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "valid_until"
    ],
    "properties": {
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Height": {
    "type": "integer",
    "minimum": 0,
    "maximum": "18446744073709551615"
  },
  "Binding": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "directory",
      "vault",
      "network"
    ],
    "properties": {
      "directory": {
        "$ref": "#/$defs/Contract"
      },
      "vault": {
        "$ref": "#/$defs/Contract"
      },
      "network": {
        "$ref": "#/$defs/u8"
      }
    }
  },
  "Contract": {
    "type": "array",
    "minItems": 32,
    "maxItems": 32,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "ContractKind": {
    "oneOf": [
      {
        "const": "Directory"
      },
      {
        "const": "Store"
      },
      {
        "const": "Resolver"
      },
      {
        "const": "Vault"
      },
      {
        "const": "Policy"
      },
      {
        "const": "Marketplace"
      }
    ]
  },
  "Interface": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "version",
      "move_version",
      "custody_version"
    ],
    "properties": {
      "kind": {
        "$ref": "#/$defs/ContractKind"
      },
      "version": {
        "const": 1
      },
      "move_version": {
        "$ref": "#/$defs/u16"
      },
      "custody_version": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "u16": {
    "type": "integer",
    "minimum": 0,
    "maximum": 65535
  },
  "Page": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "after",
      "limit"
    ],
    "properties": {
      "after": {
        "$ref": "#/$defs/Option<Node>"
      },
      "limit": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Option<Node>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Node"
      }
    ]
  },
  "ProposalId": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "operator_epoch",
      "nonce"
    ],
    "properties": {
      "operator_epoch": {
        "$ref": "#/$defs/u64"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "RecordInput": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "value",
      "ttl_seconds"
    ],
    "properties": {
      "key": {
        "type": "string",
        "maxLength": 64,
        "x-max-utf8-bytes": 64
      },
      "value": {
        "type": "array",
        "maxItems": 512,
        "items": {
          "$ref": "#/$defs/u8"
        }
      },
      "ttl_seconds": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "RecordValue": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "value",
      "ttl_seconds",
      "updated_at"
    ],
    "properties": {
      "key": {
        "type": "string",
        "maxLength": 64,
        "x-max-utf8-bytes": 64
      },
      "value": {
        "type": "array",
        "maxItems": 512,
        "items": {
          "$ref": "#/$defs/u8"
        }
      },
      "ttl_seconds": {
        "$ref": "#/$defs/u64"
      },
      "updated_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "MutationAction": {
    "oneOf": [
      {
        "const": "Set"
      },
      {
        "const": "Clear"
      }
    ]
  },
  "RecordMutation": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "action",
      "key",
      "value",
      "ttl_seconds"
    ],
    "properties": {
      "action": {
        "$ref": "#/$defs/MutationAction"
      },
      "key": {
        "type": "string",
        "maxLength": 64,
        "x-max-utf8-bytes": 64
      },
      "value": {
        "type": "array",
        "maxItems": 512,
        "items": {
          "$ref": "#/$defs/u8"
        }
      },
      "ttl_seconds": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "SlotKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "registry",
      "node",
      "epoch"
    ],
    "properties": {
      "registry": {
        "$ref": "#/$defs/Contract"
      },
      "node": {
        "$ref": "#/$defs/Node"
      },
      "epoch": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "SlotPointer": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "resolver",
      "epoch",
      "count",
      "digest"
    ],
    "properties": {
      "resolver": {
        "$ref": "#/$defs/Contract"
      },
      "epoch": {
        "$ref": "#/$defs/u64"
      },
      "count": {
        "$ref": "#/$defs/u8"
      },
      "digest": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "Digest": {
    "type": "array",
    "minItems": 32,
    "maxItems": 32,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "ExpiryPolicy": {
    "oneOf": [
      {
        "const": "InheritsParent"
      },
      {
        "const": "FixedBeforeParent"
      }
    ]
  },
  "Subname": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "parent",
      "depth",
      "expiry_policy",
      "created_at"
    ],
    "properties": {
      "parent": {
        "$ref": "#/$defs/Node"
      },
      "depth": {
        "$ref": "#/$defs/u8"
      },
      "expiry_policy": {
        "$ref": "#/$defs/ExpiryPolicy"
      },
      "created_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Custody": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "nonce",
      "incarnation",
      "custodian",
      "origin_owner",
      "origin_manager"
    ],
    "properties": {
      "nonce": {
        "$ref": "#/$defs/u64"
      },
      "incarnation": {
        "$ref": "#/$defs/Incarnation"
      },
      "custodian": {
        "$ref": "#/$defs/Contract"
      },
      "origin_owner": {
        "$ref": "#/$defs/Authority"
      },
      "origin_manager": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "Authority": {
    "type": "array",
    "minItems": 32,
    "maxItems": 32,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "Name": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "label",
      "incarnation",
      "owner",
      "manager",
      "expires_at",
      "grace_end",
      "referrer",
      "subname",
      "records",
      "custody"
    ],
    "properties": {
      "key": {
        "$ref": "#/$defs/NameKey"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "incarnation": {
        "$ref": "#/$defs/Incarnation"
      },
      "owner": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "expires_at": {
        "$ref": "#/$defs/Height"
      },
      "grace_end": {
        "$ref": "#/$defs/Height"
      },
      "referrer": {
        "$ref": "#/$defs/Option<TypedPrincipal>"
      },
      "subname": {
        "$ref": "#/$defs/Option<Subname>"
      },
      "records": {
        "$ref": "#/$defs/Option<SlotPointer>"
      },
      "custody": {
        "$ref": "#/$defs/Option<Custody>"
      }
    }
  },
  "Option<TypedPrincipal>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/TypedPrincipal"
      }
    ]
  },
  "Option<Subname>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Subname"
      }
    ]
  },
  "Option<SlotPointer>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/SlotPointer"
      }
    ]
  },
  "Option<Custody>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Custody"
      }
    ]
  },
  "RootCounters": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "generation",
      "next_serial",
      "next_epoch",
      "next_custody",
      "revision"
    ],
    "properties": {
      "generation": {
        "$ref": "#/$defs/u64"
      },
      "next_serial": {
        "$ref": "#/$defs/u64"
      },
      "next_epoch": {
        "$ref": "#/$defs/u64"
      },
      "next_custody": {
        "$ref": "#/$defs/u64"
      },
      "revision": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "Primary": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "endpoint",
      "name",
      "mapping_id",
      "updated_at"
    ],
    "properties": {
      "endpoint": {
        "$ref": "#/$defs/Endpoint"
      },
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "mapping_id": {
        "$ref": "#/$defs/u64"
      },
      "updated_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Endpoint": {
    "type": "array",
    "minItems": 96,
    "maxItems": 96,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "Forward": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "destination",
      "destination_ordinal",
      "move_id",
      "generation",
      "completed_at"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "destination": {
        "$ref": "#/$defs/Contract"
      },
      "destination_ordinal": {
        "$ref": "#/$defs/u16"
      },
      "move_id": {
        "$ref": "#/$defs/Digest"
      },
      "generation": {
        "$ref": "#/$defs/u64"
      },
      "completed_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Home": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "const": "Local"
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Staged"
        ],
        "additionalProperties": false,
        "properties": {
          "Staged": {
            "$ref": "#/$defs/Digest"
          }
        }
      }
    ]
  },
  "CommitmentKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "actor",
      "hash"
    ],
    "properties": {
      "actor": {
        "$ref": "#/$defs/Authority"
      },
      "hash": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "Commitment": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "created_at"
    ],
    "properties": {
      "key": {
        "$ref": "#/$defs/CommitmentKey"
      },
      "created_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Capacity": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "memory_bytes",
      "reserved_bytes",
      "accepts_new",
      "sealed"
    ],
    "properties": {
      "memory_bytes": {
        "$ref": "#/$defs/u64"
      },
      "reserved_bytes": {
        "$ref": "#/$defs/u64"
      },
      "accepts_new": {
        "$ref": "#/$defs/bool"
      },
      "sealed": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "bool": {
    "type": "boolean"
  },
  "QuoteRequest": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "directory",
      "store",
      "node",
      "label",
      "actor",
      "years",
      "height",
      "previous_generation",
      "previous_grace_end",
      "policy_version"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "directory": {
        "$ref": "#/$defs/Contract"
      },
      "store": {
        "$ref": "#/$defs/Contract"
      },
      "node": {
        "$ref": "#/$defs/Node"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "actor": {
        "$ref": "#/$defs/Authority"
      },
      "years": {
        "$ref": "#/$defs/u8"
      },
      "height": {
        "$ref": "#/$defs/Height"
      },
      "previous_generation": {
        "$ref": "#/$defs/u64"
      },
      "previous_grace_end": {
        "$ref": "#/$defs/Option<Height>"
      },
      "policy_version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "Option<Height>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Height"
      }
    ]
  },
  "LabelStatus": {
    "oneOf": [
      {
        "const": "Denied"
      },
      {
        "const": "Public"
      },
      {
        "const": "Reserved"
      }
    ]
  },
  "PolicyQuote": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "request_hash",
      "config_version",
      "registration_open",
      "label_status",
      "base_lux",
      "premium_lux",
      "base_referral_bps",
      "premium_referral_bps",
      "referral_lux",
      "valid_until"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "request_hash": {
        "$ref": "#/$defs/Digest"
      },
      "config_version": {
        "$ref": "#/$defs/u64"
      },
      "registration_open": {
        "$ref": "#/$defs/bool"
      },
      "label_status": {
        "$ref": "#/$defs/LabelStatus"
      },
      "base_lux": {
        "$ref": "#/$defs/Lux"
      },
      "premium_lux": {
        "$ref": "#/$defs/Lux"
      },
      "base_referral_bps": {
        "$ref": "#/$defs/u16"
      },
      "premium_referral_bps": {
        "$ref": "#/$defs/u16"
      },
      "referral_lux": {
        "$ref": "#/$defs/Lux"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Lux": {
    "type": "string",
    "pattern": "^[0-9]+$",
    "format": "uint64-lux",
    "description": "Decimal u64 Lux; output omits leading zeroes."
  },
  "PolicyConfig": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "config_version",
      "registration_open",
      "minimum_root_bytes",
      "annual_lux",
      "premium_start_lux",
      "base_referral_bps",
      "premium_referral_bps",
      "reserved",
      "denied"
    ],
    "properties": {
      "config_version": {
        "$ref": "#/$defs/u64"
      },
      "registration_open": {
        "$ref": "#/$defs/bool"
      },
      "minimum_root_bytes": {
        "$ref": "#/$defs/u8"
      },
      "annual_lux": {
        "$ref": "#/$defs/[Lux; 5]"
      },
      "premium_start_lux": {
        "$ref": "#/$defs/Lux"
      },
      "base_referral_bps": {
        "$ref": "#/$defs/u16"
      },
      "premium_referral_bps": {
        "$ref": "#/$defs/u16"
      },
      "reserved": {
        "type": "array",
        "maxItems": 128,
        "items": {
          "type": "string",
          "maxLength": 63,
          "x-max-utf8-bytes": 63
        }
      },
      "denied": {
        "type": "array",
        "maxItems": 128,
        "items": {
          "type": "string",
          "maxLength": 63,
          "x-max-utf8-bytes": 63
        }
      }
    }
  },
  "[Lux; 5]": {
    "type": "array",
    "minItems": 5,
    "maxItems": 5,
    "items": {
      "$ref": "#/$defs/Lux"
    }
  },
  "InitPolicy": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding",
      "config"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      },
      "config": {
        "$ref": "#/$defs/PolicyConfig"
      }
    }
  },
  "RenewalSchedule": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "effective_at",
      "annual_lux",
      "referral_bps"
    ],
    "properties": {
      "version": {
        "$ref": "#/$defs/u64"
      },
      "effective_at": {
        "$ref": "#/$defs/Height"
      },
      "annual_lux": {
        "$ref": "#/$defs/[Lux; 5]"
      },
      "referral_bps": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "MemberKind": {
    "oneOf": [
      {
        "const": "Store"
      },
      {
        "const": "Resolver"
      }
    ]
  },
  "Admission": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "interface_version",
      "code_hash",
      "init_hash",
      "ordinal",
      "admitted_at",
      "accepts_moves",
      "retiring",
      "governance_version"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Contract"
      },
      "interface_version": {
        "$ref": "#/$defs/u16"
      },
      "code_hash": {
        "$ref": "#/$defs/Digest"
      },
      "init_hash": {
        "$ref": "#/$defs/Digest"
      },
      "ordinal": {
        "$ref": "#/$defs/u16"
      },
      "admitted_at": {
        "$ref": "#/$defs/Height"
      },
      "accepts_moves": {
        "$ref": "#/$defs/bool"
      },
      "retiring": {
        "$ref": "#/$defs/bool"
      },
      "governance_version": {
        "type": "integer",
        "minimum": 0,
        "maximum": "18446744073709551615"
      }
    }
  },
  "MarketState": {
    "oneOf": [
      {
        "const": "Listed"
      },
      {
        "const": "Draining"
      },
      {
        "const": "Retired"
      }
    ]
  },
  "Market": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "state",
      "version",
      "interface_version",
      "code_hash",
      "init_hash"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Contract"
      },
      "state": {
        "$ref": "#/$defs/MarketState"
      },
      "version": {
        "$ref": "#/$defs/u64"
      },
      "interface_version": {
        "$ref": "#/$defs/u16"
      },
      "code_hash": {
        "$ref": "#/$defs/Digest"
      },
      "init_hash": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "MarketWindDown": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "new_orders_disabled",
      "unsettled_orders",
      "refundable_lux"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "new_orders_disabled": {
        "$ref": "#/$defs/bool"
      },
      "unsettled_orders": {
        "$ref": "#/$defs/u64"
      },
      "refundable_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "OperatorPair": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "principal",
      "recipient"
    ],
    "properties": {
      "principal": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "recipient": {
        "$ref": "#/$defs/Endpoint"
      }
    }
  },
  "RegistrationContext": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "revision",
      "policy",
      "policy_version",
      "operator",
      "operator_paused",
      "guardian_suspended",
      "allocation_version",
      "newest_store"
    ],
    "properties": {
      "revision": {
        "$ref": "#/$defs/u64"
      },
      "policy": {
        "$ref": "#/$defs/Contract"
      },
      "policy_version": {
        "$ref": "#/$defs/u64"
      },
      "operator": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "operator_paused": {
        "$ref": "#/$defs/bool"
      },
      "guardian_suspended": {
        "$ref": "#/$defs/bool"
      },
      "allocation_version": {
        "$ref": "#/$defs/u64"
      },
      "newest_store": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "DirectoryConfig": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding",
      "operator",
      "guardian",
      "operator_epoch",
      "guardian_epoch",
      "revision",
      "proposal_delay",
      "guardian_delay",
      "registration",
      "renewal",
      "preferred_marketplace",
      "market_version",
      "store_count",
      "resolver_count",
      "source_version",
      "recipient_version"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      },
      "operator": {
        "$ref": "#/$defs/OperatorPair"
      },
      "guardian": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "operator_epoch": {
        "$ref": "#/$defs/u64"
      },
      "guardian_epoch": {
        "$ref": "#/$defs/u64"
      },
      "revision": {
        "$ref": "#/$defs/u64"
      },
      "proposal_delay": {
        "$ref": "#/$defs/u64"
      },
      "guardian_delay": {
        "$ref": "#/$defs/u64"
      },
      "registration": {
        "$ref": "#/$defs/RegistrationContext"
      },
      "renewal": {
        "$ref": "#/$defs/RenewalSchedule"
      },
      "preferred_marketplace": {
        "$ref": "#/$defs/Option<Contract>"
      },
      "market_version": {
        "$ref": "#/$defs/u64"
      },
      "store_count": {
        "$ref": "#/$defs/u16"
      },
      "resolver_count": {
        "$ref": "#/$defs/u16"
      },
      "source_version": {
        "$ref": "#/$defs/u64"
      },
      "recipient_version": {
        "type": "integer",
        "minimum": 0,
        "maximum": "18446744073709551615"
      }
    }
  },
  "Option<Contract>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Contract"
      }
    ]
  },
  "Action": {
    "oneOf": [
      {
        "type": "object",
        "required": [
          "SetPolicy"
        ],
        "additionalProperties": false,
        "properties": {
          "SetPolicy": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_version",
              "admission"
            ],
            "properties": {
              "expected_version": {
                "$ref": "#/$defs/u64"
              },
              "admission": {
                "$ref": "#/$defs/Admission"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "AddStore"
        ],
        "additionalProperties": false,
        "properties": {
          "AddStore": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_allocation_version",
              "admission"
            ],
            "properties": {
              "expected_allocation_version": {
                "$ref": "#/$defs/u64"
              },
              "admission": {
                "$ref": "#/$defs/Admission"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "AddResolver"
        ],
        "additionalProperties": false,
        "properties": {
          "AddResolver": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_count",
              "admission"
            ],
            "properties": {
              "expected_count": {
                "$ref": "#/$defs/u16"
              },
              "admission": {
                "$ref": "#/$defs/Admission"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "SetAcceptsMoves"
        ],
        "additionalProperties": false,
        "properties": {
          "SetAcceptsMoves": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "store",
              "expected_version",
              "value"
            ],
            "properties": {
              "store": {
                "$ref": "#/$defs/Contract"
              },
              "value": {
                "$ref": "#/$defs/bool"
              },
              "expected_version": {
                "type": "integer",
                "minimum": 0,
                "maximum": "18446744073709551615"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "SetRenewal"
        ],
        "additionalProperties": false,
        "properties": {
          "SetRenewal": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_version",
              "annual_lux",
              "referral_bps"
            ],
            "properties": {
              "expected_version": {
                "$ref": "#/$defs/u64"
              },
              "annual_lux": {
                "$ref": "#/$defs/[Lux; 5]"
              },
              "referral_bps": {
                "$ref": "#/$defs/u16"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "SetPreferredMarketplace"
        ],
        "additionalProperties": false,
        "properties": {
          "SetPreferredMarketplace": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_version",
              "market"
            ],
            "properties": {
              "expected_version": {
                "$ref": "#/$defs/u64"
              },
              "market": {
                "$ref": "#/$defs/Option<Contract>"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "SetMarketplace"
        ],
        "additionalProperties": false,
        "properties": {
          "SetMarketplace": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_version",
              "market",
              "state",
              "interface_version",
              "code_hash",
              "init_hash"
            ],
            "properties": {
              "expected_version": {
                "$ref": "#/$defs/u64"
              },
              "market": {
                "$ref": "#/$defs/Contract"
              },
              "state": {
                "$ref": "#/$defs/MarketState"
              },
              "interface_version": {
                "$ref": "#/$defs/u16"
              },
              "code_hash": {
                "$ref": "#/$defs/Digest"
              },
              "init_hash": {
                "$ref": "#/$defs/Digest"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "SetRecipient"
        ],
        "additionalProperties": false,
        "properties": {
          "SetRecipient": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_operator_epoch",
              "expected_recipient_version",
              "recipient"
            ],
            "properties": {
              "expected_operator_epoch": {
                "$ref": "#/$defs/u64"
              },
              "recipient": {
                "$ref": "#/$defs/Endpoint"
              },
              "expected_recipient_version": {
                "type": "integer",
                "minimum": 0,
                "maximum": "18446744073709551615"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "ReplaceOperator"
        ],
        "additionalProperties": false,
        "properties": {
          "ReplaceOperator": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_epoch",
              "next"
            ],
            "properties": {
              "expected_epoch": {
                "$ref": "#/$defs/u64"
              },
              "next": {
                "$ref": "#/$defs/OperatorPair"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "ReplaceGuardian"
        ],
        "additionalProperties": false,
        "properties": {
          "ReplaceGuardian": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "expected_epoch",
              "next"
            ],
            "properties": {
              "expected_epoch": {
                "$ref": "#/$defs/u64"
              },
              "next": {
                "$ref": "#/$defs/TypedPrincipal"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "AddController"
        ],
        "additionalProperties": false,
        "properties": {
          "AddController": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "contract",
              "scopes",
              "expected_version"
            ],
            "properties": {
              "contract": {
                "$ref": "#/$defs/Contract"
              },
              "scopes": {
                "$ref": "#/$defs/u8"
              },
              "expected_version": {
                "$ref": "#/$defs/u64"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "RemoveController"
        ],
        "additionalProperties": false,
        "properties": {
          "RemoveController": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "contract",
              "expected_version"
            ],
            "properties": {
              "contract": {
                "$ref": "#/$defs/Contract"
              },
              "expected_version": {
                "$ref": "#/$defs/u64"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "SetRetiring"
        ],
        "additionalProperties": false,
        "properties": {
          "SetRetiring": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "store",
              "expected_version",
              "value"
            ],
            "properties": {
              "store": {
                "$ref": "#/$defs/Contract"
              },
              "value": {
                "$ref": "#/$defs/bool"
              },
              "expected_version": {
                "type": "integer",
                "minimum": 0,
                "maximum": "18446744073709551615"
              }
            }
          }
        }
      }
    ]
  },
  "ProposalStatus": {
    "oneOf": [
      {
        "const": "Pending"
      },
      {
        "const": "Executed"
      },
      {
        "const": "Cancelled"
      },
      {
        "const": "Expired"
      },
      {
        "const": "Invalidated"
      }
    ]
  },
  "Proposal": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "action",
      "action_hash",
      "proposed_at",
      "ready_at",
      "expires_at",
      "status"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "action": {
        "$ref": "#/$defs/Action"
      },
      "action_hash": {
        "$ref": "#/$defs/Digest"
      },
      "proposed_at": {
        "$ref": "#/$defs/Height"
      },
      "ready_at": {
        "$ref": "#/$defs/Height"
      },
      "expires_at": {
        "$ref": "#/$defs/Height"
      },
      "status": {
        "$ref": "#/$defs/ProposalStatus"
      }
    }
  },
  "Propose": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "action"
    ],
    "properties": {
      "action": {
        "$ref": "#/$defs/Action"
      }
    }
  },
  "ProposalKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      }
    }
  },
  "Cancel": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      }
    }
  },
  "IncreaseDelays": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "proposal_delay",
      "guardian_delay"
    ],
    "properties": {
      "proposal_delay": {
        "$ref": "#/$defs/u64"
      },
      "guardian_delay": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "MemberQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "id"
    ],
    "properties": {
      "kind": {
        "$ref": "#/$defs/MemberKind"
      },
      "id": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "MemberPage": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "kind",
      "start",
      "limit"
    ],
    "properties": {
      "kind": {
        "$ref": "#/$defs/MemberKind"
      },
      "start": {
        "$ref": "#/$defs/u16"
      },
      "limit": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Members": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "rows",
      "next"
    ],
    "properties": {
      "rows": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Admission"
        }
      },
      "next": {
        "$ref": "#/$defs/Option<u16>"
      }
    }
  },
  "Option<u16>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/u16"
      }
    ]
  },
  "ProposalPage": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "after_nonce",
      "limit"
    ],
    "properties": {
      "after_nonce": {
        "$ref": "#/$defs/u64"
      },
      "limit": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Proposals": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "rows",
      "next_nonce"
    ],
    "properties": {
      "rows": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Proposal"
        }
      },
      "next_nonce": {
        "$ref": "#/$defs/Option<u64>"
      }
    }
  },
  "Option<u64>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/u64"
      }
    ]
  },
  "InitDirectory": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "network",
      "vault",
      "operator",
      "guardian",
      "proposal_delay",
      "guardian_delay",
      "policy",
      "renewal_annual_lux",
      "renewal_referral_bps",
      "initial_store",
      "initial_resolver",
      "initial_market",
      "operator_paused"
    ],
    "properties": {
      "network": {
        "$ref": "#/$defs/u8"
      },
      "vault": {
        "$ref": "#/$defs/Contract"
      },
      "operator": {
        "$ref": "#/$defs/OperatorPair"
      },
      "guardian": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "proposal_delay": {
        "$ref": "#/$defs/u64"
      },
      "guardian_delay": {
        "$ref": "#/$defs/u64"
      },
      "policy": {
        "$ref": "#/$defs/Admission"
      },
      "renewal_annual_lux": {
        "$ref": "#/$defs/[Lux; 5]"
      },
      "renewal_referral_bps": {
        "$ref": "#/$defs/u16"
      },
      "initial_store": {
        "$ref": "#/$defs/Admission"
      },
      "initial_resolver": {
        "$ref": "#/$defs/Admission"
      },
      "initial_market": {
        "$ref": "#/$defs/Option<Market>"
      },
      "operator_paused": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "Option<Market>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Market"
      }
    ]
  },
  "InitStore": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      }
    }
  },
  "CommitArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "hash"
    ],
    "properties": {
      "hash": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "Register": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "label",
      "years",
      "commitment",
      "secret",
      "commitment_store",
      "expected_fee_lux",
      "expected_policy_version",
      "expected_policy_config_version",
      "valid_until",
      "referrer",
      "records",
      "primary"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "years": {
        "$ref": "#/$defs/u8"
      },
      "commitment": {
        "$ref": "#/$defs/Digest"
      },
      "secret": {
        "$ref": "#/$defs/Digest"
      },
      "commitment_store": {
        "$ref": "#/$defs/Contract"
      },
      "expected_fee_lux": {
        "$ref": "#/$defs/Lux"
      },
      "expected_policy_version": {
        "$ref": "#/$defs/u64"
      },
      "expected_policy_config_version": {
        "$ref": "#/$defs/u64"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      },
      "referrer": {
        "$ref": "#/$defs/Option<TypedPrincipal>"
      },
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordInput"
        }
      },
      "primary": {
        "$ref": "#/$defs/Option<Endpoint>"
      }
    }
  },
  "Option<Endpoint>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Endpoint"
      }
    ]
  },
  "Renew": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "years",
      "expected_schedule_version",
      "expected_fee_lux",
      "valid_until"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "years": {
        "$ref": "#/$defs/u8"
      },
      "expected_schedule_version": {
        "$ref": "#/$defs/u64"
      },
      "expected_fee_lux": {
        "$ref": "#/$defs/Lux"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "PaidOperation": {
    "oneOf": [
      {
        "type": "object",
        "required": [
          "Register"
        ],
        "additionalProperties": false,
        "properties": {
          "Register": {
            "$ref": "#/$defs/Register"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Renew"
        ],
        "additionalProperties": false,
        "properties": {
          "Renew": {
            "$ref": "#/$defs/Renew"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "RegisterFor"
        ],
        "additionalProperties": false,
        "properties": {
          "RegisterFor": {
            "$ref": "#/$defs/RegisterFor"
          }
        }
      }
    ]
  },
  "IssueReserved": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "label",
      "years",
      "owner",
      "manager",
      "expected_policy_version",
      "expected_policy_config_version",
      "valid_until"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "years": {
        "$ref": "#/$defs/u8"
      },
      "owner": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "expected_policy_version": {
        "$ref": "#/$defs/u64"
      },
      "expected_policy_config_version": {
        "$ref": "#/$defs/u64"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "QuoteRegistration": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "label",
      "years",
      "actor",
      "expected_policy_version",
      "expected_policy_config_version"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "years": {
        "$ref": "#/$defs/u8"
      },
      "actor": {
        "$ref": "#/$defs/Authority"
      },
      "expected_policy_version": {
        "$ref": "#/$defs/u64"
      },
      "expected_policy_config_version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "RegistrationQuote": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "policy",
      "policy_version",
      "quote",
      "total_lux",
      "height"
    ],
    "properties": {
      "policy": {
        "$ref": "#/$defs/Contract"
      },
      "policy_version": {
        "$ref": "#/$defs/u64"
      },
      "quote": {
        "$ref": "#/$defs/PolicyQuote"
      },
      "total_lux": {
        "$ref": "#/$defs/Lux"
      },
      "height": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "RenewalQuote": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schedule_version",
      "total_lux",
      "referral_lux",
      "new_expiry",
      "new_grace_end"
    ],
    "properties": {
      "schedule_version": {
        "$ref": "#/$defs/u64"
      },
      "total_lux": {
        "$ref": "#/$defs/Lux"
      },
      "referral_lux": {
        "$ref": "#/$defs/Lux"
      },
      "new_expiry": {
        "$ref": "#/$defs/Height"
      },
      "new_grace_end": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Authorities": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "owner",
      "manager",
      "clear_identity"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "owner": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "clear_identity": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "MutateRecords": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "mutations"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "mutations": {
        "type": "array",
        "maxItems": 8,
        "items": {
          "$ref": "#/$defs/RecordMutation"
        }
      }
    }
  },
  "ReplaceRecords": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "records"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordInput"
        }
      }
    }
  },
  "MoveRecords": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "records"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordValue"
        }
      }
    }
  },
  "SetPrimary": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "endpoint"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "endpoint": {
        "$ref": "#/$defs/Endpoint"
      }
    }
  },
  "ClearPrimary": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "endpoint",
      "expected_mapping_id"
    ],
    "properties": {
      "endpoint": {
        "$ref": "#/$defs/Endpoint"
      },
      "expected_mapping_id": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "CreateSubname": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "parent",
      "node",
      "label",
      "owner",
      "manager",
      "expires_at",
      "expiry_policy"
    ],
    "properties": {
      "parent": {
        "$ref": "#/$defs/NameRef"
      },
      "node": {
        "$ref": "#/$defs/Node"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "owner": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "expires_at": {
        "$ref": "#/$defs/Height"
      },
      "expiry_policy": {
        "$ref": "#/$defs/ExpiryPolicy"
      }
    }
  },
  "TakeBack": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ancestor",
      "targets",
      "owner",
      "manager"
    ],
    "properties": {
      "ancestor": {
        "$ref": "#/$defs/NameRef"
      },
      "targets": {
        "type": "array",
        "maxItems": 256,
        "items": {
          "$ref": "#/$defs/NameRef"
        }
      },
      "owner": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "NameView": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "counters",
      "active",
      "renewable",
      "move_pending"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/Name"
      },
      "counters": {
        "$ref": "#/$defs/Option<RootCounters>"
      },
      "active": {
        "$ref": "#/$defs/bool"
      },
      "renewable": {
        "$ref": "#/$defs/bool"
      },
      "move_pending": {
        "$ref": "#/$defs/Option<Digest>"
      }
    }
  },
  "Option<RootCounters>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/RootCounters"
      }
    ]
  },
  "Option<Digest>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Digest"
      }
    ]
  },
  "StoreStats": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "local_roots",
      "forwarded_roots",
      "subnames",
      "commitments",
      "primaries",
      "outgoing_moves",
      "incoming_moves"
    ],
    "properties": {
      "local_roots": {
        "$ref": "#/$defs/u64"
      },
      "forwarded_roots": {
        "$ref": "#/$defs/u64"
      },
      "subnames": {
        "$ref": "#/$defs/u64"
      },
      "commitments": {
        "$ref": "#/$defs/u32"
      },
      "primaries": {
        "$ref": "#/$defs/u64"
      },
      "outgoing_moves": {
        "$ref": "#/$defs/u16"
      },
      "incoming_moves": {
        "$ref": "#/$defs/u8"
      }
    }
  },
  "u32": {
    "type": "integer",
    "minimum": 0,
    "maximum": 4294967295
  },
  "RecordQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "record_key"
    ],
    "properties": {
      "key": {
        "$ref": "#/$defs/NameKey"
      },
      "record_key": {
        "type": "string",
        "maxLength": 64,
        "x-max-utf8-bytes": 64
      }
    }
  },
  "RecordsView": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "pointer",
      "records"
    ],
    "properties": {
      "pointer": {
        "$ref": "#/$defs/Option<SlotPointer>"
      },
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordValue"
        }
      }
    }
  },
  "PrimaryView": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "primary",
      "spelling"
    ],
    "properties": {
      "primary": {
        "$ref": "#/$defs/Primary"
      },
      "spelling": {
        "type": "string",
        "maxLength": 260,
        "x-max-utf8-bytes": 260
      }
    }
  },
  "ChildPage": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "parent",
      "after",
      "limit"
    ],
    "properties": {
      "parent": {
        "$ref": "#/$defs/NameKey"
      },
      "after": {
        "$ref": "#/$defs/Option<Node>"
      },
      "limit": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Children": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "rows",
      "next"
    ],
    "properties": {
      "rows": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/Name"
        }
      },
      "next": {
        "$ref": "#/$defs/Option<Node>"
      }
    }
  },
  "ConsumeCommitment": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "key",
      "node",
      "label",
      "secret",
      "destination"
    ],
    "properties": {
      "key": {
        "$ref": "#/$defs/CommitmentKey"
      },
      "node": {
        "$ref": "#/$defs/Node"
      },
      "label": {
        "type": "string",
        "maxLength": 63,
        "x-max-utf8-bytes": 63
      },
      "secret": {
        "$ref": "#/$defs/Digest"
      },
      "destination": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "InitResolver": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      }
    }
  },
  "WriteSlot": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "epoch",
      "records"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "epoch": {
        "$ref": "#/$defs/u64"
      },
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordValue"
        }
      }
    }
  },
  "ApplyMutations": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "epoch",
      "mutations"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "epoch": {
        "$ref": "#/$defs/u64"
      },
      "mutations": {
        "type": "array",
        "maxItems": 8,
        "items": {
          "$ref": "#/$defs/RecordMutation"
        }
      }
    }
  },
  "SlotSnapshot": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "records",
      "count",
      "digest"
    ],
    "properties": {
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordValue"
        }
      },
      "count": {
        "$ref": "#/$defs/u8"
      },
      "digest": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "ResolverStats": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slots",
      "records"
    ],
    "properties": {
      "slots": {
        "$ref": "#/$defs/u64"
      },
      "records": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "SlotRecordQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slot",
      "key"
    ],
    "properties": {
      "slot": {
        "$ref": "#/$defs/SlotKey"
      },
      "key": {
        "type": "string",
        "maxLength": 64,
        "x-max-utf8-bytes": 64
      }
    }
  },
  "SlotLiveness": {
    "oneOf": [
      {
        "const": "Current"
      },
      {
        "const": "Staged"
      },
      {
        "const": "Stale"
      }
    ]
  },
  "SlotLivenessQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "epoch",
      "resolver"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "epoch": {
        "$ref": "#/$defs/u64"
      },
      "resolver": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "TransferAndCall": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "target",
      "callback_gas",
      "data"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "target": {
        "$ref": "#/$defs/Contract"
      },
      "callback_gas": {
        "$ref": "#/$defs/u64"
      },
      "data": {
        "type": "array",
        "maxItems": 4096,
        "items": {
          "$ref": "#/$defs/u8"
        }
      }
    }
  },
  "CustodyNotice": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "directory",
      "store",
      "name",
      "nonce",
      "previous_owner",
      "previous_manager",
      "data"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "directory": {
        "$ref": "#/$defs/Contract"
      },
      "store": {
        "$ref": "#/$defs/Contract"
      },
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      },
      "previous_owner": {
        "$ref": "#/$defs/Authority"
      },
      "previous_manager": {
        "$ref": "#/$defs/Authority"
      },
      "data": {
        "type": "array",
        "maxItems": 4096,
        "items": {
          "$ref": "#/$defs/u8"
        }
      }
    }
  },
  "CustodyAck": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "magic",
      "store",
      "node",
      "incarnation",
      "nonce"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "magic": {
        "$ref": "#/$defs/[u8;8]"
      },
      "store": {
        "$ref": "#/$defs/Contract"
      },
      "node": {
        "$ref": "#/$defs/Node"
      },
      "incarnation": {
        "$ref": "#/$defs/Incarnation"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "[u8;8]": {
    "type": "array",
    "minItems": 8,
    "maxItems": 8,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "ReturnCustody": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "nonce"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "FeeReason": {
    "oneOf": [
      {
        "const": "Registration"
      },
      {
        "const": "Renewal"
      },
      {
        "const": "Marketplace"
      }
    ]
  },
  "FeeMetadata": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "reason",
      "name",
      "payer",
      "beneficiary",
      "referral_lux"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "reason": {
        "$ref": "#/$defs/FeeReason"
      },
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "payer": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "beneficiary": {
        "$ref": "#/$defs/Option<TypedPrincipal>"
      },
      "referral_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "SourceKind": {
    "oneOf": [
      {
        "const": "Store"
      },
      {
        "const": "Marketplace"
      }
    ]
  },
  "FeeSource": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "kind",
      "state"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Contract"
      },
      "kind": {
        "$ref": "#/$defs/SourceKind"
      },
      "state": {
        "$ref": "#/$defs/MarketState"
      }
    }
  },
  "SourceUpdate": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "expected_version",
      "source"
    ],
    "properties": {
      "expected_version": {
        "$ref": "#/$defs/u64"
      },
      "source": {
        "$ref": "#/$defs/FeeSource"
      }
    }
  },
  "InitVault": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding",
      "sources"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      },
      "sources": {
        "type": "array",
        "maxItems": 65,
        "items": {
          "$ref": "#/$defs/FeeSource"
        }
      }
    }
  },
  "ClaimAmount": {
    "oneOf": [
      {
        "const": "All"
      },
      {
        "type": "object",
        "required": [
          "Exact"
        ],
        "additionalProperties": false,
        "properties": {
          "Exact": {
            "$ref": "#/$defs/Lux"
          }
        }
      }
    ]
  },
  "ClaimReferral": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "amount",
      "recipient"
    ],
    "properties": {
      "amount": {
        "$ref": "#/$defs/ClaimAmount"
      },
      "recipient": {
        "$ref": "#/$defs/Endpoint"
      }
    }
  },
  "ClaimProtocol": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "amount",
      "expected_operator_epoch"
    ],
    "properties": {
      "amount": {
        "$ref": "#/$defs/ClaimAmount"
      },
      "expected_operator_epoch": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "ReferralRow": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beneficiary",
      "claimable_lux"
    ],
    "properties": {
      "beneficiary": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "claimable_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "VaultState": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "protocol_lux",
      "liability_lux",
      "accounted_lux",
      "reserved_beneficiaries",
      "max_beneficiaries",
      "source_version"
    ],
    "properties": {
      "protocol_lux": {
        "$ref": "#/$defs/Lux"
      },
      "liability_lux": {
        "$ref": "#/$defs/Lux"
      },
      "accounted_lux": {
        "$ref": "#/$defs/Lux"
      },
      "reserved_beneficiaries": {
        "$ref": "#/$defs/u32"
      },
      "max_beneficiaries": {
        "$ref": "#/$defs/u32"
      },
      "source_version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "BalanceView": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "accounted_lux",
      "actual_lux",
      "surplus_lux"
    ],
    "properties": {
      "accounted_lux": {
        "$ref": "#/$defs/Lux"
      },
      "actual_lux": {
        "$ref": "#/$defs/Lux"
      },
      "surplus_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "ReferralPage": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "after",
      "limit"
    ],
    "properties": {
      "after": {
        "$ref": "#/$defs/Option<TypedPrincipal>"
      },
      "limit": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Referrals": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "rows",
      "next"
    ],
    "properties": {
      "rows": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/ReferralRow"
        }
      },
      "next": {
        "$ref": "#/$defs/Option<TypedPrincipal>"
      }
    }
  },
  "BeginMove": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "destination",
      "expected_revision",
      "expected_destination_ordinal"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/NameRef"
      },
      "destination": {
        "$ref": "#/$defs/Contract"
      },
      "expected_revision": {
        "$ref": "#/$defs/u64"
      },
      "expected_destination_ordinal": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "MoveTicket": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "source",
      "destination",
      "root",
      "initiator",
      "source_revision",
      "counters",
      "row_count",
      "primary_count",
      "manifest",
      "created_at",
      "expires_at"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "source": {
        "$ref": "#/$defs/Contract"
      },
      "destination": {
        "$ref": "#/$defs/Contract"
      },
      "root": {
        "$ref": "#/$defs/NameRef"
      },
      "initiator": {
        "$ref": "#/$defs/Authority"
      },
      "source_revision": {
        "$ref": "#/$defs/u64"
      },
      "counters": {
        "$ref": "#/$defs/RootCounters"
      },
      "row_count": {
        "$ref": "#/$defs/u16"
      },
      "primary_count": {
        "$ref": "#/$defs/u16"
      },
      "manifest": {
        "$ref": "#/$defs/Digest"
      },
      "created_at": {
        "$ref": "#/$defs/Height"
      },
      "expires_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "ExportRow": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "index",
      "name",
      "primary"
    ],
    "properties": {
      "index": {
        "$ref": "#/$defs/u16"
      },
      "name": {
        "$ref": "#/$defs/Name"
      },
      "primary": {
        "$ref": "#/$defs/Option<Primary>"
      }
    }
  },
  "Option<Primary>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Primary"
      }
    ]
  },
  "MoveLiveRow": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "expires_at",
      "grace_end",
      "expiry_policy",
      "primary_mapping_id"
    ],
    "properties": {
      "expires_at": {
        "$ref": "#/$defs/Height"
      },
      "grace_end": {
        "$ref": "#/$defs/Height"
      },
      "expiry_policy": {
        "$ref": "#/$defs/Option<ExpiryPolicy>"
      },
      "primary_mapping_id": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "Option<ExpiryPolicy>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/ExpiryPolicy"
      }
    ]
  },
  "MoveLiveState": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "revision",
      "rows"
    ],
    "properties": {
      "revision": {
        "$ref": "#/$defs/u64"
      },
      "rows": {
        "type": "array",
        "maxItems": 257,
        "items": {
          "$ref": "#/$defs/MoveLiveRow"
        }
      }
    }
  },
  "ImportHeader": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ticket"
    ],
    "properties": {
      "ticket": {
        "$ref": "#/$defs/MoveTicket"
      }
    }
  },
  "MoveKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "ExportQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "index"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "index": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "StageMoveRow": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "index",
      "records"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "index": {
        "$ref": "#/$defs/u16"
      },
      "records": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/RecordValue"
        }
      }
    }
  },
  "ConfirmMoveProgress": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "staged_count"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "staged_count": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "MoveCooldownQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "initiator"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "initiator": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "MoveCooldowns": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root_cancelled_at",
      "initiator_cancelled_at"
    ],
    "properties": {
      "root_cancelled_at": {
        "$ref": "#/$defs/Option<Height>"
      },
      "initiator_cancelled_at": {
        "$ref": "#/$defs/Option<Height>"
      }
    }
  },
  "ImportStatus": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ticket",
      "staged",
      "staged_count",
      "staged_primaries",
      "last_progress_at",
      "ready",
      "prepared_counters",
      "reserved_bytes",
      "activated",
      "cancelled"
    ],
    "properties": {
      "ticket": {
        "$ref": "#/$defs/MoveTicket"
      },
      "staged": {
        "$ref": "#/$defs/[u8;33]"
      },
      "staged_count": {
        "$ref": "#/$defs/u16"
      },
      "staged_primaries": {
        "$ref": "#/$defs/u16"
      },
      "last_progress_at": {
        "$ref": "#/$defs/Height"
      },
      "ready": {
        "$ref": "#/$defs/bool"
      },
      "prepared_counters": {
        "$ref": "#/$defs/RootCounters"
      },
      "reserved_bytes": {
        "$ref": "#/$defs/u64"
      },
      "activated": {
        "$ref": "#/$defs/bool"
      },
      "cancelled": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "[u8;33]": {
    "type": "array",
    "minItems": 33,
    "maxItems": 33,
    "items": {
      "$ref": "#/$defs/u8"
    }
  },
  "MoveStatus": {
    "oneOf": [
      {
        "type": "object",
        "required": [
          "Preparing"
        ],
        "additionalProperties": false,
        "properties": {
          "Preparing": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "ticket",
              "staged_count",
              "last_progress_at",
              "lifecycle_deadline",
              "lock_ends_at",
              "stale",
              "idle"
            ],
            "properties": {
              "ticket": {
                "$ref": "#/$defs/MoveTicket"
              },
              "staged_count": {
                "$ref": "#/$defs/u16"
              },
              "last_progress_at": {
                "$ref": "#/$defs/Height"
              },
              "lifecycle_deadline": {
                "$ref": "#/$defs/Height"
              },
              "lock_ends_at": {
                "$ref": "#/$defs/Height"
              },
              "stale": {
                "$ref": "#/$defs/bool"
              },
              "idle": {
                "$ref": "#/$defs/bool"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Finalizing"
        ],
        "additionalProperties": false,
        "properties": {
          "Finalizing": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "ticket",
              "live"
            ],
            "properties": {
              "ticket": {
                "$ref": "#/$defs/MoveTicket"
              },
              "live": {
                "$ref": "#/$defs/MoveLiveState"
              }
            }
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "PruneImport": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "limit"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "limit": {
        "$ref": "#/$defs/u8"
      }
    }
  },
  "PruneForwarded": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "limit"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "limit": {
        "$ref": "#/$defs/u8"
      }
    }
  },
  "DirectorySetRegistrationPauseArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "paused"
    ],
    "properties": {
      "paused": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "DirectorySetPolicySuspensionArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "suspended"
    ],
    "properties": {
      "suspended": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "DirectoryPruneProposalsArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ids"
    ],
    "properties": {
      "ids": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/ProposalId"
        }
      }
    }
  },
  "DirectoryRolesReturn": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "operator",
      "guardian",
      "operator_epoch",
      "guardian_epoch"
    ],
    "properties": {
      "operator": {
        "$ref": "#/$defs/OperatorPair"
      },
      "guardian": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "operator_epoch": {
        "$ref": "#/$defs/u64"
      },
      "guardian_epoch": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "DirectoryAllocationReturn": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "newest_store",
      "newest_resolver"
    ],
    "properties": {
      "version": {
        "$ref": "#/$defs/u64"
      },
      "newest_store": {
        "$ref": "#/$defs/Contract"
      },
      "newest_resolver": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "DirectoryMarketArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "StorePruneCommitmentsArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "keys"
    ],
    "properties": {
      "keys": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/CommitmentKey"
        }
      }
    }
  },
  "StoreRemoveSubnameArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      }
    }
  },
  "StorePruneSubnameArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      }
    }
  },
  "StoreHomeArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      }
    }
  },
  "StoreReadPrimaryArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "endpoint"
    ],
    "properties": {
      "endpoint": {
        "$ref": "#/$defs/Endpoint"
      }
    }
  },
  "StoreResolvePrimaryArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "endpoint"
    ],
    "properties": {
      "endpoint": {
        "$ref": "#/$defs/Endpoint"
      }
    }
  },
  "StoreQuoteRenewalArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "years"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "years": {
        "$ref": "#/$defs/u8"
      }
    }
  },
  "ResolverClearSlotArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "node",
      "epoch"
    ],
    "properties": {
      "node": {
        "$ref": "#/$defs/Node"
      },
      "epoch": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "ResolverPruneStaleArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slot"
    ],
    "properties": {
      "slot": {
        "$ref": "#/$defs/SlotKey"
      }
    }
  },
  "ResolverReadRecordSlotArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slot"
    ],
    "properties": {
      "slot": {
        "$ref": "#/$defs/SlotKey"
      }
    }
  },
  "VaultReadReferralArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beneficiary"
    ],
    "properties": {
      "beneficiary": {
        "$ref": "#/$defs/TypedPrincipal"
      }
    }
  },
  "VaultSourceArgs": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "OperationBegin": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "op_seq",
      "height",
      "call_path"
    ],
    "properties": {
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "height": {
        "$ref": "#/$defs/Height"
      },
      "call_path": {
        "type": "array",
        "maxItems": 48,
        "items": {
          "$ref": "#/$defs/Contract"
        }
      }
    }
  },
  "OperationEnd": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "op_seq",
      "call_path"
    ],
    "properties": {
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "call_path": {
        "type": "array",
        "maxItems": 48,
        "items": {
          "$ref": "#/$defs/Contract"
        }
      }
    }
  },
  "DirectoryInitialized": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "args",
      "config"
    ],
    "properties": {
      "args": {
        "$ref": "#/$defs/InitDirectory"
      },
      "config": {
        "$ref": "#/$defs/DirectoryConfig"
      }
    }
  },
  "StoreInitialized": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "args"
    ],
    "properties": {
      "args": {
        "$ref": "#/$defs/InitStore"
      }
    }
  },
  "ResolverInitialized": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "args"
    ],
    "properties": {
      "args": {
        "$ref": "#/$defs/InitResolver"
      }
    }
  },
  "VaultInitialized": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "args"
    ],
    "properties": {
      "args": {
        "$ref": "#/$defs/InitVault"
      }
    }
  },
  "PolicyInitialized": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "args"
    ],
    "properties": {
      "args": {
        "$ref": "#/$defs/InitPolicy"
      }
    }
  },
  "ProposalCreated": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "proposal"
    ],
    "properties": {
      "proposal": {
        "$ref": "#/$defs/Proposal"
      }
    }
  },
  "ProposalCancelled": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "actor"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "actor": {
        "$ref": "#/$defs/TypedPrincipal"
      }
    }
  },
  "ProposalExecuted": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "action_hash"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "action_hash": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "ProposalPruned": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "final_status"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "final_status": {
        "$ref": "#/$defs/ProposalStatus"
      }
    }
  },
  "ActionApplied": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "action",
      "config",
      "admission",
      "market"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "action": {
        "$ref": "#/$defs/Action"
      },
      "config": {
        "$ref": "#/$defs/DirectoryConfig"
      },
      "admission": {
        "$ref": "#/$defs/Option<Admission>"
      },
      "market": {
        "$ref": "#/$defs/Option<Market>"
      }
    }
  },
  "Option<Admission>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Admission"
      }
    ]
  },
  "OperatorChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "previous",
      "current",
      "operator_epoch",
      "recipient_version"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "previous": {
        "$ref": "#/$defs/OperatorPair"
      },
      "current": {
        "$ref": "#/$defs/OperatorPair"
      },
      "operator_epoch": {
        "$ref": "#/$defs/u64"
      },
      "recipient_version": {
        "type": "integer",
        "minimum": 0,
        "maximum": "18446744073709551615"
      }
    }
  },
  "GuardianChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "previous",
      "current",
      "guardian_epoch",
      "suspended"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/ProposalId"
      },
      "previous": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "current": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "guardian_epoch": {
        "$ref": "#/$defs/u64"
      },
      "suspended": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "ProposalsInvalidated": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "previous_operator_epoch",
      "operator_epoch"
    ],
    "properties": {
      "previous_operator_epoch": {
        "$ref": "#/$defs/u64"
      },
      "operator_epoch": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "RegistrationPauseChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "paused",
      "revision",
      "actor"
    ],
    "properties": {
      "paused": {
        "$ref": "#/$defs/bool"
      },
      "revision": {
        "$ref": "#/$defs/u64"
      },
      "actor": {
        "$ref": "#/$defs/TypedPrincipal"
      }
    }
  },
  "PolicySuspensionChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "suspended",
      "revision",
      "actor"
    ],
    "properties": {
      "suspended": {
        "$ref": "#/$defs/bool"
      },
      "revision": {
        "$ref": "#/$defs/u64"
      },
      "actor": {
        "$ref": "#/$defs/TypedPrincipal"
      }
    }
  },
  "DelaysChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "proposal_delay",
      "guardian_delay",
      "revision"
    ],
    "properties": {
      "proposal_delay": {
        "$ref": "#/$defs/u64"
      },
      "guardian_delay": {
        "$ref": "#/$defs/u64"
      },
      "revision": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "CommitmentCreated": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "commitment"
    ],
    "properties": {
      "commitment": {
        "$ref": "#/$defs/Commitment"
      }
    }
  },
  "CommitmentRemovedReason": {
    "oneOf": [
      {
        "const": "Expired"
      },
      {
        "const": "Consumed"
      }
    ]
  },
  "CommitmentRemoved": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "commitment",
      "reason",
      "destination"
    ],
    "properties": {
      "commitment": {
        "$ref": "#/$defs/Commitment"
      },
      "reason": {
        "$ref": "#/$defs/CommitmentRemovedReason"
      },
      "destination": {
        "$ref": "#/$defs/Option<Contract>"
      }
    }
  },
  "RootRegisteredReason": {
    "oneOf": [
      {
        "const": "Paid"
      },
      {
        "const": "Free"
      },
      {
        "const": "Reserved"
      }
    ]
  },
  "RootRegistered": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "previous_generation",
      "reason",
      "payer",
      "fee_lux",
      "premium_lux",
      "referral_lux",
      "policy",
      "policy_version",
      "policy_config_version"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/Name"
      },
      "previous_generation": {
        "$ref": "#/$defs/u64"
      },
      "reason": {
        "$ref": "#/$defs/RootRegisteredReason"
      },
      "payer": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "fee_lux": {
        "$ref": "#/$defs/Lux"
      },
      "premium_lux": {
        "$ref": "#/$defs/Lux"
      },
      "referral_lux": {
        "$ref": "#/$defs/Lux"
      },
      "policy": {
        "$ref": "#/$defs/Contract"
      },
      "policy_version": {
        "$ref": "#/$defs/u64"
      },
      "policy_config_version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "RootRenewed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "old_expiry",
      "expires_at",
      "old_grace_end",
      "grace_end",
      "inheritance_rule",
      "years",
      "payer",
      "fee_lux",
      "referral_lux",
      "schedule_version"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/NameRef"
      },
      "old_expiry": {
        "$ref": "#/$defs/Height"
      },
      "expires_at": {
        "$ref": "#/$defs/Height"
      },
      "old_grace_end": {
        "$ref": "#/$defs/Height"
      },
      "grace_end": {
        "$ref": "#/$defs/Height"
      },
      "inheritance_rule": {
        "$ref": "#/$defs/u8"
      },
      "years": {
        "$ref": "#/$defs/u8"
      },
      "payer": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "fee_lux": {
        "$ref": "#/$defs/Lux"
      },
      "referral_lux": {
        "$ref": "#/$defs/Lux"
      },
      "schedule_version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "SubnameCreated": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "actor"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/Name"
      },
      "actor": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "SubtreeRemovedReason": {
    "oneOf": [
      {
        "const": "Removed"
      },
      {
        "const": "Pruned"
      },
      {
        "const": "Recreated"
      },
      {
        "const": "Reregistered"
      }
    ]
  },
  "SubtreeRemoved": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "target",
      "include_target",
      "removed_count",
      "reason",
      "actor"
    ],
    "properties": {
      "target": {
        "$ref": "#/$defs/NameRef"
      },
      "include_target": {
        "$ref": "#/$defs/bool"
      },
      "removed_count": {
        "$ref": "#/$defs/u16"
      },
      "reason": {
        "$ref": "#/$defs/SubtreeRemovedReason"
      },
      "actor": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "AuthoritiesChangedReason": {
    "oneOf": [
      {
        "const": "Holder"
      },
      {
        "const": "Ancestor"
      },
      {
        "const": "TakeBack"
      },
      {
        "const": "CustodyStart"
      },
      {
        "const": "CustodyReturn"
      },
      {
        "const": "CustodySale"
      }
    ]
  },
  "AuthoritiesChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "previous_owner",
      "previous_manager",
      "actor",
      "reason",
      "data_cleared"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/Name"
      },
      "previous_owner": {
        "$ref": "#/$defs/Authority"
      },
      "previous_manager": {
        "$ref": "#/$defs/Authority"
      },
      "actor": {
        "$ref": "#/$defs/Authority"
      },
      "reason": {
        "$ref": "#/$defs/AuthoritiesChangedReason"
      },
      "data_cleared": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "IdentityClearedReason": {
    "oneOf": [
      {
        "const": "Holder"
      },
      {
        "const": "Ancestor"
      },
      {
        "const": "TakeBack"
      },
      {
        "const": "Reregistered"
      },
      {
        "const": "CustodySale"
      }
    ]
  },
  "IdentityCleared": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "old_slot",
      "old_primary",
      "reason"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "old_slot": {
        "$ref": "#/$defs/Option<SlotPointer>"
      },
      "old_primary": {
        "$ref": "#/$defs/Option<Primary>"
      },
      "reason": {
        "$ref": "#/$defs/IdentityClearedReason"
      }
    }
  },
  "SlotChangedReason": {
    "oneOf": [
      {
        "const": "Initial"
      },
      {
        "const": "Mutation"
      },
      {
        "const": "Replacement"
      },
      {
        "const": "Move"
      }
    ]
  },
  "SlotChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "previous",
      "current",
      "reason"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "previous": {
        "$ref": "#/$defs/Option<SlotPointer>"
      },
      "current": {
        "$ref": "#/$defs/Option<SlotPointer>"
      },
      "reason": {
        "$ref": "#/$defs/SlotChangedReason"
      }
    }
  },
  "PrimaryChangedReason": {
    "oneOf": [
      {
        "const": "Set"
      },
      {
        "const": "Clear"
      },
      {
        "const": "IdentityClear"
      }
    ]
  },
  "PrimaryChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "endpoint",
      "previous",
      "current",
      "reason"
    ],
    "properties": {
      "endpoint": {
        "$ref": "#/$defs/Endpoint"
      },
      "previous": {
        "$ref": "#/$defs/Option<Primary>"
      },
      "current": {
        "$ref": "#/$defs/Option<Primary>"
      },
      "reason": {
        "$ref": "#/$defs/PrimaryChangedReason"
      }
    }
  },
  "CustodyStarted": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "custody",
      "callback_data_hash"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "custody": {
        "$ref": "#/$defs/Custody"
      },
      "callback_data_hash": {
        "$ref": "#/$defs/Digest"
      }
    }
  },
  "CustodyEndedReason": {
    "oneOf": [
      {
        "const": "Returned"
      },
      {
        "const": "Sold"
      },
      {
        "const": "Revoked"
      }
    ]
  },
  "CustodyEnded": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "name",
      "nonce",
      "reason"
    ],
    "properties": {
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      },
      "reason": {
        "$ref": "#/$defs/CustodyEndedReason"
      }
    }
  },
  "RootCountersChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "counters"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "counters": {
        "$ref": "#/$defs/RootCounters"
      }
    }
  },
  "StoreWatermarksChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "next_slot_epoch",
      "next_mapping_id",
      "next_move_sequence"
    ],
    "properties": {
      "next_slot_epoch": {
        "$ref": "#/$defs/u64"
      },
      "next_mapping_id": {
        "$ref": "#/$defs/u64"
      },
      "next_move_sequence": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "ResolverSlotWritten": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slot",
      "snapshot"
    ],
    "properties": {
      "slot": {
        "$ref": "#/$defs/SlotKey"
      },
      "snapshot": {
        "$ref": "#/$defs/SlotSnapshot"
      }
    }
  },
  "ResolverSlotPrunedReason": {
    "oneOf": [
      {
        "const": "OwnerClear"
      },
      {
        "const": "Stale"
      }
    ]
  },
  "ResolverSlotPruned": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "slot",
      "reason"
    ],
    "properties": {
      "slot": {
        "$ref": "#/$defs/SlotKey"
      },
      "reason": {
        "$ref": "#/$defs/ResolverSlotPrunedReason"
      }
    }
  },
  "FeeSourceChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "source",
      "source_version"
    ],
    "properties": {
      "source": {
        "$ref": "#/$defs/FeeSource"
      },
      "source_version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "BeneficiaryReserved": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beneficiary",
      "reserved_beneficiaries"
    ],
    "properties": {
      "beneficiary": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "reserved_beneficiaries": {
        "$ref": "#/$defs/u32"
      }
    }
  },
  "BeneficiaryReleased": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beneficiary",
      "reserved_beneficiaries"
    ],
    "properties": {
      "beneficiary": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "reserved_beneficiaries": {
        "$ref": "#/$defs/u32"
      }
    }
  },
  "FeeReceived": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "source",
      "metadata",
      "received_lux",
      "protocol_lux",
      "liability_lux",
      "beneficiary_claimable_lux"
    ],
    "properties": {
      "source": {
        "$ref": "#/$defs/Contract"
      },
      "metadata": {
        "$ref": "#/$defs/FeeMetadata"
      },
      "received_lux": {
        "$ref": "#/$defs/Lux"
      },
      "protocol_lux": {
        "$ref": "#/$defs/Lux"
      },
      "liability_lux": {
        "$ref": "#/$defs/Lux"
      },
      "beneficiary_claimable_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "ReferralClaimed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beneficiary",
      "recipient",
      "amount_lux",
      "remaining_lux",
      "liability_lux"
    ],
    "properties": {
      "beneficiary": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "recipient": {
        "$ref": "#/$defs/Endpoint"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      },
      "remaining_lux": {
        "$ref": "#/$defs/Lux"
      },
      "liability_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "ProtocolClaimed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "operator",
      "operator_epoch",
      "recipient",
      "amount_lux",
      "remaining_lux"
    ],
    "properties": {
      "operator": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "operator_epoch": {
        "$ref": "#/$defs/u64"
      },
      "recipient": {
        "$ref": "#/$defs/Endpoint"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      },
      "remaining_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "MoveStarted": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ticket",
      "lifecycle_deadline"
    ],
    "properties": {
      "ticket": {
        "$ref": "#/$defs/MoveTicket"
      },
      "lifecycle_deadline": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "MoveProgressed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "staged_count",
      "last_progress_at"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "staged_count": {
        "$ref": "#/$defs/u16"
      },
      "last_progress_at": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "ImportPrepared": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "status"
    ],
    "properties": {
      "status": {
        "$ref": "#/$defs/ImportStatus"
      }
    }
  },
  "ImportRowStaged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "index",
      "original",
      "imported",
      "imported_primary"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "index": {
        "$ref": "#/$defs/u16"
      },
      "original": {
        "$ref": "#/$defs/ExportRow"
      },
      "imported": {
        "$ref": "#/$defs/Name"
      },
      "imported_primary": {
        "$ref": "#/$defs/Option<Primary>"
      }
    }
  },
  "ImportReady": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "manifest",
      "row_count",
      "primary_count",
      "counters"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "manifest": {
        "$ref": "#/$defs/Digest"
      },
      "row_count": {
        "$ref": "#/$defs/u16"
      },
      "primary_count": {
        "$ref": "#/$defs/u16"
      },
      "counters": {
        "$ref": "#/$defs/RootCounters"
      }
    }
  },
  "RootImported": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ticket",
      "counters",
      "live"
    ],
    "properties": {
      "ticket": {
        "$ref": "#/$defs/MoveTicket"
      },
      "counters": {
        "$ref": "#/$defs/RootCounters"
      },
      "live": {
        "$ref": "#/$defs/MoveLiveState"
      }
    }
  },
  "RootForwarded": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ticket",
      "forward"
    ],
    "properties": {
      "ticket": {
        "$ref": "#/$defs/MoveTicket"
      },
      "forward": {
        "$ref": "#/$defs/Forward"
      }
    }
  },
  "MoveCancelledReason": {
    "oneOf": [
      {
        "const": "Owner"
      },
      {
        "const": "Idle"
      },
      {
        "const": "Expired"
      },
      {
        "const": "LifecycleEnded"
      }
    ]
  },
  "MoveCancelled": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "ticket",
      "reason",
      "cancelled_at",
      "cooldown_applied"
    ],
    "properties": {
      "ticket": {
        "$ref": "#/$defs/MoveTicket"
      },
      "reason": {
        "$ref": "#/$defs/MoveCancelledReason"
      },
      "cancelled_at": {
        "$ref": "#/$defs/Height"
      },
      "cooldown_applied": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "ImportRowsPruned": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "indices",
      "remaining",
      "cancelled"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/Digest"
      },
      "indices": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/u16"
        }
      },
      "remaining": {
        "$ref": "#/$defs/u16"
      },
      "cancelled": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "ForwardedRowsPruned": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "move_id",
      "names",
      "remaining"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "move_id": {
        "$ref": "#/$defs/Digest"
      },
      "names": {
        "type": "array",
        "maxItems": 16,
        "items": {
          "$ref": "#/$defs/NameRef"
        }
      },
      "remaining": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "ErrorCode": {
    "oneOf": [
      {
        "const": "InvalidWire"
      },
      {
        "const": "InvalidArgument"
      },
      {
        "const": "Unauthorized"
      },
      {
        "const": "PolicyBusy"
      },
      {
        "const": "Moved"
      },
      {
        "const": "NotFound"
      },
      {
        "const": "Stale"
      },
      {
        "const": "Overflow"
      },
      {
        "const": "Capacity"
      },
      {
        "const": "Closed"
      },
      {
        "const": "PolicyUnavailable"
      },
      {
        "const": "QuoteChanged"
      },
      {
        "const": "FeeMismatch"
      },
      {
        "const": "DepositFailed"
      },
      {
        "const": "PaymentFailed"
      },
      {
        "const": "Expired"
      },
      {
        "const": "NotAvailable"
      },
      {
        "const": "WrongHome"
      },
      {
        "const": "CommitmentMissing"
      },
      {
        "const": "CommitmentAge"
      },
      {
        "const": "CommitmentMismatch"
      },
      {
        "const": "CommitmentLimit"
      },
      {
        "const": "AlreadyExists"
      },
      {
        "const": "PrimaryAlreadySet"
      },
      {
        "const": "ForwardMismatch"
      },
      {
        "const": "CustodyActive"
      },
      {
        "const": "CustodyMismatch"
      },
      {
        "const": "CallbackFailed"
      },
      {
        "const": "MovePending"
      },
      {
        "const": "MoveStale"
      },
      {
        "const": "MoveIncomplete"
      },
      {
        "const": "MoveCooldown"
      },
      {
        "const": "NotReady"
      },
      {
        "const": "ProposalExpired"
      },
      {
        "const": "Conflict"
      },
      {
        "const": "AcceptanceRequired"
      },
      {
        "const": "ReferralCapacity"
      },
      {
        "const": "InsufficientBalance"
      },
      {
        "const": "ExternalReadFailed"
      },
      {
        "const": "GasBudget"
      },
      {
        "const": "Busy"
      }
    ]
  },
  "()": {
    "type": "null"
  },
  "Option<Proposal>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Proposal"
      }
    ]
  },
  "ReceiveFromContract": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "contract",
      "value",
      "data"
    ],
    "properties": {
      "contract": {
        "type": "string",
        "pattern": "^[0-9a-f]{64}$"
      },
      "value": {
        "$ref": "#/$defs/Lux"
      },
      "data": {
        "type": "string",
        "pattern": "^([0-9a-f]{2})*$",
        "maxLength": 24576
      }
    }
  },
  "Located<NameView>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/NameView"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Located<Children>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/Children"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Located<Option<SlotPointer>>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/Option<SlotPointer>"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Located<Option<RecordValue>>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/Option<RecordValue>"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Option<RecordValue>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/RecordValue"
      }
    ]
  },
  "Located<RecordsView>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/RecordsView"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Option<PrimaryView>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/PrimaryView"
      }
    ]
  },
  "Option<Commitment>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Commitment"
      }
    ]
  },
  "Located<RenewalQuote>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/RenewalQuote"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Option<MoveStatus>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/MoveStatus"
      }
    ]
  },
  "Option<ImportStatus>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/ImportStatus"
      }
    ]
  },
  "Located<MoveCooldowns>": {
    "oneOf": [
      {
        "const": "Absent"
      },
      {
        "type": "object",
        "required": [
          "Local"
        ],
        "additionalProperties": false,
        "properties": {
          "Local": {
            "$ref": "#/$defs/MoveCooldowns"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "Forwarded"
        ],
        "additionalProperties": false,
        "properties": {
          "Forwarded": {
            "$ref": "#/$defs/Forward"
          }
        }
      }
    ]
  },
  "Option<SlotSnapshot>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/SlotSnapshot"
      }
    ]
  },
  "Option<ReferralRow>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/ReferralRow"
      }
    ]
  },
  "Option<FeeSource>": {
    "anyOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/FeeSource"
      }
    ]
  },
  "Event<DirectoryInitialized>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/DirectoryInitialized"
      }
    }
  },
  "Event<StoreInitialized>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/StoreInitialized"
      }
    }
  },
  "Event<ResolverInitialized>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ResolverInitialized"
      }
    }
  },
  "Event<VaultInitialized>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/VaultInitialized"
      }
    }
  },
  "Event<PolicyInitialized>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/PolicyInitialized"
      }
    }
  },
  "Event<ProposalCreated>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ProposalCreated"
      }
    }
  },
  "Event<ProposalCancelled>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ProposalCancelled"
      }
    }
  },
  "Event<ProposalExecuted>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ProposalExecuted"
      }
    }
  },
  "Event<ProposalPruned>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ProposalPruned"
      }
    }
  },
  "Event<ActionApplied>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ActionApplied"
      }
    }
  },
  "Event<OperatorChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/OperatorChanged"
      }
    }
  },
  "Event<GuardianChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/GuardianChanged"
      }
    }
  },
  "Event<ProposalsInvalidated>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ProposalsInvalidated"
      }
    }
  },
  "Event<RegistrationPauseChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RegistrationPauseChanged"
      }
    }
  },
  "Event<PolicySuspensionChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/PolicySuspensionChanged"
      }
    }
  },
  "Event<DelaysChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/DelaysChanged"
      }
    }
  },
  "Event<CommitmentCreated>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/CommitmentCreated"
      }
    }
  },
  "Event<CommitmentRemoved>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/CommitmentRemoved"
      }
    }
  },
  "Event<RootRegistered>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RootRegistered"
      }
    }
  },
  "Event<RootRenewed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RootRenewed"
      }
    }
  },
  "Event<SubnameCreated>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/SubnameCreated"
      }
    }
  },
  "Event<SubtreeRemoved>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/SubtreeRemoved"
      }
    }
  },
  "Event<AuthoritiesChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/AuthoritiesChanged"
      }
    }
  },
  "Event<IdentityCleared>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/IdentityCleared"
      }
    }
  },
  "Event<SlotChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/SlotChanged"
      }
    }
  },
  "Event<PrimaryChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/PrimaryChanged"
      }
    }
  },
  "Event<CustodyStarted>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/CustodyStarted"
      }
    }
  },
  "Event<CustodyEnded>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/CustodyEnded"
      }
    }
  },
  "Event<RootCountersChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RootCountersChanged"
      }
    }
  },
  "Event<StoreWatermarksChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/StoreWatermarksChanged"
      }
    }
  },
  "Event<ResolverSlotWritten>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ResolverSlotWritten"
      }
    }
  },
  "Event<ResolverSlotPruned>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ResolverSlotPruned"
      }
    }
  },
  "Event<FeeSourceChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/FeeSourceChanged"
      }
    }
  },
  "Event<BeneficiaryReserved>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/BeneficiaryReserved"
      }
    }
  },
  "Event<BeneficiaryReleased>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/BeneficiaryReleased"
      }
    }
  },
  "Event<FeeReceived>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/FeeReceived"
      }
    }
  },
  "Event<ReferralClaimed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ReferralClaimed"
      }
    }
  },
  "Event<ProtocolClaimed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ProtocolClaimed"
      }
    }
  },
  "Event<MoveStarted>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/MoveStarted"
      }
    }
  },
  "Event<MoveProgressed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/MoveProgressed"
      }
    }
  },
  "Event<ImportPrepared>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ImportPrepared"
      }
    }
  },
  "Event<ImportRowStaged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ImportRowStaged"
      }
    }
  },
  "Event<ImportReady>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ImportReady"
      }
    }
  },
  "Event<RootImported>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RootImported"
      }
    }
  },
  "Event<RootForwarded>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RootForwarded"
      }
    }
  },
  "Event<MoveCancelled>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/MoveCancelled"
      }
    }
  },
  "Event<ImportRowsPruned>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ImportRowsPruned"
      }
    }
  },
  "Event<ForwardedRowsPruned>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ForwardedRowsPruned"
      }
    }
  },
  "InitMarketplace": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      }
    }
  },
  "SetPause": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "paused"
    ],
    "properties": {
      "paused": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "SetFee": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "expected_fee_bps",
      "fee_bps"
    ],
    "properties": {
      "expected_fee_bps": {
        "$ref": "#/$defs/u16"
      },
      "fee_bps": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Referral": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "beneficiary",
      "bps"
    ],
    "properties": {
      "beneficiary": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "bps": {
        "$ref": "#/$defs/u16"
      }
    }
  },
  "Terms": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "directory",
      "store",
      "name",
      "id",
      "kind",
      "amount_lux",
      "fee_bps",
      "seller",
      "seller_manager",
      "seller_recipient",
      "buyer",
      "buyer_manager",
      "deadline",
      "duration_blocks",
      "referral"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "directory": {
        "$ref": "#/$defs/Contract"
      },
      "store": {
        "$ref": "#/$defs/Contract"
      },
      "name": {
        "$ref": "#/$defs/NameRef"
      },
      "id": {
        "$ref": "#/$defs/u64"
      },
      "kind": {
        "$ref": "#/$defs/OrderKind"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      },
      "fee_bps": {
        "$ref": "#/$defs/u16"
      },
      "seller": {
        "$ref": "#/$defs/Authority"
      },
      "seller_manager": {
        "$ref": "#/$defs/Authority"
      },
      "seller_recipient": {
        "$ref": "#/$defs/Endpoint"
      },
      "buyer": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Authority"
          }
        ]
      },
      "buyer_manager": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Authority"
          }
        ]
      },
      "deadline": {
        "$ref": "#/$defs/Height"
      },
      "duration_blocks": {
        "$ref": "#/$defs/Height"
      },
      "referral": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Referral"
          }
        ]
      }
    }
  },
  "Bid": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "payer",
      "manager",
      "amount_lux"
    ],
    "properties": {
      "payer": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "Order": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "terms",
      "nonce",
      "status",
      "payer",
      "highest",
      "started_at",
      "end",
      "maximum_end",
      "bid_count"
    ],
    "properties": {
      "terms": {
        "$ref": "#/$defs/Terms"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      },
      "status": {
        "$ref": "#/$defs/OrderStatus"
      },
      "payer": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/TypedPrincipal"
          }
        ]
      },
      "highest": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Bid"
          }
        ]
      },
      "started_at": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Height"
          }
        ]
      },
      "end": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Height"
          }
        ]
      },
      "maximum_end": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Height"
          }
        ]
      },
      "bid_count": {
        "$ref": "#/$defs/u32"
      }
    }
  },
  "CustodyIntent": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "terms",
      "nonce",
      "valid_until"
    ],
    "properties": {
      "terms": {
        "$ref": "#/$defs/Terms"
      },
      "nonce": {
        "$ref": "#/$defs/u64"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "PlaceOffer": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "terms",
      "valid_until"
    ],
    "properties": {
      "terms": {
        "$ref": "#/$defs/Terms"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Buy": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order",
      "manager",
      "valid_until"
    ],
    "properties": {
      "order": {
        "$ref": "#/$defs/Order"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "PlaceBid": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order",
      "amount_lux",
      "manager",
      "valid_until"
    ],
    "properties": {
      "order": {
        "$ref": "#/$defs/Order"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "valid_until": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "RenewOrder": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order",
      "renewal"
    ],
    "properties": {
      "order": {
        "$ref": "#/$defs/Order"
      },
      "renewal": {
        "$ref": "#/$defs/Renew"
      }
    }
  },
  "ClaimRefund": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "amount",
      "recipient"
    ],
    "properties": {
      "amount": {
        "$ref": "#/$defs/ClaimAmount"
      },
      "recipient": {
        "$ref": "#/$defs/Endpoint"
      }
    }
  },
  "OrderKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id"
    ],
    "properties": {
      "id": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "RefundKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "authority"
    ],
    "properties": {
      "authority": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "Refund": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "authority",
      "amount_lux"
    ],
    "properties": {
      "authority": {
        "$ref": "#/$defs/Authority"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "Config": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "binding",
      "fee_bps",
      "new_orders_disabled",
      "next_order_id",
      "unsettled_orders",
      "refund_accounts",
      "held_lux",
      "refundable_lux"
    ],
    "properties": {
      "binding": {
        "$ref": "#/$defs/Binding"
      },
      "fee_bps": {
        "$ref": "#/$defs/u16"
      },
      "new_orders_disabled": {
        "$ref": "#/$defs/bool"
      },
      "next_order_id": {
        "$ref": "#/$defs/u64"
      },
      "unsettled_orders": {
        "$ref": "#/$defs/u64"
      },
      "refund_accounts": {
        "$ref": "#/$defs/u64"
      },
      "held_lux": {
        "$ref": "#/$defs/Lux"
      },
      "refundable_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "MarketConfigured": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "config"
    ],
    "properties": {
      "config": {
        "$ref": "#/$defs/Config"
      }
    }
  },
  "OrderChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order"
    ],
    "properties": {
      "order": {
        "$ref": "#/$defs/Order"
      }
    }
  },
  "OrderClosed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order",
      "reason"
    ],
    "properties": {
      "order": {
        "$ref": "#/$defs/Order"
      },
      "reason": {
        "$ref": "#/$defs/CloseReason"
      }
    }
  },
  "TradeSettled": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order",
      "payer",
      "buyer",
      "manager",
      "gross_lux",
      "fee_lux",
      "referral_lux"
    ],
    "properties": {
      "order": {
        "$ref": "#/$defs/Order"
      },
      "payer": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "buyer": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      },
      "gross_lux": {
        "$ref": "#/$defs/Lux"
      },
      "fee_lux": {
        "$ref": "#/$defs/Lux"
      },
      "referral_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "RefundChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "refund"
    ],
    "properties": {
      "refund": {
        "$ref": "#/$defs/Refund"
      }
    }
  },
  "RefundClaimed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "authority",
      "recipient",
      "amount_lux"
    ],
    "properties": {
      "authority": {
        "$ref": "#/$defs/Authority"
      },
      "recipient": {
        "$ref": "#/$defs/Endpoint"
      },
      "amount_lux": {
        "$ref": "#/$defs/Lux"
      }
    }
  },
  "EscrowRenewed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "order_id",
      "renewal",
      "payer"
    ],
    "properties": {
      "order_id": {
        "$ref": "#/$defs/u64"
      },
      "renewal": {
        "$ref": "#/$defs/Renew"
      },
      "payer": {
        "$ref": "#/$defs/TypedPrincipal"
      }
    }
  },
  "OrderKind": {
    "enum": [
      "Fixed",
      "Auction",
      "Offer"
    ]
  },
  "OrderStatus": {
    "enum": [
      "Open",
      "ReturnPending"
    ]
  },
  "CloseReason": {
    "enum": [
      "Cancelled",
      "Expired",
      "Returned",
      "LostCustody",
      "Sold"
    ]
  },
  "MarketPayment": {
    "oneOf": [
      {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "Buy"
        ],
        "properties": {
          "Buy": {
            "$ref": "#/$defs/Buy"
          }
        }
      },
      {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "Bid"
        ],
        "properties": {
          "Bid": {
            "$ref": "#/$defs/PlaceBid"
          }
        }
      },
      {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "Offer"
        ],
        "properties": {
          "Offer": {
            "$ref": "#/$defs/PlaceOffer"
          }
        }
      },
      {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "Renew"
        ],
        "properties": {
          "Renew": {
            "$ref": "#/$defs/RenewOrder"
          }
        }
      }
    ]
  },
  "Option<Order>": {
    "oneOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Order"
      }
    ]
  },
  "Event<MarketConfigured>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/MarketConfigured"
      }
    }
  },
  "Event<OrderChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/OrderChanged"
      }
    }
  },
  "Event<OrderClosed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/OrderClosed"
      }
    }
  },
  "Event<TradeSettled>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/TradeSettled"
      }
    }
  },
  "Event<RefundChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RefundChanged"
      }
    }
  },
  "Event<RefundClaimed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RefundClaimed"
      }
    }
  },
  "Event<EscrowRenewed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/EscrowRenewed"
      }
    }
  },
  "ListingKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "store",
      "root"
    ],
    "properties": {
      "store": {
        "$ref": "#/$defs/Contract"
      },
      "root": {
        "$ref": "#/$defs/Node"
      }
    }
  },
  "OfferKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "store",
      "root",
      "buyer"
    ],
    "properties": {
      "store": {
        "$ref": "#/$defs/Contract"
      },
      "root": {
        "$ref": "#/$defs/Node"
      },
      "buyer": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "DirectoryPayoutKey": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "account"
    ],
    "properties": {
      "account": {
        "type": "string",
        "description": "Base58 JSON encoding of the canonical compressed BLS public key; the frozen archive contains only its 96 canonical bytes."
      }
    }
  },
  "Controller": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "contract",
      "scopes",
      "admitted_at",
      "suspended"
    ],
    "properties": {
      "contract": {
        "$ref": "#/$defs/Contract"
      },
      "scopes": {
        "$ref": "#/$defs/u8"
      },
      "admitted_at": {
        "$ref": "#/$defs/Height"
      },
      "suspended": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "Controllers": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "rows"
    ],
    "properties": {
      "version": {
        "$ref": "#/$defs/u64"
      },
      "rows": {
        "$ref": "#/$defs/Vec<Controller>"
      }
    }
  },
  "ControllerQuery": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "contract"
    ],
    "properties": {
      "contract": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "ControllerSuspension": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "controller",
      "suspended"
    ],
    "properties": {
      "controller": {
        "$ref": "#/$defs/Contract"
      },
      "suspended": {
        "$ref": "#/$defs/bool"
      }
    }
  },
  "Delegated": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "principal",
      "op"
    ],
    "properties": {
      "principal": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "op": {
        "$ref": "#/$defs/DelegatedOp"
      }
    }
  },
  "RegisterFor": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "registration",
      "owner",
      "manager"
    ],
    "properties": {
      "registration": {
        "$ref": "#/$defs/Register"
      },
      "owner": {
        "$ref": "#/$defs/Authority"
      },
      "manager": {
        "$ref": "#/$defs/Authority"
      }
    }
  },
  "CedeReleased": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "root",
      "destination"
    ],
    "properties": {
      "root": {
        "$ref": "#/$defs/Node"
      },
      "destination": {
        "$ref": "#/$defs/Contract"
      }
    }
  },
  "ReleasedRoot": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "counters",
      "grace_end"
    ],
    "properties": {
      "counters": {
        "$ref": "#/$defs/RootCounters"
      },
      "grace_end": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "ControllerChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "controller",
      "listed",
      "version"
    ],
    "properties": {
      "controller": {
        "$ref": "#/$defs/Controller"
      },
      "listed": {
        "$ref": "#/$defs/bool"
      },
      "version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "ControllerSuspensionChanged": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "controller",
      "suspended",
      "actor",
      "version"
    ],
    "properties": {
      "controller": {
        "$ref": "#/$defs/Contract"
      },
      "suspended": {
        "$ref": "#/$defs/bool"
      },
      "actor": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "version": {
        "$ref": "#/$defs/u64"
      }
    }
  },
  "ControllerUsed": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "principal",
      "via",
      "scope"
    ],
    "properties": {
      "principal": {
        "$ref": "#/$defs/TypedPrincipal"
      },
      "via": {
        "$ref": "#/$defs/Contract"
      },
      "scope": {
        "$ref": "#/$defs/u8"
      }
    }
  },
  "RootCeded": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "forward",
      "counters",
      "grace_end"
    ],
    "properties": {
      "forward": {
        "$ref": "#/$defs/Forward"
      },
      "counters": {
        "$ref": "#/$defs/RootCounters"
      },
      "grace_end": {
        "$ref": "#/$defs/Height"
      }
    }
  },
  "Vec<Controller>": {
    "type": "array",
    "maxItems": 16,
    "items": {
      "$ref": "#/$defs/Controller"
    }
  },
  "Option<Controller>": {
    "oneOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/$defs/Controller"
      }
    ]
  },
  "Event<ControllerChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ControllerChanged"
      }
    }
  },
  "Event<ControllerSuspensionChanged>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ControllerSuspensionChanged"
      }
    }
  },
  "Event<ControllerUsed>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/ControllerUsed"
      }
    }
  },
  "Event<RootCeded>": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "version",
      "op_seq",
      "body"
    ],
    "properties": {
      "version": {
        "const": 1
      },
      "op_seq": {
        "$ref": "#/$defs/u64"
      },
      "body": {
        "$ref": "#/$defs/RootCeded"
      }
    }
  },
  "DelegatedOp": {
    "oneOf": [
      {
        "type": "object",
        "required": [
          "UpdateAuthorities"
        ],
        "additionalProperties": false,
        "properties": {
          "UpdateAuthorities": {
            "$ref": "#/$defs/Authorities"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "TransferAndCall"
        ],
        "additionalProperties": false,
        "properties": {
          "TransferAndCall": {
            "$ref": "#/$defs/TransferAndCall"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "CreateSubname"
        ],
        "additionalProperties": false,
        "properties": {
          "CreateSubname": {
            "$ref": "#/$defs/CreateSubname"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "ReassignSubname"
        ],
        "additionalProperties": false,
        "properties": {
          "ReassignSubname": {
            "$ref": "#/$defs/Authorities"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "RemoveSubname"
        ],
        "additionalProperties": false,
        "properties": {
          "RemoveSubname": {
            "$ref": "#/$defs/StoreRemoveSubnameArgs"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "PruneSubname"
        ],
        "additionalProperties": false,
        "properties": {
          "PruneSubname": {
            "$ref": "#/$defs/StorePruneSubnameArgs"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "TakeBackSubnames"
        ],
        "additionalProperties": false,
        "properties": {
          "TakeBackSubnames": {
            "$ref": "#/$defs/TakeBack"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "MutateRecords"
        ],
        "additionalProperties": false,
        "properties": {
          "MutateRecords": {
            "$ref": "#/$defs/MutateRecords"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "ReplaceRecords"
        ],
        "additionalProperties": false,
        "properties": {
          "ReplaceRecords": {
            "$ref": "#/$defs/ReplaceRecords"
          }
        }
      },
      {
        "type": "object",
        "required": [
          "MoveRecords"
        ],
        "additionalProperties": false,
        "properties": {
          "MoveRecords": {
            "$ref": "#/$defs/MoveRecords"
          }
        }
      }
    ]
  }
}
