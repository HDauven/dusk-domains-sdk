// Generated from the frozen v1 protocol schemas by scripts/generate-frozen.mjs.
export interface ReadMethods {
  directory: "config" | "registration_context" | "renewal_schedule" | "roles" | "member" | "members" | "allocation" | "market" | "proposal" | "proposals" | "interface_version" | "binding" | "capacity"
  policy: "config" | "quote" | "interface_version" | "binding"
  store: "home" | "stats" | "get_name" | "children" | "record_slot" | "read_record" | "read_records" | "resolve_record" | "read_primary" | "resolve_primary" | "pending_commitment" | "commitment_raw" | "quote_registration" | "quote_renewal" | "slot_liveness" | "export_move_row" | "move_status" | "import_status" | "move_cooldowns" | "interface_version" | "binding" | "capacity"
  resolver: "read_slot_record" | "read_record_slot" | "stats" | "interface_version" | "binding" | "capacity"
  vault: "read_state" | "read_referral" | "referrals" | "source" | "read_balance" | "interface_version" | "binding" | "capacity"
  marketplace: "interface_version" | "binding" | "capacity" | "config" | "wind_down_state" | "order_api_version" | "read_order" | "read_refund" | "read_listing" | "read_offer"
}
