// ─────────────────────────────────────────────────────────────
// 03_inventory.pb.js — Inventory movement hooks (core business logic)
//
// Each hook wraps e.next() in a transaction and rebinds e.app to
// the transactional handle, so the record write and the inventory
// movement it causes either both land or neither does. A balance is
// never edited on its own: a movement is recorded and the balance
// is its consequence.
//
// Errors raised after e.next() are NOT swallowed. Rolling the
// request back and answering with an error is the only outcome
// that keeps the ledger and the balances telling the same story.
// ─────────────────────────────────────────────────────────────

// ── donation_items: intake and classification ────────────────

onRecordCreateRequest((e) => {
  const {
    getOperatorId,
    findOrCreateInventory,
    createInventoryMovement,
    updateInventoryQuantities,
  } = require(`${__hooks}/utils/helpers.js`);

  const originalApp = e.app;

  try {
    e.app.runInTransaction((txApp) => {
      e.app = txApp;

      const product = e.app.findRecordById("products", e.record.get("product_id"));
      if (product.get("default_unit_id") !== e.record.get("unit_id")) {
        throw new BadRequestError(
          "La unidad debe coincidir con la unidad predeterminada del producto"
        );
      }

      e.next();

      const status = e.record.get("classification_status");
      if (status !== "available" && status !== "quarantine") {
        return;
      }

      const operatorId = getOperatorId(e);
      if (!operatorId) {
        throw new BadRequestError(
          "Se requiere un operador autenticado para registrar movimientos de inventario"
        );
      }

      const movementType = status === "available" ? "entrada" : "cuarentena";
      const notes =
        status === "available"
          ? "Entrada por clasificación de donación"
          : "Producto en cuarentena pendiente de revisión";

      const productId = e.record.get("product_id");
      const locationId = e.record.get("location_id");
      const unitId = e.record.get("unit_id");
      const quantity = e.record.get("quantity");

      createInventoryMovement(
        e.app,
        movementType,
        productId,
        locationId,
        unitId,
        quantity,
        "donation",
        e.record.get("donation_id"),
        operatorId,
        notes
      );

      const inventory = findOrCreateInventory(e.app, productId, locationId, unitId);
      updateInventoryQuantities(e.app, inventory, movementType, quantity);
    });
  } finally {
    e.app = originalApp;
  }
}, "donation_items");

onRecordUpdateRequest((e) => {
  const {
    getOperatorId,
    findInventory,
    findOrCreateInventory,
    createInventoryMovement,
    updateInventoryQuantities,
  } = require(`${__hooks}/utils/helpers.js`);

  // Transitions that move stock between the three buckets. Anything
  // not listed here is a status change with no inventory effect.
  //
  // `rejected` is treated exactly like `pending`: neither ever entered
  // the inventory, so reclassifying either one into a stocked status is
  // an `entrada`. Leaving rejected out would let an item show up as
  // available with nothing behind it.
  const TRANSITIONS = {
    "pending>available": {
      type: "entrada",
      notes: "Clasificación: producto aceptado",
    },
    "pending>quarantine": {
      type: "cuarentena",
      notes: "Clasificación: producto en cuarentena",
    },
    "rejected>available": {
      type: "entrada",
      notes: "Reclasificación: producto rechazado aceptado",
    },
    "rejected>quarantine": {
      type: "cuarentena",
      notes: "Reclasificación: producto rechazado enviado a cuarentena",
    },
    "quarantine>available": {
      type: "liberar_cuarentena",
      notes: "Liberado de cuarentena por revisión",
    },
    "available>quarantine": {
      type: "traslado_a_cuarentena",
      notes: "Movido a cuarentena por revisión",
    },
  };

  const originalApp = e.app;

  try {
    e.app.runInTransaction((txApp) => {
      e.app = txApp;

      const previous = e.record.original();
      const oldStatus = previous.get("classification_status");
      const newStatus = e.record.get("classification_status");

      // Once stock has moved, the item is a historical fact: only its
      // status may change, and only towards another stocked status.
      const hasInventoryImpact =
        oldStatus === "available" || oldStatus === "quarantine";

      if (hasInventoryImpact) {
        if (
          e.record.get("product_id") !== previous.get("product_id") ||
          e.record.get("location_id") !== previous.get("location_id") ||
          e.record.get("unit_id") !== previous.get("unit_id")
        ) {
          throw new BadRequestError(
            "No se puede cambiar producto, ubicación o unidad de un artículo que ya afectó inventario"
          );
        }

        if (e.record.get("quantity") !== previous.get("quantity")) {
          throw new BadRequestError(
            "No se puede cambiar la cantidad de un artículo que ya afectó inventario. Use un ajuste de inventario"
          );
        }

        if (newStatus === "rejected") {
          throw new BadRequestError(
            "No se puede rechazar un artículo que ya afectó inventario. Use un ajuste de inventario"
          );
        }
      }

      if (oldStatus === "available" && newStatus === "quarantine") {
        const inventory = findInventory(
          e.app,
          e.record.get("product_id"),
          e.record.get("location_id")
        );
        if (!inventory) {
          throw new BadRequestError(
            "No existe registro de inventario para este producto y ubicación"
          );
        }
        if (inventory.get("available_qty") < e.record.get("quantity")) {
          throw new BadRequestError(
            "Cantidad disponible insuficiente para mover a cuarentena"
          );
        }
      }

      e.next();

      const transition = TRANSITIONS[oldStatus + ">" + newStatus];
      if (!transition) {
        return;
      }

      const operatorId = getOperatorId(e);
      if (!operatorId) {
        throw new BadRequestError(
          "Se requiere un operador autenticado para registrar movimientos de inventario"
        );
      }

      const productId = e.record.get("product_id");
      const locationId = e.record.get("location_id");
      const unitId = e.record.get("unit_id");
      const quantity = e.record.get("quantity");

      createInventoryMovement(
        e.app,
        transition.type,
        productId,
        locationId,
        unitId,
        quantity,
        "donation",
        e.record.get("donation_id"),
        operatorId,
        transition.notes
      );

      const inventory = findOrCreateInventory(e.app, productId, locationId, unitId);
      updateInventoryQuantities(e.app, inventory, transition.type, quantity);
    });
  } finally {
    e.app = originalApp;
  }
}, "donation_items");

// ── reservations: commit stock to an approved request ────────

onRecordCreateRequest((e) => {
  const { getOperatorId, applyReservationEffect } = require(`${__hooks}/utils/helpers.js`);

  const originalApp = e.app;

  try {
    e.app.runInTransaction((txApp) => {
      e.app = txApp;

      if (e.record.get("status") !== "activa") {
        e.next();
        return;
      }

      const inventory = e.app.findRecordById(
        "inventory",
        e.record.get("inventory_id")
      );
      const requestItem = e.app.findRecordById(
        "request_items",
        e.record.get("request_item_id")
      );

      if (inventory.get("product_id") !== requestItem.get("product_id")) {
        throw new BadRequestError(
          "El producto del inventario no coincide con el producto solicitado"
        );
      }

      const quantity = e.record.get("quantity_reserved");
      if (inventory.get("available_qty") < quantity) {
        throw new BadRequestError(
          "Cantidad disponible insuficiente. Disponible: " +
            inventory.get("available_qty")
        );
      }

      e.next();

      const operatorId = getOperatorId(e);
      if (!operatorId) {
        throw new BadRequestError(
          "Se requiere un operador autenticado para registrar movimientos de inventario"
        );
      }

      applyReservationEffect(
        e.app,
        inventory,
        "reserva",
        quantity,
        e.record.get("request_item_id"),
        operatorId,
        "Reserva para solicitud de ayuda"
      );
    });
  } finally {
    e.app = originalApp;
  }
}, "reservations");

onRecordUpdateRequest((e) => {
  const { getOperatorId, applyReservationEffect } = require(`${__hooks}/utils/helpers.js`);

  const TRANSITIONS = {
    "activa>liberada": {
      type: "liberacion",
      notes: "Reserva liberada — producto devuelto a disponible",
    },
    "activa>consumida": {
      type: "salida",
      notes: "Salida por entrega confirmada",
    },
  };

  const originalApp = e.app;

  try {
    e.app.runInTransaction((txApp) => {
      e.app = txApp;

      const previous = e.record.original();
      const oldStatus = previous.get("status");
      const newStatus = e.record.get("status");

      // Una reserva cerrada es un hecho consumado. Reabrirla dejaría una
      // reserva "activa" sin stock comprometido detrás, y al liberarla
      // después se devolvería a disponible una cantidad que nunca se
      // restó: inventario inventado.
      if (oldStatus !== "activa" && oldStatus !== newStatus) {
        throw new BadRequestError(
          "Una reserva " +
            oldStatus +
            " no puede cambiar de estado. Cree una reserva nueva"
        );
      }

      if (oldStatus === "activa") {
        if (
          e.record.get("quantity_reserved") !== previous.get("quantity_reserved")
        ) {
          throw new BadRequestError(
            "No se puede modificar la cantidad de una reserva activa. Libere la reserva y cree una nueva"
          );
        }

        if (e.record.get("inventory_id") !== previous.get("inventory_id")) {
          throw new BadRequestError(
            "No se puede cambiar el inventario de una reserva activa. Libere la reserva y cree una nueva"
          );
        }
      }

      e.next();

      const transition = TRANSITIONS[oldStatus + ">" + newStatus];
      if (!transition) {
        return;
      }

      const operatorId = getOperatorId(e);
      if (!operatorId) {
        throw new BadRequestError(
          "Se requiere un operador autenticado para registrar movimientos de inventario"
        );
      }

      const inventory = e.app.findRecordById(
        "inventory",
        e.record.get("inventory_id")
      );

      applyReservationEffect(
        e.app,
        inventory,
        transition.type,
        e.record.get("quantity_reserved"),
        e.record.get("request_item_id"),
        operatorId,
        transition.notes
      );
    });
  } finally {
    e.app = originalApp;
  }
}, "reservations");

// ── adjustments: the only way to correct a balance by hand ───

onRecordCreateRequest((e) => {
  const {
    getOperatorId,
    createInventoryMovement,
    updateInventoryQuantities,
  } = require(`${__hooks}/utils/helpers.js`);

  const originalApp = e.app;

  try {
    e.app.runInTransaction((txApp) => {
      e.app = txApp;

      const inventory = e.app.findRecordById(
        "inventory",
        e.record.get("inventory_id")
      );

      if (inventory.get("product_id") !== e.record.get("product_id")) {
        throw new BadRequestError(
          "El producto no coincide con el registro de inventario"
        );
      }

      if (
        (inventory.get("location_id") || "") !==
        (e.record.get("location_id") || "")
      ) {
        throw new BadRequestError(
          "La ubicación no coincide con el registro de inventario"
        );
      }

      // Optimistic lock: the operator states the balance they saw.
      const currentAvailable = inventory.get("available_qty");
      if (currentAvailable !== e.record.get("quantity_before")) {
        throw new BadRequestError(
          "La cantidad anterior no coincide con el inventario actual. Cantidad disponible: " +
            currentAvailable
        );
      }

      const difference =
        e.record.get("quantity_after") - e.record.get("quantity_before");
      e.record.set("difference", difference);

      e.next();

      if (difference === 0) {
        return;
      }

      const operatorId = getOperatorId(e);
      if (!operatorId) {
        throw new BadRequestError(
          "Se requiere un operador autenticado para registrar movimientos de inventario"
        );
      }

      const movementType =
        difference > 0 ? "ajuste_positivo" : "ajuste_negativo";
      const quantity = Math.abs(difference);

      updateInventoryQuantities(e.app, inventory, movementType, quantity);

      createInventoryMovement(
        e.app,
        movementType,
        e.record.get("product_id"),
        e.record.get("location_id"),
        inventory.get("unit_id"),
        quantity,
        "adjustment",
        e.record.id,
        operatorId,
        "Ajuste de inventario: " + e.record.get("reason")
      );
    });
  } finally {
    e.app = originalApp;
  }
}, "adjustments");
