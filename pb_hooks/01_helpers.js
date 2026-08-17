// ─────────────────────────────────────────────────────────────
// 01_helpers.js — Shared utility functions for Akopia hooks
// All identifiers and internal strings in English.
// User-visible error strings in Spanish.
// ─────────────────────────────────────────────────────────────

// Status cache used to capture pre-update field values between
// beforeUpdate and afterUpdate hooks. PocketBase JSVM is
// single-threaded (goja engine), so no race conditions.
globalThis._beforeUpdateCache = {};

function getOperatorId(e) {
  if (e.auth && e.auth.id) {
    return e.auth.id;
  }
  return null;
}

function generateSequenceCode(prefix, collectionName) {
  var records = $app.findRecordsByFilter(
    collectionName,
    "",
    "-code",
    1,
    0
  );

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
      var allRecords = $app.findRecordsByFilter(
        collectionName,
        "",
        "",
        0,
        0
      );
      parsed = allRecords.length;
    }
    var nextNum = parsed + 1;
    return prefix + String(nextNum).padStart(6, "0");
  }

  return prefix + "000001";
}

function findOrCreateInventory(productId, locationId, unitId) {
  var loc = locationId || "";
  var filter = "product_id = '" + productId + "' && location_id = '" + loc + "'";

  var existing = $app.findFirstRecordByFilter("inventory", filter);
  if (existing) {
    return existing;
  }

  var collection = $app.findCollectionByNameOrId("inventory");
  var record = new Record(collection);
  record.set("product_id", productId);
  record.set("location_id", loc);
  record.set("unit_id", unitId);
  record.set("available_qty", 0);
  record.set("reserved_qty", 0);
  record.set("quarantine_qty", 0);
  record.set("total_qty", 0);
  record.set("last_movement_at", new Date().toISOString());
  $app.save(record);

  return record;
}

function createInventoryMovement(
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
  var collection = $app.findCollectionByNameOrId("inventory_movements");
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
  $app.save(record);

  return record;
}

function updateInventoryQuantities(inventoryRecord, movementType, quantity) {
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

  $app.save(inventoryRecord);
}

function createAuditLog(
  entityType,
  entityId,
  action,
  changes,
  operatorId,
  notes
) {
  var collection = $app.findCollectionByNameOrId("audit_log");
  var record = new Record(collection);
  record.set("entity_type", entityType);
  record.set("entity_id", entityId);
  record.set("action", action);
  record.set("changes", changes);
  record.set("operator_id", operatorId);
  record.set("notes", notes || "");
  $app.save(record);

  return record;
}
