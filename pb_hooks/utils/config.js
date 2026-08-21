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
    "donor_id_type",
    "donor_id_number",
    "notes",
    "operator_id",
    "status",
    "total_weight_kg",
    "classified_weight_kg",
    "carrier_name",
    "classification_closed_by",
  ],
  donation_items: [
    "product_id",
    "quantity",
    "classification_status",
    "location_id",
    "unit_id",
    "rejection_reason",
    "size",
    "units_per_package",
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
  kits: ["name", "description", "active"],
  kit_items: ["kit_id", "product_id", "unit_id", "quantity"],
  // Un ajuste no tiene un `onRecordUpdateRequest` propio que lo
  // necesite (03_inventory.pb.js ya escribe su propio movimiento), pero
  // sí se agrega aquí para que su creación quede en Historial igual que
  // el resto — es una corrección justificada, la misma clase de evento.
  adjustments: [
    "inventory_id",
    "product_id",
    "location_id",
    "quantity_before",
    "quantity_after",
    "difference",
    "reason",
  ],
};

var AUDITED_COLLECTIONS = Object.keys(AUDIT_FIELDS);

// Campos que un operador NO puede tocar en `groups`/`categories`/
// `products` — usados por 06_catalog_photo_guard.pb.js. Cualquier
// campo fuera de esta lista (hoy solo `photo_url`) queda libre para
// cualquier activo.
var CATALOG_GUARDED_FIELDS = {
  groups: ["name", "description", "active"],
  categories: ["name", "group_id", "description", "default_unit_id", "active"],
  products: [
    "name",
    "category_id",
    "default_unit_id",
    "description",
    "min_stock_alert",
    "requires_expiry",
    "requires_batch",
    "requires_quarantine",
    "active",
  ],
  locations: ["zone", "shelf", "position", "description", "capacity_m3", "is_cold_chain", "active"],
};

// ─────────────────────────────────────────────────────────────
// EDITABLE_RECORDS — qué puede tocar 11_edit_delete_with_reason.pb.js
// (editar/eliminar con motivo obligatorio, solo admin/coordinación).
//
// `fields`: lista blanca de campos que esa ruta puede cambiar. Nunca
// incluye nada que ya gobierne un flujo de negocio (status,
// classification_status, cantidades que ya afectaron inventario,
// aprobación/rechazo...) — esos siguen viviendo exactamente donde ya
// estaban (clasificar, aprobar/rechazar/cancelar, confirmar entrega,
// un ajuste de inventario). Esta ruta es para lo que hoy no tiene
// ningún camino: corregir un dato mal tecleado, con motivo y rastro.
//
// `mode`:
//   - "delete"     — borra el registro de verdad, después de pasar
//                    dependencies.js (checkDeletable). Usado en las
//                    seis colecciones transaccionales.
//   - "deactivate" — nunca borra: pone `active: false`. Mismo
//                    principio que ya rige TODO el catálogo desde el
//                    primer día ("nada se borra, se desactiva") — acá
//                    solo se le agrega motivo obligatorio y rastro en
//                    Historial a algo que hasta hoy era un interruptor
//                    silencioso.
var EDITABLE_RECORDS = {
  donations: {
    mode: "delete",
    fields: [
      "donor_type", "donor_name", "donor_phone", "donor_email",
      "donor_id_type", "donor_id_number", "notes", "carrier_name",
      "total_weight_kg", "receipt_date",
    ],
  },
  donation_items: {
    mode: "delete",
    // Solo tocable de verdad cuando classification_status es "pending"
    // o "rejected" — dependencies.js ya lo bloquea igual que borrar,
    // por la misma razón: "available"/"quarantine" ya afectaron
    // inventory, y esta ruta no dispara los hooks de 03_inventory.pb.js
    // (un app.save() dentro de una ruta no los activa).
    fields: [
      "product_id", "unit_id", "quantity", "location_id",
      "expiry_date", "batch_code", "notes", "size", "units_per_package",
    ],
  },
  requests: {
    mode: "delete",
    fields: [
      "requester_name", "requester_phone", "requester_institution",
      "destination", "street_type", "street_number", "street_plate",
      "address_complement", "destination_lat", "destination_lng",
      "priority", "notes", "beneficiary_count",
    ],
  },
  request_items: {
    mode: "delete",
    fields: ["product_id", "unit_id", "quantity_requested", "notes"],
  },
  dispatches: {
    mode: "delete",
    fields: [
      "vehicle_plate", "driver_name", "driver_phone", "brigade",
      "destination", "street_type", "street_number", "street_plate",
      "address_complement", "dispatch_date", "notes",
      "destination_lat", "destination_lng",
    ],
  },
  // Sin "delete" real posible (dependencies.js la bloquea siempre): una
  // entrega confirmada ya generó una salida real de inventario
  // (confirm-delivery). Borrarla sin revertir ese movimiento
  // desincronizaría el saldo del libro — se puede corregir el dato,
  // nunca borrar el hecho.
  deliveries: {
    mode: "delete",
    fields: ["receiver_name", "receiver_phone", "receiver_id_type", "receiver_id_number", "notes"],
  },
  products: {
    mode: "deactivate",
    fields: [
      "name", "category_id", "default_unit_id", "description",
      "min_stock_alert", "requires_batch", "requires_expiry",
      "requires_quarantine", "is_fragile", "is_hazardous",
    ],
  },
  categories: {
    mode: "deactivate",
    fields: ["name", "group_id", "description", "default_unit_id"],
  },
  groups: {
    mode: "deactivate",
    fields: ["name", "description"],
  },
  locations: {
    mode: "deactivate",
    fields: ["zone", "shelf", "position", "description", "capacity_m3", "is_cold_chain"],
  },
  kits: {
    mode: "deactivate",
    fields: ["name", "description"],
  },
};

module.exports = {
  CODE_PREFIXES: CODE_PREFIXES,
  AUDIT_FIELDS: AUDIT_FIELDS,
  AUDITED_COLLECTIONS: AUDITED_COLLECTIONS,
  CATALOG_GUARDED_FIELDS: CATALOG_GUARDED_FIELDS,
  EDITABLE_RECORDS: EDITABLE_RECORDS,
};
