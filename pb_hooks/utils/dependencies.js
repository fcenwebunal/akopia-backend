// ─────────────────────────────────────────────────────────────
// utils/dependencies.js — Qué impide borrar un registro de verdad
//
// Módulo, no hook: PocketBase solo auto-carga pb_hooks/**/*.pb.js.
//
// Usado exclusivamente por 11_edit_delete_with_reason.pb.js. Cada
// función responde antes de intentar app.delete(): un borrado en
// cascada silencioso (PocketBase lo hace solo cuando cascadeDelete es
// true) puede dejar el saldo de inventory desincronizado del libro de
// inventory_movements sin que nadie se entere — no hay ningún hook de
// borrado que lo repare después. Bloquear con un mensaje claro es
// siempre más seguro que revertir automáticamente bajo presión de
// tiempo, y es la decisión que se tomó explícitamente para esta
// funcionalidad.
// ─────────────────────────────────────────────────────────────

function blocked(reason) {
  return { blocked: true, reason: reason };
}

function allowed() {
  return { blocked: false };
}

function checkDeletable(app, collectionName, record) {
  switch (collectionName) {
    case "donations":
      return checkDonationDeletable(app, record);
    case "donation_items":
      return checkDonationItemDeletable(record);
    case "requests":
      return checkRequestDeletable(app, record);
    case "request_items":
      return checkRequestItemDeletable(app, record);
    case "dispatches":
      return checkDispatchDeletable(app, record);
    case "deliveries":
      // Una entrega ya generó una salida real de inventario
      // (confirm-delivery, en 05_routes.pb.js). Borrar el registro sin
      // revertir ese movimiento dejaría el saldo mintiendo sobre lo
      // que en verdad hay en bodega — no existe una versión segura de
      // esto, así que se bloquea siempre.
      return blocked(
        "Una entrega confirmada ya generó una salida real de inventario y es " +
          "un hecho ya ocurrido — no se puede eliminar. Si hubo un error, " +
          "corrígela editando sus datos, o pide un ajuste de inventario a " +
          "un administrador si el saldo quedó mal."
      );
    default:
      return blocked("Esta colección no admite eliminación.");
  }
}

function checkDonationDeletable(app, record) {
  const affecting = app.findRecordsByFilter(
    "donation_items",
    'donation_id = {:id} && (classification_status = "available" || classification_status = "quarantine")',
    "",
    0,
    0,
    { id: record.id }
  );

  if (affecting.length > 0) {
    return blocked(
      "Esta donación tiene " +
        affecting.length +
        " artículo(s) que ya afectaron el inventario (aptos o en revisión). " +
        "Recházalos desde Inventario, o corrígelos con un ajuste, antes de " +
        "eliminar la donación completa."
    );
  }

  return allowed();
}

function checkDonationItemDeletable(record) {
  const status = record.get("classification_status");

  if (status === "available" || status === "quarantine") {
    return blocked(
      "Este artículo ya afectó el inventario, así que no se puede editar ni " +
        "eliminar desde aquí. Recházalo desde Inventario, o corrige la " +
        "cantidad con un ajuste."
    );
  }

  return allowed();
}

function checkRequestDeletable(app, record) {
  const dispatches = app.findRecordsByFilter(
    "dispatches",
    "request_id = {:id}",
    "",
    0,
    0,
    { id: record.id }
  );

  if (dispatches.length > 0) {
    const codes = dispatches.map((d) => d.get("code")).join(", ");
    return blocked(
      "Esta solicitud ya tiene despacho(s) asociado(s) (" +
        codes +
        "). Elimina primero el despacho — si ya tiene una entrega " +
        "confirmada, esta solicitud no se puede eliminar."
    );
  }

  const items = app.findRecordsByFilter(
    "request_items",
    "request_id = {:id}",
    "",
    0,
    0,
    { id: record.id }
  );

  const activeReservations = countActiveReservations(app, items.map((i) => i.id));
  if (activeReservations > 0) {
    return blocked(
      "Esta solicitud tiene " +
        activeReservations +
        " reserva(s) activa(s) o ya consumida(s) de inventario. Cancélala " +
        "primero (libera lo reservado) antes de eliminarla."
    );
  }

  return allowed();
}

function checkRequestItemDeletable(app, record) {
  const activeReservations = countActiveReservations(app, [record.id]);

  if (activeReservations > 0) {
    return blocked(
      "Este renglón tiene una reserva activa o ya consumida de inventario, " +
        "así que no se puede editar ni eliminar desde aquí. Cancela la " +
        "solicitud para liberarla."
    );
  }

  return allowed();
}

function countActiveReservations(app, requestItemIds) {
  if (requestItemIds.length === 0) {
    return 0;
  }

  const clauses = [];
  const params = {};
  requestItemIds.forEach((id, index) => {
    const key = "item" + index;
    clauses.push("request_item_id = {:" + key + "}");
    params[key] = id;
  });

  const filter =
    "(" + clauses.join(" || ") + ') && (status = "activa" || status = "consumida")';

  return app.findRecordsByFilter("reservations", filter, "", 0, 0, params).length;
}

function checkDispatchDeletable(app, record) {
  const deliveries = app.findRecordsByFilter(
    "deliveries",
    "dispatch_id = {:id}",
    "",
    0,
    0,
    { id: record.id }
  );

  if (deliveries.length > 0) {
    return blocked(
      "Este despacho ya tiene una entrega registrada. No se puede eliminar " +
        "un despacho que ya se entregó."
    );
  }

  return allowed();
}

// Igual que checkDeletable, pero para la ruta de EDITAR
// (11_edit_delete_with_reason.pb.js): un app.save() ahí tampoco
// dispara los hooks de 03_inventory.pb.js, así que si se dejara
// cambiar `quantity`/`product_id`/etc. de un donation_item que ya
// afectó inventory (o el `quantity_requested` de un request_item con
// una reserva detrás), el dato quedaría mintiendo sobre lo que la
// reserva o el movimiento en verdad representan, sin que nada lo
// note. Mismo criterio que ya usan los hooks para bloquear esto en un
// PATCH crudo — aquí se repite porque esta ruta nunca pasa por ahí.
function checkEditable(app, collectionName, record) {
  switch (collectionName) {
    case "donation_items":
      return checkDonationItemDeletable(record);
    case "request_items":
      return checkRequestItemDeletable(app, record);
    default:
      return allowed();
  }
}

module.exports = {
  checkDeletable: checkDeletable,
  checkEditable: checkEditable,
};
