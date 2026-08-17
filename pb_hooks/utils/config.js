// ─────────────────────────────────────────────────────────────
// utils/config.js — Per-collection hook configuration
//
// Handlers are serialized before they run, so they cannot close
// over anything declared outside their own body. Any table a hook
// needs is looked up here by e.collection.name instead.
// ─────────────────────────────────────────────────────────────

// Sequential code prefixes, keyed by collection.
var CODE_PREFIXES = {
  donations: { prefix: "DON-", error: "Error generando código de donación" },
  requests: { prefix: "SOL-", error: "Error generando código de solicitud" },
  dispatches: { prefix: "DES-", error: "Error generando código de despacho" },
};

// Fields written to audit_log, keyed by collection. A collection
// absent from this table is not audited.
var AUDIT_FIELDS = {
  donations: [
    "code",
    "donor_type",
    "donor_name",
    "donor_phone",
    "donor_email",
    "donor_rfc",
    "notes",
    "operator_id",
  ],
  donation_items: [
    "product_id",
    "quantity",
    "classification_status",
    "location_id",
    "unit_id",
    "rejection_reason",
  ],
  requests: [
    "code",
    "status",
    "priority",
    "destination",
    "requester_name",
    "requester_phone",
    "requester_institution",
    "approved_by",
    "rejection_reason",
  ],
  request_items: [
    "product_id",
    "unit_id",
    "quantity_requested",
    "quantity_fulfilled",
    "status",
  ],
  reservations: [
    "request_item_id",
    "inventory_id",
    "quantity_reserved",
    "status",
  ],
  dispatches: [
    "code",
    "driver_name",
    "driver_phone",
    "vehicle_plate",
    "destination",
    "dispatch_date",
    "brigade",
  ],
  deliveries: [
    "dispatch_id",
    "receiver_name",
    "receiver_phone",
    "status",
    "delivery_date",
  ],
  users: ["full_name", "role", "phone", "active"],
};

var AUDITED_COLLECTIONS = Object.keys(AUDIT_FIELDS);

module.exports = {
  CODE_PREFIXES: CODE_PREFIXES,
  AUDIT_FIELDS: AUDIT_FIELDS,
  AUDITED_COLLECTIONS: AUDITED_COLLECTIONS,
};
