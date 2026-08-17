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

  if (auth.get("role") !== "admin") {
    throw new ForbiddenError("Esta operación requiere rol de administrador");
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

module.exports = {
  requireOperator: requireOperator,
  requireAdmin: requireAdmin,
  loadRequest: loadRequest,
};
