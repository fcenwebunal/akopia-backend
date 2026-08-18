// Mismo cambio que la migración 037 hizo para `categories`/`products`,
// ahora para `groups`: un operador puede cambiar la foto de un grupo,
// no solo crearlo (eso ya lo tenía desde la 033). El hook
// `06_catalog_photo_guard.pb.js` es quien limita ese permiso a
// `photo_url` exclusivamente — actualizado junto con esta migración
// para incluir `groups` en su lista de campos protegidos.

const AUTH = "@request.auth.id != '' && @request.auth.active = true"

migrate((app) => {
  const collection = app.findCollectionByNameOrId("groups")
  collection.updateRule = AUTH
  app.save(collection)
}, (app) => {
  const ADMIN = "@request.auth.role = 'admin' && @request.auth.active = true"
  const collection = app.findCollectionByNameOrId("groups")
  collection.updateRule = ADMIN
  app.save(collection)
})
