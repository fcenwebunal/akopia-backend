// ─────────────────────────────────────────────────────────────
// 08_request_items_guard.pb.js — Consistencia de unidad al pedir
//
// `donation_items` ya exige que su `unit_id` sea el mismo
// `default_unit_id` del producto (03_inventory.pb.js) — una sola unidad
// por producto, decisión heredada del catálogo. `request_items` nunca
// tuvo el mismo resguardo: nada impedía pedir arroz "en libras" cuando
// el producto se lleva en kilogramos, lo que habría hecho que
// `quantity_requested` y `available_qty` dejaran de ser comparables
// entre sí sin que nadie lo notara hasta la aprobación.
//
// Sin efecto en inventario (a diferencia de los hooks de
// 03_inventory.pb.js): request_items no mueve ningún saldo por sí solo,
// así que esto no necesita transacción ni rebind de `e.app`.
// ─────────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  const product = e.app.findRecordById("products", e.record.get("product_id"));

  if (product.get("default_unit_id") !== e.record.get("unit_id")) {
    throw new BadRequestError(
      "La unidad debe coincidir con la unidad predeterminada del producto"
    );
  }

  e.next();
}, "request_items");
