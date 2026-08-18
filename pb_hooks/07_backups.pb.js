// ─────────────────────────────────────────────────────────────
// 07_backups.pb.js — Respaldo manual de la base de datos
//
// PocketBase ya sabe crear y restaurar respaldos (Settings → Backups en
// /_/), pero esa pantalla y su API nativa (/api/backups/*) exigen un
// superusuario real de la tabla interna `_superusers` — nuestros admins
// de la app (colección `users`, role: "admin") no lo son. Estas rutas
// envuelven las mismas llamadas de bajo nivel (`app.createBackup`,
// `app.newBackupsFilesystem`) para que un admin de AKOPIA pueda respaldar
// sin entrar a /_/, que además no debe quedar abierto en la red de la
// UNAL (ver DESPLIEGUE.md).
//
// Restaurar NO se expone aquí, a propósito: sobreescribe toda la base y
// reinicia el proceso, cortando a cualquiera que esté conectado en ese
// momento. Sigue siendo, deliberadamente, solo desde /_/ con un
// superusuario real — decisión tomada con Juan Manuel al diseñar esto,
// no un recorte de alcance silencioso.
//
// OJO: la ruta va bajo /api/akopia-backups, no /api/backups — ese
// segundo path ya lo reserva la API nativa de PocketBase (solo
// superusuario) y una ruta propia con el mismo nombre queda tapada por
// la suya sin ningún aviso ni error, solo un 403 genérico que no viene
// de aquí.
// ─────────────────────────────────────────────────────────────

// ── GET /api/akopia-backups ─────────────────────────────────────
// Lista los respaldos que ya existen en el servidor.
routerAdd("GET", "/api/akopia-backups", (e) => {
  const { requireAdmin } = require(`${__hooks}/utils/routes.js`);
  requireAdmin(e);

  const fs = e.app.newBackupsFilesystem();
  let entries;
  try {
    entries = fs.list("");
  } finally {
    fs.close();
  }

  const backups = entries
    .filter((entry) => !entry.isDir)
    .map((entry) => ({
      key: entry.key,
      size: entry.size,
      // Formato RFC3339 explícito: el `String()` por defecto de Go
      // ("2026-08-18 04:57:04.11 -0500 -05") no es un ISO 8601 válido y
      // `new Date()` en el navegador lo interpreta mal o lo descarta.
      modified: entry.modTime ? entry.modTime.format("2006-01-02T15:04:05Z07:00") : null,
    }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));

  return e.json(200, { backups: backups });
}, $apis.requireAuth());

// ── POST /api/akopia-backups ────────────────────────────────────
// Crea un respaldo nuevo. Exige repetir la contraseña nativa de
// PocketBase de quien lo pide — la sesión activa por sí sola no basta
// para una acción que exporta la base completa.
routerAdd("POST", "/api/akopia-backups", (e) => {
  const { requireAdmin } = require(`${__hooks}/utils/routes.js`);
  const { backupName } = require(`${__hooks}/utils/backups.js`);
  const operator = requireAdmin(e);

  const body = new DynamicModel({ password: "" });
  e.bindBody(body);

  if (!body.password) {
    throw new BadRequestError("Se requiere la contraseña para confirmar");
  }

  if (!operator.validatePassword(body.password)) {
    throw new ForbiddenError("Contraseña incorrecta");
  }

  const name = backupName();
  e.app.createBackup(new Context(), name);

  const fs = e.app.newBackupsFilesystem();
  let attrs;
  try {
    attrs = fs.attributes(name);
  } finally {
    fs.close();
  }

  return e.json(200, {
    key: name,
    size: attrs ? attrs.size : null,
  });
}, $apis.requireAuth());

// ── POST /api/akopia-backups/{key}/download ─────────────────────
// Igual que crear: exige la contraseña otra vez, porque descargar es
// sacar del servidor una copia completa y portable de todo lo que hay
// en la base.
routerAdd("POST", "/api/akopia-backups/{key}/download", (e) => {
  const { requireAdmin } = require(`${__hooks}/utils/routes.js`);
  const { isValidBackupKey } = require(`${__hooks}/utils/backups.js`);
  const operator = requireAdmin(e);

  const key = e.request.pathValue("key");
  if (!isValidBackupKey(key)) {
    throw new BadRequestError("Nombre de respaldo inválido");
  }

  const body = new DynamicModel({ password: "" });
  e.bindBody(body);

  if (!body.password) {
    throw new BadRequestError("Se requiere la contraseña para confirmar");
  }

  if (!operator.validatePassword(body.password)) {
    throw new ForbiddenError("Contraseña incorrecta");
  }

  const fs = e.app.newBackupsFilesystem();
  try {
    if (!fs.exists(key)) {
      throw new NotFoundError("No existe ese respaldo");
    }
    fs.serve(e.response, e.request, key, key);
  } finally {
    fs.close();
  }
}, $apis.requireAuth());
