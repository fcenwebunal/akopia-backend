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

// Reserva el siguiente número de la serie y lo devuelve formateado.
//
// El contador se lee y se incrementa dentro de la transacción que inserta
// el registro, así que dos peticiones simultáneas no pueden llevarse el
// mismo número: SQLite serializa las escrituras y la segunda ve el valor
// ya actualizado. Leer el último código y sumar uno no daba esa garantía
// y hacía fallar la segunda donación con un 400 inexplicable.
function generateSequenceCode(app, prefix, collectionName) {
  var sequence = app.findFirstRecordByFilter(
    "sequences",
    "key = {:key}",
    { key: collectionName }
  );

  var next = sequence.get("next_value") || 1;

  sequence.set("next_value", next + 1);
  app.save(sequence);

  return prefix + String(next).padStart(6, "0");
}

// findFirstRecordByFilter throws when there is no match, so every
// lookup that may legitimately come back empty goes through here.
//
// El filtro va con parámetros, no concatenado: los ids de PocketBase son
// alfanuméricos y hoy no romperían nada, pero un valor con comilla
// convertiría la consulta en otra distinta sin avisar.
function findInventory(app, productId, locationId) {
  // El caso sin ubicación va con el literal '' y no con un parámetro
  // vacío: en un campo de relación no equivalen, y el parámetro no
  // encuentra las filas sin ubicar. El literal no lleva datos de fuera,
  // así que la garantía de A2 se mantiene.
  var filter = "product_id = {:productId} && location_id = ";
  var params = { productId: productId };

  if (locationId) {
    filter += "{:locationId}";
    params.locationId = locationId;
  } else {
    filter += "''";
  }

  try {
    return app.findFirstRecordByFilter("inventory", filter, params);
  } catch (err) {
    return null;
  }
}

// Todos los renglones de inventario de un producto con saldo
// disponible, en TODAS sus ubicaciones — a diferencia de
// `findInventory`, que busca en una ubicación a la vez y solo sirve
// cuando quien pregunta de verdad conoce esa ubicación (como
// `donation_items`, que sí guarda `location_id`).
//
// `request_items` no guarda ubicación — nunca la tuvo, y no tiene por
// qué: una solicitud pide un producto, no un estante — así que
// preguntar "cuánto hay disponible de este producto" solo tiene
// sentido sumando todas sus ubicaciones. Usado por `approve` y
// `availability` para no repetir el error de mirar una sola.
//
// Orden descendente por saldo: al repartir una reserva entre varias
// ubicaciones, empezar por la que más tiene deja menos renglones
// tocados por reserva, sin que importe cuál en particular — no hay
// FEFO que respetar (el proyecto no lleva lotes).
function findInventoryRows(app, productId) {
  return app.findRecordsByFilter(
    "inventory",
    "product_id = {:productId} && available_qty > 0",
    "-available_qty",
    0,
    0,
    { productId: productId }
  );
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
  traslado_salida: { available: -1 },
  traslado_entrada: { available: 1 },
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

// Mueve cantidad disponible de un renglón de inventario a otro (mismo
// producto, ubicación distinta) — o le asigna ubicación por primera vez
// a lo que estaba "sin ubicar". Solo toca `available_qty`: lo reservado
// ya está comprometido con una solicitud y lo que está en cuarentena
// espera revisión, ninguno de los dos se reubica de paso.
//
// Dos movimientos, no uno: `traslado_salida` en el origen y
// `traslado_entrada` en el destino, igual que reserva/liberación ya
// hacen con dos tipos en vez de uno solo con dos ubicaciones.
function relocateInventory(app, sourceInventory, destinationLocationId, quantity, operatorId, notes) {
  const sourceLocationId = sourceInventory.get("location_id") || "";
  const destLocationId = destinationLocationId || "";

  if (sourceLocationId === destLocationId) {
    throw new BadRequestError("La ubicación de destino debe ser distinta de la actual");
  }

  if (quantity <= 0) {
    throw new BadRequestError("La cantidad a reubicar debe ser mayor que cero");
  }

  if (sourceInventory.get("available_qty") < quantity) {
    throw new BadRequestError(
      "Cantidad disponible insuficiente. Disponible: " + sourceInventory.get("available_qty")
    );
  }

  const productId = sourceInventory.get("product_id");
  const unitId = sourceInventory.get("unit_id");

  updateInventoryQuantities(app, sourceInventory, "traslado_salida", quantity);
  createInventoryMovement(
    app, "traslado_salida", productId, sourceLocationId, unitId, quantity,
    "manual", "", operatorId, notes || "Traslado de ubicación"
  );

  const destination = findOrCreateInventory(app, productId, destLocationId, unitId);
  updateInventoryQuantities(app, destination, "traslado_entrada", quantity);
  createInventoryMovement(
    app, "traslado_entrada", productId, destLocationId, unitId, quantity,
    "manual", "", operatorId, notes || "Traslado de ubicación"
  );

  return destination;
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
  relocateInventory: relocateInventory,
  findActiveReservations: findActiveReservations,
  getOperatorId: getOperatorId,
  generateSequenceCode: generateSequenceCode,
  findInventory: findInventory,
  findInventoryRows: findInventoryRows,
  findOrCreateInventory: findOrCreateInventory,
  createInventoryMovement: createInventoryMovement,
  updateInventoryQuantities: updateInventoryQuantities,
  createAuditLog: createAuditLog,
};
