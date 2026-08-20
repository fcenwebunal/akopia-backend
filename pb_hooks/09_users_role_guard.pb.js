// ─────────────────────────────────────────────────────────────
// 09_users_role_guard.pb.js — Jerarquía de roles al crear/editar usuarios
//
// `users.updateRule`/`createRule` (migración 045) ya deciden QUIÉN puede
// tocar QUÉ cuenta (un Administrador cualquiera, un Coordinación
// cualquier cuenta que no sea Administrador). Pero una regla de
// colección no puede comparar "el nivel del rol que estoy pidiendo"
// contra "el nivel máximo de quien pide" — eso necesita la tabla de
// utils/roles.js, así que vive aquí, igual que el hook de fotos de
// catálogo cubre lo que su propia regla no puede expresar.
//
// La regla de negocio (decisión de Juan Manuel): nadie asigna un rol
// de poder igual o mayor al suyo — excepto Administrador, que puede
// asignar cualquiera, incluido Administrador. Así que un Coordinación
// nunca puede crear ni ascender a otro Coordinación ni a un
// Administrador, ni siquiera a sí mismo.
//
// OJO: cada handler se serializa y corre aislado, sin ver el scope del
// archivo — una función de nivel de archivo compartida entre los dos
// `onRecord...Request` de abajo revienta con "guard is not defined"
// (confirmado contra un servidor de prueba real). Por eso la
// comprobación se repite dentro de cada handler en vez de extraerse.
// ─────────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  // Un superusuario real de /_/ está por encima de toda esta jerarquía
  // de la aplicación — sin esto, la propia siembra/soporte por panel
  // quedaría bloqueada porque esa cuenta no tiene `role` en `users`.
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const { rolesOf, canAssignRoles } = require(`${__hooks}/utils/roles.js`);

  const actorRoles = rolesOf(e.auth);
  const requestedRoles = e.record.get("role") || [];

  if (!canAssignRoles(actorRoles, requestedRoles)) {
    throw new ForbiddenError(
      "No puedes asignar un rol de poder igual o mayor al tuyo."
    );
  }

  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const { rolesOf, canAssignRoles } = require(`${__hooks}/utils/roles.js`);

  const original = e.record.original().get("role") || [];
  const next = e.record.get("role") || [];

  // Solo se revisa si el rol de verdad cambió — si nadie lo tocó, no
  // hace falta que quien edita el teléfono sea capaz de "reasignarse"
  // su propio rol vigente.
  if (JSON.stringify(original.slice().sort()) !== JSON.stringify(next.slice().sort())) {
    const actorRoles = rolesOf(e.auth);

    if (!canAssignRoles(actorRoles, next)) {
      throw new ForbiddenError(
        "No puedes asignar un rol de poder igual o mayor al tuyo."
      );
    }
  }

  e.next();
}, "users");
