// Corrige un bug real de PocketBase encontrado el 21 de agosto probando
// una cuenta real con dos roles a la vez (Coordinación + Voluntariado):
// dejó de ver Usuarios, Solicitudes, Donaciones, Despachos, Historial y
// Kits — todo lo que decide con `@request.auth.role:each = "x" || ...`.
//
// `role:each = "x"` (sin `?=`) es la sintaxis que la migración 045
// verificó contra un servidor de prueba real — pero esa prueba usó una
// cuenta de UN SOLO rol. Con dos o más roles en el arreglo, esa misma
// sintaxis deja de encontrar coincidencias: verificado de forma
// controlada en producción (una cuenta de prueba con un solo rol veía
// todo bien; agregarle un segundo rol, sin tocar nada más, la dejaba
// sin ver nada; devolverla a un solo rol la arreglaba de nuevo).
//
// La forma que sí funciona con cualquier cantidad de roles, probada
// contra una colección desechable antes de aplicarla aquí:
// `role:each ?= "x"` — combinando los dos modificadores. Ninguna otra
// combinación probada (`?=` sola, `:each` sola, `:each` + `||`) dio el
// resultado correcto para un arreglo de 2+ elementos.
//
// Aplicado primero en caliente contra el servidor de la UNAL (con este
// mismo texto, colección por colección) y verificado con la cuenta real
// que reportó el problema antes de escribir esta migración — así que
// esta migración documenta y reproduce un arreglo que ya se sabe que
// funciona, no uno nuevo sin probar.

function role(r) {
  return '@request.auth.role:each ?= "' + r + '"'
}

function anyRole() {
  const roles = Array.prototype.slice.call(arguments)
  return "(" + roles.map(role).join(" || ") + ")"
}

const ACTIVE = "@request.auth.active = true"

function adminOrOwner(owner) {
  return "(" + role("admin") + " || @request.auth.id = " + owner + ") && " + ACTIVE
}

function adminCoordOrOwner(owner) {
  return "(" + role("admin") + " || " + role("coordinacion") + " || @request.auth.id = " + owner + ") && " + ACTIVE
}

const INVENTORY_ROLES = ["admin", "coordinacion", "transporte_distribucion", "voluntariado", "salida"]
const CATALOG_RULE = anyRole.apply(null, INVENTORY_ROLES) + " && " + ACTIVE
const UNITS_RULE = anyRole("admin", "coordinacion") + " && " + ACTIVE

const DONATIONS_VIEW = anyRole("admin", "coordinacion", "voluntariado", "comunicaciones") + " && " + ACTIVE
const DONATIONS_CREATE = anyRole("admin", "voluntariado") + " && " + ACTIVE
const DONATIONS_DELETE = role("admin") + " && " + ACTIVE

const REQUESTS_VIEW = anyRole("admin", "coordinacion", "comunicaciones", "transporte_distribucion", "salida") + " && " + ACTIVE
const REQUESTS_CREATE = anyRole("admin", "coordinacion", "salida") + " && " + ACTIVE
const REQUESTS_DELETE = role("admin") + " && " + ACTIVE

const DISPATCHES_VIEW = REQUESTS_VIEW
const DISPATCHES_CREATE = anyRole("admin", "transporte_distribucion", "salida") + " && " + ACTIVE
const DISPATCHES_DELETE = role("admin") + " && " + ACTIVE

const ADJUSTMENTS_RULE = role("admin") + " && " + ACTIVE
const AUDIT_LOG_VIEW = anyRole("admin", "coordinacion", "comunicaciones") + " && " + ACTIVE

const USERS_LIST_VIEW = "(" + role("admin") + " || " + role("coordinacion") + ") && " + ACTIVE
const USERS_VIEW = "(" + role("admin") + " || " + role("coordinacion") + " || @request.auth.id = id) && " + ACTIVE
const USERS_CREATE = USERS_LIST_VIEW
const USERS_MANAGE = "(" + role("admin") + " || (" + role("coordinacion") + ' && role:each != "admin")) && ' + ACTIVE
const USERS_UPDATE = "(" + role("admin") + " || (" + role("coordinacion") + ' && role:each != "admin") || @request.auth.id = id) && ' + ACTIVE

const KIT_ROLES = anyRole("admin", "coordinacion", "salida") + " && " + ACTIVE

const RULES = {
  units: { create: UNITS_RULE, update: UNITS_RULE },
  groups: { create: CATALOG_RULE, update: CATALOG_RULE },
  categories: { create: CATALOG_RULE, update: CATALOG_RULE },
  products: { create: CATALOG_RULE, update: CATALOG_RULE },
  locations: { create: CATALOG_RULE, update: CATALOG_RULE },

  donations: { list: DONATIONS_VIEW, view: DONATIONS_VIEW, create: DONATIONS_CREATE, update: adminCoordOrOwner("operator_id"), remove: DONATIONS_DELETE },
  donation_items: { list: DONATIONS_VIEW, view: DONATIONS_VIEW, create: DONATIONS_CREATE, update: adminCoordOrOwner("donation_id.operator_id"), remove: DONATIONS_DELETE },

  requests: { list: REQUESTS_VIEW, view: REQUESTS_VIEW, create: REQUESTS_CREATE, update: adminCoordOrOwner("operator_id"), remove: REQUESTS_DELETE },
  request_items: { list: REQUESTS_VIEW, view: REQUESTS_VIEW, create: REQUESTS_CREATE, update: adminCoordOrOwner("request_id.operator_id"), remove: REQUESTS_DELETE },

  dispatches: { list: DISPATCHES_VIEW, view: DISPATCHES_VIEW, create: DISPATCHES_CREATE, update: adminOrOwner("operator_id"), remove: DISPATCHES_DELETE },
  deliveries: { list: DISPATCHES_VIEW, view: DISPATCHES_VIEW, create: DISPATCHES_CREATE, update: adminOrOwner("operator_id"), remove: DISPATCHES_DELETE },

  reservations: { update: adminOrOwner("operator_id") },
  preparations: { update: adminOrOwner("operator_id") },

  adjustments: { list: ADJUSTMENTS_RULE, view: ADJUSTMENTS_RULE, create: ADJUSTMENTS_RULE, update: ADJUSTMENTS_RULE },
  audit_log: { list: AUDIT_LOG_VIEW, view: AUDIT_LOG_VIEW },

  kits: { list: KIT_ROLES, view: KIT_ROLES, create: KIT_ROLES, update: KIT_ROLES },
  kit_items: { list: KIT_ROLES, view: KIT_ROLES, create: KIT_ROLES, update: KIT_ROLES, remove: KIT_ROLES },
}

function fieldMap(f) {
  return { list: "listRule", view: "viewRule", create: "createRule", update: "updateRule", remove: "deleteRule" }[f]
}

function apply(app, table) {
  for (const name of Object.keys(table)) {
    const collection = app.findCollectionByNameOrId(name)
    const patch = table[name]
    for (const key of Object.keys(patch)) {
      collection[fieldMap(key)] = patch[key]
    }
    app.save(collection)
  }
}

migrate(
  (app) => {
    apply(app, RULES)

    const users = app.findCollectionByNameOrId("users")
    users.listRule = USERS_LIST_VIEW
    users.viewRule = USERS_VIEW
    users.createRule = USERS_CREATE
    users.updateRule = USERS_UPDATE
    users.manageRule = USERS_MANAGE
    app.save(users)
  },
  (app) => {
    // Rollback intencionalmente NO restaura la sintaxis rota — sería
    // reintroducir a propósito un bug ya confirmado. Deja las reglas
    // corregidas tal como quedaron: revertir esta migración no debe
    // volver a romper el acceso multi-rol.
  }
)
