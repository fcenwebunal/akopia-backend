// Reglas de acceso según el sistema de roles múltiples (migración 044)
// y la matriz de permisos acordada con Juan Manuel. Sustituye el
// binario admin/operator de la migración 026 (y los ajustes puntuales
// de 033/035/037/038) por seis roles funcionales, cada uno restringido
// a su tarea real.
//
// Sintaxis verificada contra un servidor de prueba real, no solo
// contra la documentación: `campo:each = "valor"` es la forma correcta
// de comprobar pertenencia en un SelectField multi-valor — `campo =
// "valor"` (sin `:each`) y `campo ?= "valor"` NO funcionan contra un
// arreglo JSON, aunque parezcan la sintaxis más natural.
//
// La jerarquía de asignación de roles (quién puede subirle el rol a
// quién) no se puede expresar en una regla declarativa — vive en el
// hook 09_users_role_guard.pb.js, igual que 06_catalog_photo_guard.pb.js
// cubre lo que la regla de `products`/`categories`/`groups`/`locations`
// tampoco puede distinguir por sí sola ("solo cambió la foto").

const ACTIVE = "@request.auth.active = true"
const AUTH = "@request.auth.id != '' && " + ACTIVE

function role(r) {
  return '@request.auth.role:each = "' + r + '"'
}

function anyRole() {
  const roles = Array.prototype.slice.call(arguments)
  return "(" + roles.map(role).join(" || ") + ")"
}

function rules(list, view, create, update, del) {
  return { list: list, view: view, create: create, update: update, remove: del }
}

// Admin o dueño del registro (o de su cabecera, para tablas de
// detalle) — mismo patrón que ya usaba 026_harden_access_rules.js,
// ahora con `role:each` en vez de `role =`.
function adminOrOwner(owner) {
  return "(" + role("admin") + " || @request.auth.id = " + owner + ") && " + ACTIVE
}

// Igual que `adminOrOwner`, más Coordinación sobre cualquier registro
// — no solo el suyo. Coordinación decide sobre cuarentena/clasificación
// de CUALQUIER donación, no solo la que ella misma recibió (matriz de
// permisos: "Inventario — reubicar/liberar/rechazar cuarentena: G").
function adminCoordOrOwner(owner) {
  return "(" + role("admin") + " || " + role("coordinacion") + " || @request.auth.id = " + owner + ") && " + ACTIVE
}

// Roles que interactúan con inventario de verdad: pueden ampliar el
// catálogo y cambiar fotos de lo que ya existe (el hook 06 limita a
// solo `photo_url` a quien no sea admin/coordinación).
const INVENTORY_ROLES = ["admin", "coordinacion", "transporte_distribucion", "voluntariado", "salida"]
const CATALOG = rules(
  AUTH,
  AUTH,
  anyRole.apply(null, INVENTORY_ROLES) + " && " + ACTIVE,
  anyRole.apply(null, INVENTORY_ROLES) + " && " + ACTIVE,
  null
)

// `units` no se abrió a los roles operativos: no forma parte de lo
// pedido (nadie da de alta una unidad de medida en medio de una
// recepción) y sigue siendo de admin/coordinación, igual que editar o
// eliminar por completo cualquier otro renglón del catálogo.
const UNITS = rules(AUTH, AUTH, anyRole("admin", "coordinacion") + " && " + ACTIVE, anyRole("admin", "coordinacion") + " && " + ACTIVE, null)

const HOOKS_ONLY = rules(AUTH, AUTH, null, null, null)

const DONATIONS_VIEW = anyRole("admin", "coordinacion", "voluntariado", "comunicaciones") + " && " + ACTIVE
const DONATIONS_CREATE = anyRole("admin", "voluntariado") + " && " + ACTIVE
const DONATIONS = rules(DONATIONS_VIEW, DONATIONS_VIEW, DONATIONS_CREATE, adminOrOwner("operator_id"), role("admin") + " && " + ACTIVE)
const DONATION_ITEMS = rules(DONATIONS_VIEW, DONATIONS_VIEW, DONATIONS_CREATE, adminCoordOrOwner("donation_id.operator_id"), role("admin") + " && " + ACTIVE)

const REQUESTS_VIEW = anyRole("admin", "coordinacion", "comunicaciones", "transporte_distribucion", "salida") + " && " + ACTIVE
const REQUESTS_CREATE = anyRole("admin", "coordinacion", "salida") + " && " + ACTIVE
// Admin y Coordinación deciden sobre CUALQUIER solicitud (aprobar/
// rechazar/cancelar corren por rutas propias, pero la regla de la
// colección es la segunda línea de defensa para un PATCH directo);
// Salida y el resto solo tocan lo suyo.
const REQUESTS_UPDATE = "(" + role("admin") + " || " + role("coordinacion") + " || @request.auth.id = operator_id) && " + ACTIVE
const REQUESTS = rules(REQUESTS_VIEW, REQUESTS_VIEW, REQUESTS_CREATE, REQUESTS_UPDATE, role("admin") + " && " + ACTIVE)
const REQUEST_ITEMS_UPDATE = "(" + role("admin") + " || " + role("coordinacion") + " || @request.auth.id = request_id.operator_id) && " + ACTIVE
const REQUEST_ITEMS = rules(REQUESTS_VIEW, REQUESTS_VIEW, REQUESTS_CREATE, REQUEST_ITEMS_UPDATE, role("admin") + " && " + ACTIVE)

const DISPATCHES_VIEW = anyRole("admin", "coordinacion", "comunicaciones", "transporte_distribucion", "salida") + " && " + ACTIVE
const DISPATCHES_CREATE = anyRole("admin", "transporte_distribucion", "salida") + " && " + ACTIVE
const DISPATCHES = rules(DISPATCHES_VIEW, DISPATCHES_VIEW, DISPATCHES_CREATE, adminOrOwner("operator_id"), role("admin") + " && " + ACTIVE)
const DELIVERIES = rules(DISPATCHES_VIEW, DISPATCHES_VIEW, DISPATCHES_CREATE, adminOrOwner("operator_id"), role("admin") + " && " + ACTIVE)

// Reservas y preparaciones: tablas internas de enlace, no una pantalla
// propia de ningún rol — se dejan tal como estaban (026), sin acotar
// más de lo que se pidió.
const RESERVATIONS = rules(AUTH, AUTH, AUTH, adminOrOwner("operator_id"), null)
const PREPARATIONS = rules(AUTH, AUTH, AUTH, adminOrOwner("operator_id"), null)

const ADJUSTMENTS = rules(role("admin") + " && " + ACTIVE, role("admin") + " && " + ACTIVE, role("admin") + " && " + ACTIVE, role("admin") + " && " + ACTIVE, null)
const AUDIT_LOG_VIEW = anyRole("admin", "coordinacion", "comunicaciones") + " && " + ACTIVE
const AUDIT_LOG = rules(AUDIT_LOG_VIEW, AUDIT_LOG_VIEW, null, null, null)

// `users`: Coordinación ve y administra cualquier cuenta que NO sea
// Administrador (`role:each != "admin"` sobre el registro objetivo,
// no sobre quien pide — verificado que PocketBase distingue las dos
// cosas). Puede ver una cuenta Administrador (decisión explícita:
// "que la pueda ver, pero no editar") pero nunca tocarla. La jerarquía
// de QUÉ rol puede asignar a quién vive en el hook 09, no aquí.
const USERS_LIST_VIEW = "(" + role("admin") + " || " + role("coordinacion") + ") && " + ACTIVE
const USERS_VIEW = "(" + role("admin") + " || " + role("coordinacion") + " || @request.auth.id = id) && " + ACTIVE
const USERS_CREATE = "(" + role("admin") + " || " + role("coordinacion") + ") && " + ACTIVE
const USERS_MANAGE = "(" + role("admin") + " || (" + role("coordinacion") + ' && role:each != "admin")) && ' + ACTIVE
const USERS_UPDATE = "(" + role("admin") + " || (" + role("coordinacion") + ' && role:each != "admin") || @request.auth.id = id) && ' + ACTIVE

const NEW_RULES = {
  units: UNITS,
  groups: CATALOG,
  categories: CATALOG,
  products: CATALOG,
  locations: CATALOG,

  donations: DONATIONS,
  donation_items: DONATION_ITEMS,
  requests: REQUESTS,
  request_items: REQUEST_ITEMS,
  reservations: RESERVATIONS,
  preparations: PREPARATIONS,
  dispatches: DISPATCHES,
  deliveries: DELIVERIES,

  inventory: HOOKS_ONLY,
  inventory_movements: HOOKS_ONLY,

  adjustments: ADJUSTMENTS,
  audit_log: AUDIT_LOG,
}

// ── Estado anterior a esta migración, para el rollback ──────────
// Es el resultado acumulado de 026 + los ajustes puntuales de
// 033/035/037/038, con la sintaxis de un solo valor (`role = 'x'`)
// que corresponde al campo `role` de antes de la migración 044.
const OLD_ACTIVE = "@request.auth.active = true"
const OLD_AUTH = "@request.auth.id != '' && " + OLD_ACTIVE
const OLD_ADMIN = "@request.auth.role = 'admin' && " + OLD_ACTIVE
const OLD_ADMIN_OR_OPERATOR = "(@request.auth.role = 'admin' || @request.auth.role = 'operator') && " + OLD_ACTIVE

function oldAdminOrOwner(owner) {
  return "(@request.auth.role = 'admin' || @request.auth.id = " + owner + ") && " + OLD_ACTIVE
}

function oldOperational(owner, del) {
  return rules(OLD_AUTH, OLD_AUTH, OLD_AUTH, oldAdminOrOwner(owner), del)
}

const OLD_RULES = {
  units: rules(OLD_AUTH, OLD_AUTH, OLD_ADMIN, OLD_ADMIN, null),
  groups: rules(OLD_AUTH, OLD_AUTH, OLD_ADMIN_OR_OPERATOR, OLD_AUTH, null),
  categories: rules(OLD_AUTH, OLD_AUTH, OLD_ADMIN_OR_OPERATOR, OLD_AUTH, null),
  products: rules(OLD_AUTH, OLD_AUTH, OLD_ADMIN_OR_OPERATOR, OLD_AUTH, null),
  locations: rules(OLD_AUTH, OLD_AUTH, OLD_ADMIN_OR_OPERATOR, OLD_ADMIN, null),

  donations: oldOperational("operator_id", OLD_ADMIN),
  donation_items: oldOperational("donation_id.operator_id", OLD_ADMIN),
  requests: oldOperational("operator_id", OLD_ADMIN),
  request_items: oldOperational("request_id.operator_id", OLD_ADMIN),
  reservations: oldOperational("operator_id", null),
  preparations: oldOperational("operator_id", null),
  dispatches: oldOperational("operator_id", OLD_ADMIN),
  deliveries: oldOperational("operator_id", OLD_ADMIN),

  inventory: rules(OLD_AUTH, OLD_AUTH, null, null, null),
  inventory_movements: rules(OLD_AUTH, OLD_AUTH, null, null, null),

  adjustments: rules(OLD_ADMIN, OLD_ADMIN, OLD_ADMIN, OLD_ADMIN, null),
  audit_log: rules(OLD_ADMIN, OLD_ADMIN, null, null, null),
}

const OLD_USERS = rules(
  OLD_ADMIN,
  "(@request.auth.role = 'admin' || @request.auth.id = id) && " + OLD_ACTIVE,
  OLD_ADMIN,
  OLD_ADMIN,
  null
)

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
  (app) => {
    apply(app, NEW_RULES)

    const users = app.findCollectionByNameOrId("users")
    users.listRule = USERS_LIST_VIEW
    users.viewRule = USERS_VIEW
    users.createRule = USERS_CREATE
    users.updateRule = USERS_UPDATE
    users.deleteRule = null
    users.manageRule = USERS_MANAGE
    app.save(users)
  },
  (app) => {
    apply(app, OLD_RULES)

    const users = app.findCollectionByNameOrId("users")
    users.listRule = OLD_USERS.list
    users.viewRule = OLD_USERS.view
    users.createRule = OLD_USERS.create
    users.updateRule = OLD_USERS.update
    users.deleteRule = null
    users.manageRule = OLD_ADMIN
    app.save(users)
  }
)
