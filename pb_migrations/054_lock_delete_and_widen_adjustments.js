// Edición y eliminación con motivo obligatorio, solo admin/
// coordinación (11_edit_delete_with_reason.pb.js). Dos cambios de
// reglas para que ese sea el ÚNICO camino real:
//
// 1. `donations`/`donation_items`/`requests`/`request_items`/
//    `dispatches`/`deliveries` pierden su `deleteRule` (hoy
//    admin-solo). Un DELETE crudo contra esas seis colecciones dejaba
//    borrar en cascada (`donation_items` de `donations`,
//    `request_items` -> `reservations` de `requests`) sin revisar
//    dependencias, sin motivo obligatorio y sin dejar rastro en
//    Historial: 04_audit.pb.js nunca tuvo un handler de borrado. A
//    partir de aquí el borrado real SOLO pasa por
//    POST /api/records/{collection}/{id}/delete, que sí revisa
//    dependencias antes de tocar nada.
//
// 2. `adjustments` se abre a Coordinación además de Administrador.
//    Es el camino que la nueva ruta de edición señala cuando alguien
//    intenta cambiar una cantidad que ya afectó inventario ("usa un
//    ajuste de inventario") — dejarlo solo para admin habría hecho
//    ese mensaje un callejón sin salida para Coordinación, uno de los
//    dos roles a los que se les está dando esta capacidad.
//
// Sintaxis de roles: `role:each ?= "valor"` — la misma que ya
// verificó y dejó vigente la migración 050 contra 2+ roles a la vez.
// No se usa `role:each = "valor" || ...` (la forma que 050 corrigió).

function role(r) {
  return '@request.auth.role:each ?= "' + r + '"'
}
function anyRole() {
  const roles = Array.prototype.slice.call(arguments)
  return "(" + roles.map(role).join(" || ") + ")"
}
const ACTIVE = "@request.auth.active = true"

const OLD_DELETE_RULE = role("admin") + " && " + ACTIVE
const NEW_ADJUSTMENTS_RULE = anyRole("admin", "coordinacion") + " && " + ACTIVE
const OLD_ADJUSTMENTS_RULE = role("admin") + " && " + ACTIVE

const LOCKED_COLLECTIONS = [
  "donations",
  "donation_items",
  "requests",
  "request_items",
  "dispatches",
  "deliveries",
]

migrate((app) => {
  for (const name of LOCKED_COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    collection.deleteRule = null
    app.save(collection)
  }

  const adjustments = app.findCollectionByNameOrId("adjustments")
  adjustments.listRule = NEW_ADJUSTMENTS_RULE
  adjustments.viewRule = NEW_ADJUSTMENTS_RULE
  adjustments.createRule = NEW_ADJUSTMENTS_RULE
  adjustments.updateRule = NEW_ADJUSTMENTS_RULE
  app.save(adjustments)
}, (app) => {
  for (const name of LOCKED_COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    collection.deleteRule = OLD_DELETE_RULE
    app.save(collection)
  }

  const adjustments = app.findCollectionByNameOrId("adjustments")
  adjustments.listRule = OLD_ADJUSTMENTS_RULE
  adjustments.viewRule = OLD_ADJUSTMENTS_RULE
  adjustments.createRule = OLD_ADJUSTMENTS_RULE
  adjustments.updateRule = OLD_ADJUSTMENTS_RULE
  app.save(adjustments)
})
