// ─────────────────────────────────────────────────────────────
// 06_catalog_photo_guard.pb.js — Quien no es admin/coordinación solo
// edita la foto
//
// Las migraciones 037 y 038 abrieron `updateRule` de `categories`,
// `products` y `groups` a cualquier rol que toque inventario, para que
// puedan cambiar la foto sin llamar a un admin. Pero la regla de una
// colección no distingue "cambió photo_url" de "cambió el nombre" —
// por eso ese permiso viene acompañado de este hook: si quien edita no
// tiene un rol con poder para editar el catálogo completo, cualquier
// campo que no sea `photo_url` debe llegar exactamente igual a como
// estaba.
// ─────────────────────────────────────────────────────────────

onRecordUpdateRequest((e) => {
  const { CATALOG_GUARDED_FIELDS } = require(`${__hooks}/utils/config.js`);
  const { hasAnyRole } = require(`${__hooks}/utils/roles.js`);

  const canEditFully = hasAnyRole(e.auth, ["admin", "coordinacion"]);

  if (!canEditFully) {
    const fields = CATALOG_GUARDED_FIELDS[e.collection.name] || [];
    const original = e.record.original();

    for (const field of fields) {
      const before = original.get(field);
      const after = e.record.get(field);

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new ForbiddenError(
          "Un operador solo puede cambiar la foto. Para editar el resto de los datos hace falta un administrador."
        );
      }
    }
  }

  e.next();
}, "groups", "categories", "products", "locations");
