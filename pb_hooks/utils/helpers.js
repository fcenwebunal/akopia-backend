// ─────────────────────────────────────────────────────────────
// utils/helpers.js — Shared utilities for Akopia hooks
//
// Not a hook file: PocketBase only auto-loads pb_hooks/**/*.pb.js.
// Handlers pull this in with require(`${__hooks}/utils/helpers.js`),
// which is the only way to share code — each handler is serialized
// and run in its own isolated context, so file-level scope is not
// visible from inside a hook.
//
// All identifiers and internal strings in English.
// User-visible error strings in Spanish.
//
// Every helper takes `app` as its first argument, and inside a hook
// that must be `e.app`: it participates in the request transaction,
// while `$app` does not and would leave inventory writes committed
// even when the request later fails.
// ─────────────────────────────────────────────────────────────

function getOperatorId(e) {
  if (e.auth && e.auth.id) {
    return e.auth.id;
  }
  return null;
}

function generateSequenceCode(app, prefix, collectionName) {
  var records = app.findRecordsByFilter(collectionName, "", "-code", 1, 0);

  if (records.length > 0) {
    var lastCode = records[0].get("code");
    var numericPart = lastCode.replace(prefix, "");
    var parsed = parseInt(numericPart, 10);
    if (isNaN(parsed)) {
      console.warn(
        "generateSequenceCode: could not parse numeric part '" +
          numericPart +
          "' from code '" +
          lastCode +
          "', defaulting to record count"
      );
      var allRecords = app.findRecordsByFilter(collectionName, "", "", 0, 0);
      parsed = allRecords.length;
    }
    var nextNum = parsed + 1;
    return prefix + String(nextNum).padStart(6, "0");
  }

  return prefix + "000001";
}

// findFirstRecordByFilter throws when there is no match, so every
// lookup that may legitimately come back empty goes through here.
function findInventory(app, productId, locationId) {
  var filter =
    "product_id = '" +
    productId +
    "' && location_id = '" +
    (locationId || "") +
    "'";

  try {
    return app.findFirstRecordByFilter("inventory", filter);
  } catch (err) {
    return null;
  }
}

function findOrCreateInventory(app, productId, locationId, unitId) {
  var existing = findInventory(app, productId, locationId);
  if (existing) {
    return existing;
  }

  var collection = app.findCollectionByNameOrId("inventory");
  var record = new Record(collection);
  record.set("product_id", productId);
  record.set("location_id", locationId || "");
  record.set("unit_id", unitId);
  record.set("available_qty", 0);
  record.set("reserved_qty", 0);
  record.set("quarantine_qty", 0);
  record.set("total_qty", 0);
  record.set("last_movement_at", new Date().toISOString());
  app.save(record);

  return record;
}

function createInventoryMovement(
  app,
  movementType,
  productId,
  locationId,
  unitId,
  quantity,
  referenceType,
  referenceId,
  operatorId,
  notes
) {
  var collection = app.findCollectionByNameOrId("inventory_movements");
  var record = new Record(collection);
  record.set("movement_type", movementType);
  record.set("product_id", productId);
  record.set("location_id", locationId || "");
  record.set("unit_id", unitId);
  record.set("quantity", quantity);
  record.set("reference_type", referenceType);
  record.set("reference_id", referenceId || "");
  record.set("operator_id", operatorId);
  record.set("notes", notes || "");
  app.save(record);

  return record;
}

function updateInventoryQuantities(app, inventoryRecord, movementType, quantity) {
  var available = inventoryRecord.get("available_qty") || 0;
  var reserved = inventoryRecord.get("reserved_qty") || 0;
  var quarantine = inventoryRecord.get("quarantine_qty") || 0;

  switch (movementType) {
    case "entrada":
    case "devolucion":
    case "ajuste_positivo":
      available += quantity;
      break;

    case "salida":
      reserved -= quantity;
      break;

    case "reserva":
      available -= quantity;
      reserved += quantity;
      break;

    case "liberacion":
      reserved -= quantity;
      available += quantity;
      break;

    case "ajuste_negativo":
      available -= quantity;
      break;

    case "cuarentena":
      quarantine += quantity;
      break;

    case "liberar_cuarentena":
      quarantine -= quantity;
      available += quantity;
      break;

    case "traslado_a_cuarentena":
      available -= quantity;
      quarantine += quantity;
      break;
  }

  if (available < 0) {
    console.warn(
      "available_qty clamped to 0 for inventory record: " + inventoryRecord.id
    );
    available = 0;
  }
  if (reserved < 0) {
    console.warn(
      "reserved_qty clamped to 0 for inventory record: " + inventoryRecord.id
    );
    reserved = 0;
  }
  if (quarantine < 0) {
    console.warn(
      "quarantine_qty clamped to 0 for inventory record: " + inventoryRecord.id
    );
    quarantine = 0;
  }

  inventoryRecord.set("available_qty", available);
  inventoryRecord.set("reserved_qty", reserved);
  inventoryRecord.set("quarantine_qty", quarantine);
  inventoryRecord.set("total_qty", available + reserved + quarantine);
  inventoryRecord.set("last_movement_at", new Date().toISOString());

  app.save(inventoryRecord);
}

function createAuditLog(
  app,
  entityType,
  entityId,
  action,
  changes,
  operatorId,
  notes
) {
  var collection = app.findCollectionByNameOrId("audit_log");
  var record = new Record(collection);
  record.set("entity_type", entityType);
  record.set("entity_id", entityId);
  record.set("action", action);
  record.set("changes", changes);
  record.set("operator_id", operatorId);
  record.set("notes", notes || "");
  app.save(record);

  return record;
}

module.exports = {
  getOperatorId: getOperatorId,
  generateSequenceCode: generateSequenceCode,
  findInventory: findInventory,
  findOrCreateInventory: findOrCreateInventory,
  createInventoryMovement: createInventoryMovement,
  updateInventoryQuantities: updateInventoryQuantities,
  createAuditLog: createAuditLog,
};
