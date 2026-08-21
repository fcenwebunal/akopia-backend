// ─────────────────────────────────────────────────────────────
// utils/routes.js — Guardas y cargas comunes de las rutas propias
//
// Módulo, no hook: PocketBase solo auto-carga pb_hooks/**/*.pb.js.
// ─────────────────────────────────────────────────────────────

// Un operador autenticado y activo. `$apis.requireAuth()` solo garantiza
// que hay sesión; que la cuenta siga vigente lo comprobamos aquí, igual
// que hacen las reglas de acceso de las colecciones.
function requireOperator(e) {
  var auth = e.auth;

  if (!auth || !auth.id) {
    throw new UnauthorizedError("Se requiere iniciar sesión");
  }

  if (!auth.get("active")) {
    throw new ForbiddenError("La cuenta está desactivada");
  }

  return auth;
}

function requireAdmin(e) {
  var auth = requireOperator(e);
  var roles = auth.get("role") || [];

  if (roles.indexOf("admin") === -1) {
    throw new ForbiddenError("Esta operación requiere rol de administrador");
  }

  return auth;
}

// Exige que la cuenta autenticada y activa tenga al menos uno de los
// roles en `allowed` (ver utils/roles.js para el catálogo). `admin`
// no se agrega implícitamente aquí — cada ruta que deba dejar pasar
// también a un administrador lo incluye explícitamente en su lista,
// igual que ya hacían las reglas de acceso de las colecciones.
function requireRole(e, allowed) {
  var auth = requireOperator(e);
  var roles = auth.get("role") || [];

  var ok = false;
  for (var i = 0; i < allowed.length; i++) {
    if (roles.indexOf(allowed[i]) !== -1) {
      ok = true;
      break;
    }
  }

  if (!ok) {
    throw new ForbiddenError("Tu rol no tiene permiso para esta operación");
  }

  return auth;
}

// Carga una solicitud y, si se indica, exige que esté en cierto estado.
function loadRequest(app, requestId, expectedStatus) {
  var request;

  try {
    request = app.findRecordById("requests", requestId);
  } catch (err) {
    throw new NotFoundError("No existe la solicitud " + requestId);
  }

  if (expectedStatus && request.get("status") !== expectedStatus) {
    throw new BadRequestError(
      "La solicitud debe estar en estado '" +
        expectedStatus +
        "'. Estado actual: '" +
        request.get("status") +
        "'"
    );
  }

  return request;
}

// Carga cualquier registro por colección + id, con un 404 en español
// en vez de dejar pasar la excepción cruda de PocketBase.
function loadRecord(app, collectionName, id) {
  try {
    return app.findRecordById(collectionName, id);
  } catch (err) {
    throw new NotFoundError("No existe ese registro.");
  }
}

module.exports = {
  requireOperator: requireOperator,
  requireAdmin: requireAdmin,
  requireRole: requireRole,
  loadRequest: loadRequest,
  loadRecord: loadRecord,
};
