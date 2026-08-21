// ─────────────────────────────────────────────────────────────
// 06_catalog_photo_guard.pb.js — El PATCH crudo de la API solo cambia
// la foto, para cualquiera
//
// Las migraciones 037 y 038 abrieron `updateRule` de `categories`,
// `products` y `groups` a cualquier rol que toque inventario, para que
// puedan cambiar la foto sin llamar a un admin. Pero la regla de una
// colección no distingue "cambió photo_url" de "cambió el nombre" —
// por eso ese permiso viene acompañado de este hook: cualquier campo
// que no sea `photo_url` debe llegar exactamente igual a como estaba.
//
// Hasta el 21 de agosto esto solo regía para quien NO fuera admin/
// coordinación — ellos podían cambiar cualquier campo por un PATCH
// crudo, sin motivo ni rastro en Historial. Desde que existe
// 11_edit_delete_with_reason.pb.js (edición con motivo obligatorio,
// admin/coordinación) esa puerta se cierra para todos por igual: el
// PATCH crudo de la API SIEMPRE queda limitado a `photo_url`, sin
// excepción de rol — el resto del catálogo se edita por esa ruta
// nueva. Esa ruta hace app.save() dentro de un handler propio, que
// nunca dispara este hook (es de petición, no de modelo — ver README
// §6b), así que no hay conflicto entre las dos.
// ─────────────────────────────────────────────────────────────

onRecordUpdateRequest((e) => {
  const { CATALOG_GUARDED_FIELDS } = require(`${__hooks}/utils/config.js`);

  const fields = CATALOG_GUARDED_FIELDS[e.collection.name] || [];
  const original = e.record.original();

  for (const field of fields) {
    const before = original.get(field);
    const after = e.record.get(field);

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new ForbiddenError(
        "Por aquí solo se puede cambiar la foto. Para editar el resto de los datos, usa la acción de editar (con motivo)."
      );
    }
  }

  e.next();
}, "groups", "categories", "products", "locations");
