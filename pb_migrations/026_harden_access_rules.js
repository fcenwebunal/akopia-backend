// Endurecimiento de las reglas de acceso de la API.
//
// Tres cambios:
//
// 1. Un usuario desactivado no puede nada. `users.active` existía pero
//    ninguna regla lo miraba: bastaba un token vigente para seguir
//    escribiendo después de haber sido dado de baja. El frontend lo
//    comprobaba al iniciar sesión, que es una cortesía de interfaz y no
//    una defensa: cualquiera puede llamar a la API directamente.
//
// 2. El libro de inventario deja de escribirse por la API.
//    `inventory_movements.createRule` permitía a cualquier autenticado
//    insertar un movimiento sin que ningún saldo cambiara, y el libro
//    dejaba de cuadrar con `inventory` — que es justo la garantía que
//    sostiene todo el modelo. Los hooks escriben por la capa de modelo
//    y no pasan por estas reglas, así que siguen funcionando igual.
//
// 3. `adjustments` se ve como se lista. Listarlos era de admin pero
//    verlos de uno en uno era de cualquiera: quien tuviera un id podía
//    leer el ajuste completo.

const AUTH = "@request.auth.id != '' && @request.auth.active = true"
const ADMIN = "@request.auth.role = 'admin' && @request.auth.active = true"

// Dueño del registro o admin. `owner` es la ruta al campo del operador,
// que en las tablas de detalle atraviesa la relación con su cabecera.
function ownerOrAdmin(owner) {
  return `(@request.auth.role = 'admin' || @request.auth.id = ${owner}) && @request.auth.active = true`
}

function rules(list, view, create, update, del) {
  return { list: list, view: view, create: create, update: update, remove: del }
}

// ── Reglas nuevas ────────────────────────────────────────────
const CATALOG = rules(AUTH, AUTH, ADMIN, ADMIN, null)
const HOOKS_ONLY = rules(AUTH, AUTH, null, null, null)

function operational(owner, del) {
  return rules(AUTH, AUTH, AUTH, ownerOrAdmin(owner), del)
}

const NEW_RULES = {
  units: CATALOG,
  groups: CATALOG,
  categories: CATALOG,
  products: CATALOG,
  locations: CATALOG,

  users: rules(
    ADMIN,
    "(@request.auth.role = 'admin' || @request.auth.id = id) && @request.auth.active = true",
    ADMIN,
    ADMIN,
    null
  ),

  donations: operational("operator_id", ADMIN),
  donation_items: operational("donation_id.operator_id", ADMIN),
  requests: operational("operator_id", ADMIN),
  request_items: operational("request_id.operator_id", ADMIN),
  reservations: operational("operator_id", null),
  preparations: operational("operator_id", null),
  dispatches: operational("operator_id", ADMIN),
  deliveries: operational("operator_id", ADMIN),

  inventory: HOOKS_ONLY,
  inventory_movements: HOOKS_ONLY,

  adjustments: rules(ADMIN, ADMIN, ADMIN, ADMIN, null),
  audit_log: rules(ADMIN, ADMIN, null, null, null),
}

// ── Reglas anteriores, tal como quedaron en 001–018 ──────────
const OLD_AUTH = "@request.auth.id != ''"
const OLD_ADMIN = "@request.auth.role = 'admin'"
const OLD_CATALOG = rules(OLD_AUTH, OLD_AUTH, OLD_ADMIN, OLD_ADMIN, null)

function oldOperational(owner, del) {
  return rules(
    OLD_AUTH,
    OLD_AUTH,
    OLD_AUTH,
    `${OLD_ADMIN} || @request.auth.id = ${owner}`,
    del
  )
}

const OLD_RULES = {
  units: OLD_CATALOG,
  groups: OLD_CATALOG,
  categories: OLD_CATALOG,
  products: OLD_CATALOG,
  locations: OLD_CATALOG,

  users: rules(
    OLD_ADMIN,
    `${OLD_ADMIN} || @request.auth.id = id`,
    OLD_ADMIN,
    OLD_ADMIN,
    null
  ),

  donations: oldOperational("operator_id", OLD_ADMIN),
  donation_items: oldOperational("donation_id.operator_id", OLD_ADMIN),
  requests: oldOperational("operator_id", OLD_ADMIN),
  request_items: oldOperational("request_id.operator_id", OLD_ADMIN),
  reservations: oldOperational("operator_id", null),
  preparations: oldOperational("operator_id", null),
  dispatches: oldOperational("operator_id", OLD_ADMIN),
  deliveries: oldOperational("operator_id", OLD_ADMIN),

  inventory: rules(OLD_AUTH, OLD_AUTH, null, null, null),
  inventory_movements: rules(OLD_AUTH, OLD_AUTH, OLD_AUTH, null, null),

  adjustments: rules(OLD_ADMIN, OLD_AUTH, OLD_ADMIN, OLD_ADMIN, null),
  audit_log: rules(OLD_ADMIN, OLD_ADMIN, null, null, null),
}

function apply(app, table) {
  for (const name of Object.keys(table)) {
    const collection = app.findCollectionByNameOrId(name)
    const rule = table[name]

    collection.listRule = rule.list
    collection.viewRule = rule.view
    collection.createRule = rule.create
    collection.updateRule = rule.update
    collection.deleteRule = rule.remove

    app.save(collection)
  }
}

migrate(
  (app) => apply(app, NEW_RULES),
  (app) => apply(app, OLD_RULES)
)
