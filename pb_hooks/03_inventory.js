// ─────────────────────────────────────────────────────────────
// 03_inventory.js — Inventory movement hooks (core business logic)
// ─────────────────────────────────────────────────────────────

// ── donation_items: validation ───────────────────────────────

function _hasInventoryImpact(oldStatus) {
  return oldStatus === "available" || oldStatus === "quarantine";
}

onRecordBeforeCreateRequest("donation_items", (e) => {
  try {
    var record = e.record;
    var productId = record.get("product_id");
    var unitId = record.get("unit_id");
    var product = $app.findRecordById("products", productId);

    if (product.get("default_unit_id") !== unitId) {
      throw new BadRequestError(
        "La unidad debe coincidir con la unidad predeterminada del producto"
      );
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    console.error("Error in donation_items beforeCreate validation:", err);
    throw new BadRequestError("Error validando artículo de donación");
  }
  return e.next();
});

onRecordBeforeUpdateRequest("donation_items", (e) => {
  try {
    var record = e.record;

    // Fetch the persisted row to get the CURRENT database status
    var currentItem = $app.findRecordById("donation_items", record.id);
    var oldStatus = currentItem.get("classification_status");

    // Cache old classification_status for afterUpdate hook
    _beforeUpdateCache["status_" + record.id] = oldStatus;

    if (_hasInventoryImpact(oldStatus)) {
      var origProductId = currentItem.get("product_id");
      var origLocationId = currentItem.get("location_id");
      var origUnitId = currentItem.get("unit_id");
      var origQuantity = currentItem.get("quantity");

      // Cache originals for the afterUpdate hook
      _beforeUpdateCache["orig_status_" + record.id] = oldStatus;

      if (
        record.get("product_id") !== origProductId ||
        record.get("location_id") !== origLocationId ||
        record.get("unit_id") !== origUnitId
      ) {
        throw new BadRequestError(
          "No se puede cambiar producto, ubicación o unidad de un artículo que ya afectó inventario"
        );
      }

      if (record.get("quantity") !== origQuantity) {
        throw new BadRequestError(
          "No se puede cambiar la cantidad de un artículo que ya afectó inventario. Use un ajuste de inventario"
        );
      }

      // Block transitions away from available/quarantine to rejected
      var newStatus = record.get("classification_status");
      if (
        (oldStatus === "available" || oldStatus === "quarantine") &&
        newStatus === "rejected"
      ) {
        throw new BadRequestError(
          "No se puede rechazar un artículo que ya afectó inventario. Use un ajuste de inventario"
        );
      }
    }

    // For available → quarantine, verify available stock exists
    var newStatusCheck = record.get("classification_status");
    if (oldStatus === "available" && newStatusCheck === "quarantine") {
      var loc = record.get("location_id") || "";
      var filter =
        "product_id = '" +
        record.get("product_id") +
        "' && location_id = '" +
        loc +
        "'";
      var inventory = $app.findFirstRecordByFilter("inventory", filter);
      if (!inventory) {
        throw new BadRequestError("No existe registro de inventario para este producto y ubicación");
      }
      if (inventory.get("available_qty") < record.get("quantity")) {
        throw new BadRequestError(
          "Cantidad disponible insuficiente para mover a cuarentena"
        );
      }
    }
  } catch (err) {
    delete _beforeUpdateCache["status_" + record.id];
    delete _beforeUpdateCache["orig_status_" + record.id];
    if (err instanceof BadRequestError) throw err;
    console.error("Error in donation_items beforeUpdate validation:", err);
    throw new BadRequestError("Error validando artículo de donación");
  }
  return e.next();
});

// ── donation_items: inventory movements on classification ────

onRecordAfterCreateRequest("donation_items", (e) => {
  try {
    var record = e.record;
    var status = record.get("classification_status");
    var operatorId = getOperatorId(e);
    if (!operatorId) return;

    if (status === "available") {
      createInventoryMovement(
        "entrada",
        record.get("product_id"),
        record.get("location_id"),
        record.get("unit_id"),
        record.get("quantity"),
        "donation",
        record.get("donation_id"),
        operatorId,
        "Entrada por clasificación de donación"
      );

      var inv = findOrCreateInventory(
        record.get("product_id"),
        record.get("location_id"),
        record.get("unit_id")
      );
      updateInventoryQuantities(inv, "entrada", record.get("quantity"));
    } else if (status === "quarantine") {
      createInventoryMovement(
        "cuarentena",
        record.get("product_id"),
        record.get("location_id"),
        record.get("unit_id"),
        record.get("quantity"),
        "donation",
        record.get("donation_id"),
        operatorId,
        "Producto en cuarentena pendiente de revisión"
      );

      var inv2 = findOrCreateInventory(
        record.get("product_id"),
        record.get("location_id"),
        record.get("unit_id")
      );
      updateInventoryQuantities(inv2, "cuarentena", record.get("quantity"));
    }
  } catch (err) {
    console.error("Error in donation_items afterCreate hook:", err);
  }
});

onRecordAfterUpdateRequest("donation_items", (e) => {
  try {
    var record = e.record;
    var operatorId = getOperatorId(e);
    if (!operatorId) return;

    var cacheKey = "orig_status_" + record.id;
    var cacheKeyAlt = "status_" + record.id;
    var oldStatus = _beforeUpdateCache[cacheKey];
    if (oldStatus === undefined) {
      oldStatus = _beforeUpdateCache[cacheKeyAlt];
    }
    delete _beforeUpdateCache[cacheKey];
    delete _beforeUpdateCache[cacheKeyAlt];

    var newStatus = record.get("classification_status");
    if (!oldStatus || oldStatus === newStatus) return;

    var productId = record.get("product_id");
    var locationId = record.get("location_id");
    var unitId = record.get("unit_id");
    var quantity = record.get("quantity");
    var donationId = record.get("donation_id");

    if (oldStatus === "pending" && newStatus === "available") {
      createInventoryMovement(
        "entrada",
        productId,
        locationId,
        unitId,
        quantity,
        "donation",
        donationId,
        operatorId,
        "Clasificación: producto aceptado"
      );
      var inv = findOrCreateInventory(productId, locationId, unitId);
      updateInventoryQuantities(inv, "entrada", quantity);
    } else if (oldStatus === "pending" && newStatus === "quarantine") {
      createInventoryMovement(
        "cuarentena",
        productId,
        locationId,
        unitId,
        quantity,
        "donation",
        donationId,
        operatorId,
        "Clasificación: producto en cuarentena"
      );
      var inv2 = findOrCreateInventory(productId, locationId, unitId);
      updateInventoryQuantities(inv2, "cuarentena", quantity);
    } else if (oldStatus === "quarantine" && newStatus === "available") {
      createInventoryMovement(
        "liberar_cuarentena",
        productId,
        locationId,
        unitId,
        quantity,
        "donation",
        donationId,
        operatorId,
        "Liberado de cuarentena por revisión"
      );
      var inv3 = findOrCreateInventory(productId, locationId, unitId);
      updateInventoryQuantities(inv3, "liberar_cuarentena", quantity);
    } else if (oldStatus === "available" && newStatus === "quarantine") {
      createInventoryMovement(
        "traslado_a_cuarentena",
        productId,
        locationId,
        unitId,
        quantity,
        "donation",
        donationId,
        operatorId,
        "Movido a cuarentena por revisión"
      );
      var inv4 = $app.findFirstRecordByFilter(
        "inventory",
        "product_id = '" +
          productId +
          "' && location_id = '" +
          (locationId || "") +
          "'"
      );
      updateInventoryQuantities(inv4, "traslado_a_cuarentena", quantity);
    }
  } catch (err) {
    console.error("Error in donation_items afterUpdate hook:", err);
  }
});

// ── reservations: validation ─────────────────────────────────

onRecordBeforeCreateRequest("reservations", (e) => {
  try {
    var record = e.record;
    if (record.get("status") !== "activa") return e.next();

    var inventoryId = record.get("inventory_id");
    var inventory = $app.findRecordById("inventory", inventoryId);

    var requestItemId = record.get("request_item_id");
    var requestItem = $app.findRecordById("request_items", requestItemId);
    if (inventory.get("product_id") !== requestItem.get("product_id")) {
      throw new BadRequestError(
        "El producto del inventario no coincide con el producto solicitado"
      );
    }

    var qty = record.get("quantity_reserved");
    if (inventory.get("available_qty") < qty) {
      throw new BadRequestError(
        "Cantidad disponible insuficiente. Disponible: " +
          inventory.get("available_qty")
      );
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    console.error("Error in reservations beforeCreate validation:", err);
    throw new BadRequestError("Error validando reserva");
  }
  return e.next();
});

onRecordBeforeUpdateRequest("reservations", (e) => {
  try {
    var record = e.record;

    // Fetch the persisted row to get the CURRENT database status
    var currentReservation = $app.findRecordById("reservations", record.id);
    var oldStatus = currentReservation.get("status");

    // Cache old status for afterUpdate
    _beforeUpdateCache["res_status_" + record.id] = oldStatus;

    if (oldStatus === "activa") {
      var newQty = record.get("quantity_reserved");
      var origQty = currentReservation.get("quantity_reserved");
      var origInvId = currentReservation.get("inventory_id");

      if (newQty !== origQty) {
        throw new BadRequestError(
          "No se puede modificar la cantidad de una reserva activa. Libere la reserva y cree una nueva"
        );
      }

      if (record.get("inventory_id") !== origInvId) {
        throw new BadRequestError(
          "No se puede cambiar el inventario de una reserva activa. Libere la reserva y cree una nueva"
        );
      }
    }
  } catch (err) {
    delete _beforeUpdateCache["res_status_" + record.id];
    if (err instanceof BadRequestError) throw err;
    console.error("Error in reservations beforeUpdate validation:", err);
    throw new BadRequestError("Error validando reserva");
  }
  return e.next();
});

// ── reservations: inventory movements ────────────────────────

onRecordAfterCreateRequest("reservations", (e) => {
  try {
    var record = e.record;
    var operatorId = getOperatorId(e);
    if (!operatorId) return;

    if (record.get("status") !== "activa") return;

    var inventoryId = record.get("inventory_id");
    var quantity = record.get("quantity_reserved");
    var inventory = $app.findRecordById("inventory", inventoryId);

    updateInventoryQuantities(inventory, "reserva", quantity);

    createInventoryMovement(
      "reserva",
      inventory.get("product_id"),
      inventory.get("location_id"),
      inventory.get("unit_id"),
      quantity,
      "request",
      record.get("request_item_id"),
      operatorId,
      "Reserva para solicitud de ayuda"
    );
  } catch (err) {
    console.error("Error in reservations afterCreate hook:", err);
  }
});

onRecordAfterUpdateRequest("reservations", (e) => {
  try {
    var record = e.record;
    var operatorId = getOperatorId(e);
    if (!operatorId) return;

    var oldStatus = _beforeUpdateCache["res_status_" + record.id];
    delete _beforeUpdateCache["res_status_" + record.id];

    var newStatus = record.get("status");
    if (!oldStatus || oldStatus === newStatus) return;

    var inventoryId = record.get("inventory_id");
    var quantity = record.get("quantity_reserved");
    var inventory = $app.findRecordById("inventory", inventoryId);

    if (oldStatus === "activa" && newStatus === "liberada") {
      updateInventoryQuantities(inventory, "liberacion", quantity);

      createInventoryMovement(
        "liberacion",
        inventory.get("product_id"),
        inventory.get("location_id"),
        inventory.get("unit_id"),
        quantity,
        "request",
        record.get("request_item_id"),
        operatorId,
        "Reserva liberada — producto devuelto a disponible"
      );
    } else if (oldStatus === "activa" && newStatus === "consumida") {
      updateInventoryQuantities(inventory, "salida", quantity);

      createInventoryMovement(
        "salida",
        inventory.get("product_id"),
        inventory.get("location_id"),
        inventory.get("unit_id"),
        quantity,
        "request",
        record.get("request_item_id"),
        operatorId,
        "Salida por entrega confirmada"
      );
    }
  } catch (err) {
    console.error("Error in reservations afterUpdate hook:", err);
  }
});

// ── adjustments: validation + inventory update ───────────────

onRecordBeforeCreateRequest("adjustments", (e) => {
  try {
    var record = e.record;
    var inventoryId = record.get("inventory_id");
    var inventory = $app.findRecordById("inventory", inventoryId);

    if (inventory.get("product_id") !== record.get("product_id")) {
      throw new BadRequestError(
        "El producto no coincide con el registro de inventario"
      );
    }

    var invLoc = inventory.get("location_id") || "";
    var adjLoc = record.get("location_id") || "";
    if (invLoc !== adjLoc) {
      throw new BadRequestError(
        "La ubicación no coincide con el registro de inventario"
      );
    }

    var currentAvailable = inventory.get("available_qty");
    if (currentAvailable !== record.get("quantity_before")) {
      throw new BadRequestError(
        "La cantidad anterior no coincide con el inventario actual. Cantidad disponible: " +
          currentAvailable
      );
    }

    var before = record.get("quantity_before");
    var after = record.get("quantity_after");
    record.set("difference", after - before);
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    console.error("Error in adjustments beforeCreate hook:", err);
    throw new BadRequestError("Error validando ajuste de inventario");
  }
  return e.next();
});

onRecordAfterCreateRequest("adjustments", (e) => {
  try {
    var record = e.record;
    var operatorId = getOperatorId(e);
    if (!operatorId) return;

    var inventoryId = record.get("inventory_id");
    var productId = record.get("product_id");
    var locationId = record.get("location_id");
    var difference = record.get("difference");
    var quantity = Math.abs(difference);

    var inventory = $app.findRecordById("inventory", inventoryId);
    var movementType = difference > 0 ? "ajuste_positivo" : "ajuste_negativo";

    updateInventoryQuantities(inventory, movementType, quantity);

    createInventoryMovement(
      movementType,
      productId,
      locationId,
      inventory.get("unit_id"),
      quantity,
      "adjustment",
      record.id,
      operatorId,
      "Ajuste de inventario: " + record.get("reason")
    );
  } catch (err) {
    console.error("Error in adjustments afterCreate hook:", err);
  }
});
