// ─────────────────────────────────────────────────────────────
// utils/backups.js — Nombre y validación de archivos de respaldo
//
// Módulo, no hook: un handler serializado no ve funciones ni
// constantes declaradas en el archivo .pb.js que lo registra, así
// que esto tiene que vivir aquí y cargarse con require() en cada
// ruta, igual que utils/routes.js y utils/helpers.js.
// ─────────────────────────────────────────────────────────────

var BACKUP_PREFIX = "akopia_manual_";

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function backupName() {
  var now = new Date();
  var stamp =
    now.getFullYear().toString() +
    pad2(now.getMonth() + 1) +
    pad2(now.getDate()) +
    "_" +
    pad2(now.getHours()) +
    pad2(now.getMinutes()) +
    pad2(now.getSeconds());
  return BACKUP_PREFIX + stamp + ".zip";
}

// Un nombre de respaldo viaja en la URL (/api/akopia-backups/{key}/download):
// se valida contra un patrón fijo antes de usarlo para abrir un archivo,
// en vez de confiar en lo que llegó del cliente.
function isValidBackupKey(key) {
  return /^[A-Za-z0-9_.-]+\.zip$/.test(key);
}

module.exports = {
  backupName: backupName,
  isValidBackupKey: isValidBackupKey,
};
