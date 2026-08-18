// `categories` y `products` pasan su `updateRule` de admin exclusivo a
// cualquier activo — pero NO a mano abierta: el hook nuevo en
// `06_catalog_photo_guard.pb.js` revisa que, si quien edita no es
// admin, el único campo que cambió sea `photo_url`. Tocar nombre,
// grupo/categoría, unidad o `active` desde una cuenta operadora sigue
// bloqueado ahí, no aquí — la regla de la colección por sí sola no
// puede distinguir "solo la foto" de "todo el registro".
//
// `groups` queda fuera a propósito: no se pidió, y sus fotos ya se
// resuelven bien con el sembrado por lote de Wikimedia.

const AUTH = "@request.auth.id != '' && @request.auth.active = true"

migrate((app) => {
  for (const name of ["categories", "products"]) {
    const collection = app.findCollectionByNameOrId(name)
    collection.updateRule = AUTH
    app.save(collection)
  }
}, (app) => {
  const ADMIN = "@request.auth.role = 'admin' && @request.auth.active = true"
  for (const name of ["categories", "products"]) {
    const collection = app.findCollectionByNameOrId(name)
    collection.updateRule = ADMIN
    app.save(collection)
  }
})
