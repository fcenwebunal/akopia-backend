// ─────────────────────────────────────────────────────────────
// 11_edit_delete_with_reason.pb.js — Editar y eliminar con motivo
// obligatorio, solo admin/coordinación
//
// Tres rutas nuevas, config-driven por EDITABLE_RECORDS
// (utils/config.js):
//
//   POST /api/records/{collection}/{id}/edit
//   GET  /api/records/{collection}/{id}/delete-check
//   POST /api/records/{collection}/{id}/delete
//
// Por qué una ruta propia y no dejar que la regla declarativa de cada
// colección resuelva esto: una `updateRule`/`deleteRule` no puede
// exigir "un motivo de al menos 5 caracteres" ni "solo si no hay
// dependencias" — eso es lógica, no una expresión de filtro. Mismo
// motivo por el que ya existen `approve`/`reject`/`cancel`/`relocate`
// en 05_routes.pb.js.
//
// OJO, la misma trampa que ya documenta ese archivo: un app.save()/
// app.delete() aquí dentro NO dispara los hooks de petición de
// 03_inventory.pb.js ni de 04_audit.pb.js — por diseño, en este caso.
// EDITABLE_RECORDS[x].fields nunca incluye un campo que le importe a
// esos hooks (status, classification_status, cantidades que ya
// afectaron inventario...), así que no hace falta que se disparen. El
// registro de auditoría lo escribe esta misma ruta, a mano, con el
// motivo como `notes` — el mismo campo que `adjustments.reason` ya
// usaba para esto, ahora aplicado también aquí.
//
// `donations`/`donation_items`/`requests`/`request_items`/`dispatches`/
// `deliveries` quedan con `deleteRule: null` desde la migración 054:
// el borrado real SOLO pasa por aquí, nunca por un DELETE crudo a la
// API generada. `products`/`categories`/`groups`/`locations`/`kits` ya
// tenían `deleteRule: null` desde que se crearon (nada en el catálogo
// se borra, se desactiva) — aquí "eliminar" para esas cinco es
// `active: false`, con motivo y rastro en vez de un interruptor
// silencioso.
// ─────────────────────────────────────────────────────────────

// ── POST /api/records/{collection}/{id}/edit ───────────────────
routerAdd("POST", "/api/records/{collection}/{id}/edit", (e) => {
  const { requireRole, loadRecord } = require(`${__hooks}/utils/routes.js`);
  const { EDITABLE_RECORDS } = require(`${__hooks}/utils/config.js`);
  const { createAuditLog } = require(`${__hooks}/utils/helpers.js`);
  const { checkEditable } = require(`${__hooks}/utils/dependencies.js`);

  const collectionName = e.request.pathValue("collection");
  const recordId = e.request.pathValue("id");
  const operator = requireRole(e, ["admin", "coordinacion"]);

  const config = EDITABLE_RECORDS[collectionName];
  if (!config) {
    throw new NotFoundError("Esta colección no admite edición justificada.");
  }

  // `changes` viaja como texto JSON, no como campo objeto de
  // DynamicModel: un campo `{}` no se vincula a un objeto plano de JS
  // (goja lo envuelve en un valor de Go con métodos get/set/value, no
  // las claves reales — confirmado probando contra un servidor real
  // antes de dejar esto así). Un campo string sí es un valor probado
  // en el resto del proyecto (05_routes.pb.js lo usa en cada ruta).
  const body = new DynamicModel({ reason: "", changes: "" });
  e.bindBody(body);

  const reason = (body.reason || "").trim();
  if (reason.length < 5) {
    throw new BadRequestError("El motivo es obligatorio (mínimo 5 caracteres).");
  }

  let changes;
  try {
    changes = JSON.parse(body.changes || "{}");
  } catch (err) {
    throw new BadRequestError("El campo 'changes' debe ser un JSON válido.");
  }
  const keys = Object.keys(changes);
  if (keys.length === 0) {
    throw new BadRequestError("No hay ningún cambio que guardar.");
  }

  const invalid = [];
  for (let i = 0; i < keys.length; i++) {
    if (config.fields.indexOf(keys[i]) === -1) {
      invalid.push(keys[i]);
    }
  }
  if (invalid.length > 0) {
    throw new BadRequestError(
      "Estos campos no se pueden editar desde aquí porque ya afectan el " +
        "inventario o un flujo de trabajo propio: " +
        invalid.join(", ") +
        ". Usa la acción correspondiente (clasificar, aprobar/rechazar, " +
        "cancelar, confirmar entrega, o un ajuste de inventario) para " +
        "cambiarlos."
    );
  }

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const record = loadRecord(txApp, collectionName, recordId);

    const editCheck = checkEditable(txApp, collectionName, record);
    if (editCheck.blocked) {
      throw new BadRequestError(editCheck.reason);
    }

    const diff = [];
    for (let i = 0; i < keys.length; i++) {
      const field = keys[i];
      const before = record.get(field);
      const after = changes[field];
      record.set(field, after);
      diff.push({ field: field, old_value: before, new_value: after });
    }

    txApp.save(record);

    createAuditLog(
      txApp,
      collectionName,
      record.id,
      "update",
      { changes: diff },
      operator.id,
      reason
    );

    payload = { id: record.id, updated_fields: keys };
  });

  return e.json(200, payload);
}, $apis.requireAuth());

// ── GET /api/records/{collection}/{id}/delete-check ────────────
// Adelanta si el borrado va a ser posible ANTES de pedir el motivo —
// para no hacer escribir una justificación completa y recién ahí
// avisar que no se puede.
routerAdd("GET", "/api/records/{collection}/{id}/delete-check", (e) => {
  const { requireRole, loadRecord } = require(`${__hooks}/utils/routes.js`);
  const { EDITABLE_RECORDS } = require(`${__hooks}/utils/config.js`);
  const { checkDeletable } = require(`${__hooks}/utils/dependencies.js`);

  const collectionName = e.request.pathValue("collection");
  const recordId = e.request.pathValue("id");
  requireRole(e, ["admin", "coordinacion"]);

  const config = EDITABLE_RECORDS[collectionName];
  if (!config) {
    throw new NotFoundError("Esta colección no admite eliminación justificada.");
  }

  const record = loadRecord(e.app, collectionName, recordId);

  if (config.mode === "deactivate") {
    return e.json(200, { blocked: false, mode: "deactivate" });
  }

  const result = checkDeletable(e.app, collectionName, record);
  return e.json(200, {
    blocked: result.blocked,
    reason: result.reason || null,
    mode: "delete",
  });
}, $apis.requireAuth());

// ── POST /api/records/{collection}/{id}/delete ──────────────────
routerAdd("POST", "/api/records/{collection}/{id}/delete", (e) => {
  const { requireRole, loadRecord } = require(`${__hooks}/utils/routes.js`);
  const { EDITABLE_RECORDS, AUDIT_FIELDS } = require(`${__hooks}/utils/config.js`);
  const { checkDeletable } = require(`${__hooks}/utils/dependencies.js`);
  const { createAuditLog } = require(`${__hooks}/utils/helpers.js`);

  const collectionName = e.request.pathValue("collection");
  const recordId = e.request.pathValue("id");
  const operator = requireRole(e, ["admin", "coordinacion"]);

  const config = EDITABLE_RECORDS[collectionName];
  if (!config) {
    throw new NotFoundError("Esta colección no admite eliminación justificada.");
  }

  const body = new DynamicModel({ reason: "" });
  e.bindBody(body);

  const reason = (body.reason || "").trim();
  if (reason.length < 5) {
    throw new BadRequestError("El motivo es obligatorio (mínimo 5 caracteres).");
  }

  const snapshotFields = AUDIT_FIELDS[collectionName] || config.fields;

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const record = loadRecord(txApp, collectionName, recordId);

    const snapshot = {};
    for (let i = 0; i < snapshotFields.length; i++) {
      snapshot[snapshotFields[i]] = record.get(snapshotFields[i]);
    }

    if (config.mode === "deactivate") {
      record.set("active", false);
      txApp.save(record);

      createAuditLog(
        txApp,
        collectionName,
        record.id,
        "delete",
        { mode: "deactivate", snapshot: snapshot },
        operator.id,
        reason
      );

      payload = { id: record.id, mode: "deactivate" };
      return;
    }

    const check = checkDeletable(txApp, collectionName, record);
    if (check.blocked) {
      throw new BadRequestError(check.reason);
    }

    // Las cascadas nativas de PocketBase (donation_items al borrar
    // donations; request_items -> reservations al borrar requests) solo
    // alcanzan aquí registros que checkDeletable() ya confirmó que no
    // afectan inventario, así que la cascada no puede desincronizar nada.
    txApp.delete(record);

    createAuditLog(
      txApp,
      collectionName,
      recordId,
      "delete",
      { mode: "hard_delete", snapshot: snapshot },
      operator.id,
      reason
    );

    payload = { id: recordId, mode: "hard_delete" };
  });

  return e.json(200, payload);
}, $apis.requireAuth());
