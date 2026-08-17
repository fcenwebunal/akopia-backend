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

// Efecto de cada tipo sobre las tres cubetas. Es el mapa de movimientos
// hecho código: si alguna vez hay que cambiar la aritmética, se cambia
// aquí y en ningún otro sitio.
var MOVEMENT_EFFECTS = {
  entrada: { available: 1 },
  devolucion: { available: 1 },
  ajuste_positivo: { available: 1 },
  ajuste_negativo: { available: -1 },
  salida: { reserved: -1 },
  reserva: { available: -1, reserved: 1 },
  liberacion: { available: 1, reserved: -1 },
  cuarentena: { quarantine: 1 },
  liberar_cuarentena: { available: 1, quarantine: -1 },
  traslado_a_cuarentena: { available: -1, quarantine: 1 },
};

var BUCKET_LABELS = {
  available: "disponible",
  reserved: "reservada",
  quarantine: "en cuarentena",
};

function updateInventoryQuantities(app, inventoryRecord, movementType, quantity) {
  var effect = MOVEMENT_EFFECTS[movementType];
  if (!effect) {
    throw new BadRequestError(
      "Tipo de movimiento de inventario desconocido: " + movementType
    );
  }

  var buckets = {
    available: inventoryRecord.get("available_qty") || 0,
    reserved: inventoryRecord.get("reserved_qty") || 0,
    quarantine: inventoryRecord.get("quarantine_qty") || 0,
  };

  for (var bucket in effect) {
    buckets[bucket] += effect[bucket] * quantity;

    // Un saldo que se iría a negativo significa que la operación no debía
    // ocurrir. Recortarlo a cero dejaría el movimiento escrito con una
    // cantidad que el saldo ya no refleja, y el libro dejaría de explicar
    // el inventario — que es la única garantía que sostiene el modelo.
    if (buckets[bucket] < 0) {
      throw new BadRequestError(
        "Cantidad " +
          BUCKET_LABELS[bucket] +
          " insuficiente para registrar el movimiento '" +
          movementType +
          "'. Disponible: " +
          (buckets[bucket] - effect[bucket] * quantity) +
          ", solicitado: " +
          quantity
      );
    }
  }

  inventoryRecord.set("available_qty", buckets.available);
  inventoryRecord.set("reserved_qty", buckets.reserved);
  inventoryRecord.set("quarantine_qty", buckets.quarantine);
  inventoryRecord.set(
    "total_qty",
    buckets.available + buckets.reserved + buckets.quarantine
  );
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

// ─────────────────────────────────────────────────────────────
// Operaciones de negocio
//
// Los hooks de `03_inventory.pb.js` son de PETICIÓN: se disparan cuando
// un cliente llama a la API, pero NO cuando una ruta personalizada crea
// o modifica un registro con app.save(), que va por la capa de modelo.
//
// Por eso el efecto en inventario de cada operación vive aquí: los hooks
// lo invocan para las llamadas REST y las rutas lo invocan directamente.
// Un solo sitio donde está escrito qué le pasa al inventario, sin riesgo
// de que los dos caminos se separen.
// ─────────────────────────────────────────────────────────────

// Crea una reserva activa y compromete el stock.
function reserveInventory(app, requestItemId, inventory, quantity, operatorId) {
  var collection = app.findCollectionByNameOrId("reservations");
  var reservation = new Record(collection);
  reservation.set("request_item_id", requestItemId);
  reservation.set("inventory_id", inventory.id);
  reservation.set("quantity_reserved", quantity);
  reservation.set("status", "activa");
  reservation.set("operator_id", operatorId);
  app.save(reservation);

  applyReservationEffect(app, inventory, "reserva", quantity, requestItemId, operatorId,
    "Reserva para solicitud de ayuda");

  return reservation;
}

// Cambia el estado de una reserva activa y mueve el stock en consecuencia.
// `newStatus` debe ser "liberada" (vuelve a disponible) o "consumida"
// (sale de bodega).
function closeReservation(app, reservation, newStatus, operatorId) {
  var TRANSITIONS = {
    liberada: {
      type: "liberacion",
      notes: "Reserva liberada — producto devuelto a disponible",
    },
    consumida: {
      type: "salida",
      notes: "Salida por entrega confirmada",
    },
  };

  var transition = TRANSITIONS[newStatus];
  if (!transition) {
    throw new BadRequestError("Estado de reserva no válido: " + newStatus);
  }

  if (reservation.get("status") !== "activa") {
    throw new BadRequestError(
      "Solo se puede cerrar una reserva activa. Estado actual: " +
        reservation.get("status")
    );
  }

  var quantity = reservation.get("quantity_reserved");
  var inventory = app.findRecordById("inventory", reservation.get("inventory_id"));

  reservation.set("status", newStatus);
  app.save(reservation);

  applyReservationEffect(app, inventory, transition.type, quantity,
    reservation.get("request_item_id"), operatorId, transition.notes);

  return reservation;
}

function applyReservationEffect(app, inventory, movementType, quantity, requestItemId, operatorId, notes) {
  updateInventoryQuantities(app, inventory, movementType, quantity);

  createInventoryMovement(
    app,
    movementType,
    inventory.get("product_id"),
    inventory.get("location_id"),
    inventory.get("unit_id"),
    quantity,
    "request",
    requestItemId,
    operatorId,
    notes
  );
}

// Todas las reservas activas de una solicitud, en cualquiera de sus renglones.
function findActiveReservations(app, requestId) {
  return app.findRecordsByFilter(
    "reservations",
    "status = 'activa' && request_item_id.request_id = {:requestId}",
    "created",
    0,
    0,
    { requestId: requestId }
  );
}

module.exports = {
  reserveInventory: reserveInventory,
  closeReservation: closeReservation,
  applyReservationEffect: applyReservationEffect,
  findActiveReservations: findActiveReservations,
  getOperatorId: getOperatorId,
  generateSequenceCode: generateSequenceCode,
  findInventory: findInventory,
  findOrCreateInventory: findOrCreateInventory,
  createInventoryMovement: createInventoryMovement,
  updateInventoryQuantities: updateInventoryQuantities,
  createAuditLog: createAuditLog,
};
