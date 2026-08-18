// ─────────────────────────────────────────────────────────────
// 05_routes.pb.js — Rutas propias para los flujos de varios pasos
//
// La API REST de PocketBase resuelve bien el CRUD, pero hay operaciones
// que tocan varias colecciones y tienen que ocurrir enteras o no ocurrir.
// Aprobar una solicitud son siete llamadas si se hace desde el cliente:
// si la cuarta falla, la solicitud queda aprobada con media reserva y el
// inventario comprometido a medias.
//
// Cada ruta de aquí envuelve todo en una transacción, así que el cliente
// recibe éxito completo o error completo.
//
// OJO: los hooks de 03_inventory.pb.js son de PETICIÓN — no se disparan
// cuando aquí se guarda con app.save(). Por eso el efecto en inventario
// se aplica llamando a las operaciones de utils/helpers.js, que son las
// mismas que usan los hooks.
// ─────────────────────────────────────────────────────────────

// ── POST /api/requests/{id}/approve ──────────────────────────
// Aprueba una solicitud y reserva el inventario de todos sus renglones.
routerAdd("POST", "/api/requests/{id}/approve", (e) => {
  const { requireAdmin, loadRequest } = require(`${__hooks}/utils/routes.js`);
  const { reserveInventory, findInventory } = require(`${__hooks}/utils/helpers.js`);

  const requestId = e.request.pathValue("id");
  const operator = requireAdmin(e);

  const body = new DynamicModel({ notes: "" });
  try {
    e.bindBody(body);
  } catch (err) {
    // Cuerpo vacío es válido: las notas son opcionales.
  }

  loadRequest(e.app, requestId, "pendiente");

  const items = e.app.findRecordsByFilter(
    "request_items",
    "request_id = {:requestId}",
    "created",
    0,
    0,
    { requestId: requestId }
  );

  if (items.length === 0) {
    throw new BadRequestError("La solicitud no tiene artículos que aprobar");
  }

  // Se comprueba TODO antes de abrir la transacción. Reservar a medias y
  // descubrir después que falta un producto dejaría stock comprometido
  // para una solicitud que no se puede atender.
  //
  // Va fuera de la transacción para poder responder con el detalle de qué
  // falta: el segundo argumento de BadRequestError lo interpreta
  // PocketBase como errores de validación por campo, así que un objeto
  // propio se pierde por el camino. La comprobación se repite igualmente
  // dentro, al mover cada saldo.
  const missing = [];
  const plan = [];

  for (const item of items) {
    const quantity = item.get("quantity_requested");
    const product = e.app.findRecordById("products", item.get("product_id"));
    const inventory = findInventory(e.app, item.get("product_id"), item.get("location_id"));
    const available = inventory ? inventory.get("available_qty") : 0;

    if (available < quantity) {
      missing.push({
        request_item_id: item.id,
        product: product.get("name"),
        requested: quantity,
        available: available,
        shortage: quantity - available,
      });
      continue;
    }

    plan.push({ item: item, inventory: inventory, quantity: quantity, product: product });
  }

  if (missing.length > 0) {
    return e.json(400, {
      status: 400,
      message: "Inventario insuficiente para completar la solicitud",
      missing: missing,
    });
  }

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const request = loadRequest(txApp, requestId, "pendiente");
    const reservations = [];
    for (const step of plan) {
      // Se relee dentro de la transacción: el plan se armó fuera, y otro
      // operador pudo mover el saldo entretanto. Si ya no alcanza,
      // updateInventoryQuantities lanza y se revierte todo.
      const inventory = txApp.findRecordById("inventory", step.inventory.id);

      const reservation = reserveInventory(
        txApp,
        step.item.id,
        inventory,
        step.quantity,
        operator.id
      );

      step.item.set("status", "reservado");
      txApp.save(step.item);

      reservations.push({
        id: reservation.id,
        product: step.product.get("name"),
        quantity: step.quantity,
      });
    }

    request.set("status", "aprobada");
    request.set("approved_by", operator.id);
    request.set("approved_at", new Date().toISOString());
    if (body.notes) {
      request.set("notes", body.notes);
    }
    txApp.save(request);

    payload = {
      request: { id: request.id, code: request.get("code"), status: "aprobada" },
      reservations: reservations,
    };
  });

  return e.json(200, payload);
}, $apis.requireAuth());

// ── POST /api/requests/{id}/reject ───────────────────────────
routerAdd("POST", "/api/requests/{id}/reject", (e) => {
  const { requireAdmin, loadRequest } = require(`${__hooks}/utils/routes.js`);

  const requestId = e.request.pathValue("id");
  requireAdmin(e);

  const body = new DynamicModel({ reason: "" });
  e.bindBody(body);

  if (!body.reason) {
    throw new BadRequestError("Se requiere un motivo para rechazar la solicitud");
  }

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const request = loadRequest(txApp, requestId, "pendiente");

    request.set("status", "rechazada");
    request.set("rejection_reason", body.reason);
    txApp.save(request);

    payload = { id: request.id, code: request.get("code"), status: "rechazada" };
  });

  return e.json(200, payload);
}, $apis.requireAuth());

// ── POST /api/requests/{id}/cancel ───────────────────────────
// Cancela y libera todas las reservas activas: el stock vuelve a disponible.
routerAdd("POST", "/api/requests/{id}/cancel", (e) => {
  const { requireOperator, loadRequest } = require(`${__hooks}/utils/routes.js`);
  const { closeReservation, findActiveReservations } = require(`${__hooks}/utils/helpers.js`);

  const requestId = e.request.pathValue("id");
  const operator = requireOperator(e);

  const body = new DynamicModel({ reason: "" });
  e.bindBody(body);

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const request = loadRequest(txApp, requestId);
    const status = request.get("status");

    if (status === "entregada" || status === "cancelada") {
      throw new BadRequestError(
        "No se puede cancelar una solicitud " + status
      );
    }

    const reservations = findActiveReservations(txApp, requestId);
    for (const reservation of reservations) {
      closeReservation(txApp, reservation, "liberada", operator.id);
    }

    request.set("status", "cancelada");
    if (body.reason) {
      request.set("rejection_reason", body.reason);
    }
    txApp.save(request);

    payload = {
      id: request.id,
      code: request.get("code"),
      status: "cancelada",
      released_reservations: reservations.length,
    };
  });

  return e.json(200, payload);
}, $apis.requireAuth());

// ── GET /api/requests/{id}/availability ──────────────────────
// Qué se puede atender de la solicitud, antes de aprobarla.
routerAdd("GET", "/api/requests/{id}/availability", (e) => {
  const { requireOperator, loadRequest } = require(`${__hooks}/utils/routes.js`);
  const { findInventory } = require(`${__hooks}/utils/helpers.js`);

  const requestId = e.request.pathValue("id");
  requireOperator(e);

  loadRequest(e.app, requestId);

  const items = e.app.findRecordsByFilter(
    "request_items",
    "request_id = {:requestId}",
    "created",
    0,
    0,
    { requestId: requestId }
  );

  const detail = [];
  let allAvailable = true;

  for (const item of items) {
    const product = e.app.findRecordById("products", item.get("product_id"));
    const inventory = findInventory(e.app, item.get("product_id"), item.get("location_id"));
    const available = inventory ? inventory.get("available_qty") : 0;
    const requested = item.get("quantity_requested");
    const sufficient = available >= requested;

    if (!sufficient) {
      allAvailable = false;
    }

    const row = {
      request_item_id: item.id,
      product_name: product.get("name"),
      quantity_requested: requested,
      available_qty: available,
      sufficient: sufficient,
    };

    if (!sufficient) {
      row.shortage = requested - available;
    }

    detail.push(row);
  }

  return e.json(200, {
    request_id: requestId,
    items: detail,
    all_available: allAvailable,
  });
}, $apis.requireAuth());

// ── GET /api/inventory/summary ───────────────────────────────
// Inventario agregado por producto, con sus totales.
routerAdd("GET", "/api/inventory/summary", (e) => {
  const { requireOperator } = require(`${__hooks}/utils/routes.js`);

  requireOperator(e);

  const rows = e.app.findRecordsByFilter("inventory", "", "-total_qty", 0, 0);

  const byProduct = {};
  const totals = {
    total_products: 0,
    total_available: 0,
    total_reserved: 0,
    total_quarantine: 0,
    below_minimum_count: 0,
  };

  for (const row of rows) {
    const productId = row.get("product_id");

    if (!byProduct[productId]) {
      const product = e.app.findRecordById("products", productId);
      const category = e.app.findRecordById("categories", product.get("category_id"));
      const unit = e.app.findRecordById("units", product.get("default_unit_id"));

      byProduct[productId] = {
        product_id: productId,
        product_name: product.get("name"),
        category: category.get("name"),
        unit: unit.get("name"),
        min_stock_alert: product.get("min_stock_alert") || 0,
        total_qty: 0,
        available_qty: 0,
        reserved_qty: 0,
        quarantine_qty: 0,
        below_minimum: false,
      };
    }

    const entry = byProduct[productId];
    entry.available_qty += row.get("available_qty") || 0;
    entry.reserved_qty += row.get("reserved_qty") || 0;
    entry.quarantine_qty += row.get("quarantine_qty") || 0;
    entry.total_qty += row.get("total_qty") || 0;
  }

  const summary = [];
  for (const productId in byProduct) {
    const entry = byProduct[productId];
    entry.below_minimum =
      entry.min_stock_alert > 0 && entry.available_qty < entry.min_stock_alert;

    totals.total_products += 1;
    totals.total_available += entry.available_qty;
    totals.total_reserved += entry.reserved_qty;
    totals.total_quarantine += entry.quarantine_qty;
    if (entry.below_minimum) {
      totals.below_minimum_count += 1;
    }

    summary.push(entry);
  }

  summary.sort((a, b) => b.total_qty - a.total_qty);

  return e.json(200, { summary: summary, totals: totals });
}, $apis.requireAuth());

// ── GET /api/requests/missing-products ────────────────────────
// Demanda sin cubrir: por cada producto, cuánto piden las solicitudes
// que siguen sin decidirse (`pendiente`) frente a lo que hay disponible
// en TODA la bodega — no solo en un renglón. Una vez que una solicitud
// se aprueba, lo que necesitaba ya se reservó, así que deja de contar
// como faltante.
//
// Sin datos de quién pide ni para qué: solo producto, categoría y
// cuánto falta. Es deliberado — esta ruta es la que en algún momento
// va a alimentar una vista pública (qué donar), y ese dato no debe
// llevar nada del solicitante. Hoy exige sesión como el resto de la
// API; abrirla al público es quitar `requireOperator` y el segundo
// argumento de `routerAdd`, nada más — la forma de la respuesta ya es
// segura de mostrar afuera.
//
// No reutiliza `findInventory` (que busca una ubicación a la vez, y a
// la que `request_items` nunca le pasa una real: ese campo no existe en
// su esquema) — aquí se suma `available_qty` de todas las ubicaciones
// de cada producto, que es lo que corresponde para saber si alcanza.
routerAdd("GET", "/api/requests/missing-products", (e) => {
  const { requireOperator } = require(`${__hooks}/utils/routes.js`);

  requireOperator(e);

  const pendingItems = e.app.findRecordsByFilter(
    "request_items",
    "request_id.status = 'pendiente'",
    "",
    0,
    0
  );

  if (pendingItems.length === 0) {
    return e.json(200, { items: [] });
  }

  const requestedByProduct = {};
  for (const item of pendingItems) {
    const productId = item.get("product_id");
    requestedByProduct[productId] =
      (requestedByProduct[productId] || 0) + item.get("quantity_requested");
  }

  const availableByProduct = {};
  const inventoryRows = e.app.findRecordsByFilter("inventory", "", "", 0, 0);
  for (const row of inventoryRows) {
    const productId = row.get("product_id");
    availableByProduct[productId] =
      (availableByProduct[productId] || 0) + (row.get("available_qty") || 0);
  }

  const items = [];
  for (const productId in requestedByProduct) {
    const requested = requestedByProduct[productId];
    const available = availableByProduct[productId] || 0;
    const missing = requested - available;

    if (missing <= 0) {
      continue;
    }

    const product = e.app.findRecordById("products", productId);
    const category = e.app.findRecordById("categories", product.get("category_id"));
    const unit = e.app.findRecordById("units", product.get("default_unit_id"));

    items.push({
      product_id: productId,
      product_name: product.get("name"),
      category_name: category.get("name"),
      unit: unit.get("code") || unit.get("name"),
      requested_qty: requested,
      available_qty: available,
      missing_qty: missing,
    });
  }

  items.sort((a, b) => b.missing_qty - a.missing_qty);

  return e.json(200, { items: items });
}, $apis.requireAuth());

// ── POST /api/dispatches/{id}/confirm-delivery ───────────────
// Cierra el ciclo: registra la entrega y saca de bodega lo entregado.
routerAdd("POST", "/api/dispatches/{id}/confirm-delivery", (e) => {
  const { requireOperator } = require(`${__hooks}/utils/routes.js`);
  const { closeReservation, findActiveReservations } = require(`${__hooks}/utils/helpers.js`);

  const dispatchId = e.request.pathValue("id");
  const operator = requireOperator(e);

  const body = new DynamicModel({
    receiver_name: "",
    receiver_phone: "",
    receiver_id_type: "",
    receiver_id_number: "",
    delivery_date: "",
    status: "",
    notes: "",
  });
  e.bindBody(body);

  if (!body.receiver_name) {
    throw new BadRequestError("Se requiere el nombre de quien recibe");
  }

  const DELIVERY_STATUSES = ["entregado", "parcial", "no_entregado"];
  if (DELIVERY_STATUSES.indexOf(body.status) === -1) {
    throw new BadRequestError(
      "El estado de la entrega debe ser: " + DELIVERY_STATUSES.join(", ")
    );
  }

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const dispatch = txApp.findRecordById("dispatches", dispatchId);
    const requestId = dispatch.get("request_id");
    const request = txApp.findRecordById("requests", requestId);

    if (request.get("status") === "entregada") {
      throw new BadRequestError("Esta solicitud ya fue entregada");
    }

    const collection = txApp.findCollectionByNameOrId("deliveries");
    const delivery = new Record(collection);
    delivery.set("dispatch_id", dispatchId);
    delivery.set("receiver_name", body.receiver_name);
    delivery.set("receiver_phone", body.receiver_phone);
    delivery.set("receiver_id_type", body.receiver_id_type);
    delivery.set("receiver_id_number", body.receiver_id_number);
    delivery.set("delivery_date", body.delivery_date || new Date().toISOString());
    delivery.set("status", body.status);
    delivery.set("notes", body.notes);
    delivery.set("operator_id", operator.id);
    txApp.save(delivery);

    // Lo entregado sale de bodega (`salida`). Lo que no se entregó nunca
    // salió físicamente: la reserva se libera y el stock vuelve a estar
    // disponible, sin inventar ni destruir existencias.
    const closeAs = body.status === "no_entregado" ? "liberada" : "consumida";

    const reservations = findActiveReservations(txApp, requestId);
    for (const reservation of reservations) {
      closeReservation(txApp, reservation, closeAs, operator.id);
    }

    const items = txApp.findRecordsByFilter(
      "request_items",
      "request_id = {:requestId}",
      "created",
      0,
      0,
      { requestId: requestId }
    );
    const itemStatus = body.status === "no_entregado" ? "no_disponible" : "entregado";
    for (const item of items) {
      item.set("status", itemStatus);
      txApp.save(item);
    }

    request.set("status", body.status === "no_entregado" ? "cancelada" : "entregada");
    txApp.save(request);

    payload = {
      delivery_id: delivery.id,
      request: { id: request.id, code: request.get("code"), status: request.get("status") },
      closed_reservations: reservations.length,
      closed_as: closeAs,
    };
  });

  return e.json(200, payload);
}, $apis.requireAuth());

// ── POST /api/inventory/{id}/relocate ─────────────────────────
// Mueve cantidad disponible del renglón de inventario {id} a otra
// ubicación (o se la asigna por primera vez si estaba sin ubicar).
// No cambia el `donation_item` original: ese sigue contando de dónde
// vino la mercancía, esto solo mueve dónde está guardada ahora.
routerAdd("POST", "/api/inventory/{id}/relocate", (e) => {
  const { requireOperator } = require(`${__hooks}/utils/routes.js`);
  const { relocateInventory } = require(`${__hooks}/utils/helpers.js`);

  const inventoryId = e.request.pathValue("id");
  const operator = requireOperator(e);

  const body = new DynamicModel({
    location_id: "",
    quantity: 0,
    notes: "",
  });
  e.bindBody(body);

  if (!(body.quantity > 0)) {
    throw new BadRequestError("La cantidad a reubicar debe ser mayor que cero");
  }

  let payload = null;

  e.app.runInTransaction((txApp) => {
    const source = txApp.findRecordById("inventory", inventoryId);

    const destination = relocateInventory(
      txApp, source, body.location_id, body.quantity, operator.id, body.notes
    );

    payload = {
      source: { id: source.id, available_qty: source.get("available_qty") },
      destination: {
        id: destination.id,
        location_id: destination.get("location_id"),
        available_qty: destination.get("available_qty"),
      },
    };
  });

  return e.json(200, payload);
}, $apis.requireAuth());
