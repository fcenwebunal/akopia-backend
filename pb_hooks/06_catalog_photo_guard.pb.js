// ─────────────────────────────────────────────────────────────
// 06_catalog_photo_guard.pb.js — Un operador solo edita la foto
//
// La migración 037 abrió `categories.updateRule` y `products.updateRule`
// a cualquier activo, para que un operador pueda cambiar la foto sin
// llamar a un admin. Pero la regla de una colección no distingue
// "cambió photo_url" de "cambió el nombre" — por eso ese permiso viene
// acompañado de este hook: si quien edita no es admin, cualquier campo
// que no sea `photo_url` debe llegar exactamente igual a como estaba.
// ─────────────────────────────────────────────────────────────

onRecordUpdateRequest((e) => {
  const { CATALOG_GUARDED_FIELDS } = require(`${__hooks}/utils/config.js`);

  const isAdmin = e.auth && e.auth.get("role") === "admin";

  if (!isAdmin) {
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
}, "categories", "products");
