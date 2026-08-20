// ─────────────────────────────────────────────────────────────
// utils/roles.js — Catálogo de roles, niveles y comprobaciones
//
// Módulo, no hook: solo se carga con require() desde dentro de un
// handler serializado (ver "Las cuatro trampas de la API de hooks"
// en el CLAUDE.md del backend).
//
// `users.role` es multi-valor desde la migración 044: una cuenta puede
// tener varios roles a la vez. El nivel es la base de la jerarquía de
// asignación que aplica 09_users_role_guard.pb.js: nadie puede
// asignar un rol de nivel igual o mayor al suyo, salvo Administrador,
// que puede asignar cualquiera (incluido Administrador).
// ─────────────────────────────────────────────────────────────

var ROLE_LEVELS = {
  admin: 3,
  coordinacion: 2,
  transporte_distribucion: 1,
  voluntariado: 1,
  comunicaciones: 1,
  salida: 1,
};

var ALL_ROLES = Object.keys(ROLE_LEVELS);

// Roles cuya tarea toca inventario de verdad — pueden ampliar el
// catálogo (dar de alta productos/categorías/grupos/ubicaciones) y
// cambiar la foto de lo que ya existe, para que el catálogo se adapte
// a lo que de verdad llega. Comunicaciones queda fuera a propósito:
// solo consulta.
var INVENTORY_ROLES = [
  "admin",
  "coordinacion",
  "transporte_distribucion",
  "voluntariado",
  "salida",
];

// `auth` es un *Record de la colección `users` (típicamente e.auth).
// `role` siempre llega como arreglo desde la migración 044.
function rolesOf(auth) {
  if (!auth) return [];
  var roles = auth.get("role");
  return Array.isArray(roles) ? roles : [];
}

function rolesInclude(roles, allowed) {
  for (var i = 0; i < allowed.length; i++) {
    if (roles.indexOf(allowed[i]) !== -1) return true;
  }
  return false;
}

function hasAnyRole(auth, allowed) {
  return rolesInclude(rolesOf(auth), allowed);
}

function isAdmin(auth) {
  return hasAnyRole(auth, ["admin"]);
}

// Nivel más alto entre un arreglo de roles.
function maxLevel(roles) {
  var max = 0;
  for (var i = 0; i < roles.length; i++) {
    var level = ROLE_LEVELS[roles[i]] || 0;
    if (level > max) max = level;
  }
  return max;
}

// ¿Puede alguien con `actorRoles` asignar exactamente `requestedRoles`?
// Administrador está en la cima de la jerarquía y puede asignar
// cualquier rol, incluido Administrador — la única excepción a la
// regla general. Para cualquier otro actor, cada rol pedido debe tener
// nivel estrictamente menor al nivel máximo del actor: nadie más
// asigna un poder igual o mayor al suyo, ni siquiera a sí mismo.
function canAssignRoles(actorRoles, requestedRoles) {
  if (requestedRoles.length === 0) return false;
  if (rolesInclude(actorRoles, ["admin"])) return true;

  var ceiling = maxLevel(actorRoles);
  for (var i = 0; i < requestedRoles.length; i++) {
    var role = requestedRoles[i];
    if (ROLE_LEVELS[role] === undefined) return false;
    if (ROLE_LEVELS[role] >= ceiling) return false;
  }
  return true;
}

module.exports = {
  ROLE_LEVELS: ROLE_LEVELS,
  ALL_ROLES: ALL_ROLES,
  INVENTORY_ROLES: INVENTORY_ROLES,
  rolesOf: rolesOf,
  rolesInclude: rolesInclude,
  hasAnyRole: hasAnyRole,
  isAdmin: isAdmin,
  maxLevel: maxLevel,
  canAssignRoles: canAssignRoles,
};
