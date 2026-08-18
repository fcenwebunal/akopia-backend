// Dos cambios pedidos juntos para el módulo de ubicaciones:
//
// 1. `photo_url` — mismo patrón que groups/categories/products
//    (migración 031): referencia visual de la ubicación, el archivo lo
//    aloja Cloudinary, aquí solo se guarda la URL.
// 2. `createRule` pasa de admin exclusivo a admin-u-operador: quien
//    recibe una donación es quien mejor sabe qué estante le hace falta
//    en el momento, no tiene sentido obligar a llamar a un admin.
//    `updateRule` se queda en admin, igual que groups/categories/products
//    (migración 033) — crear sí, editar lo ya creado no.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("locations")

  collection.fields.add(new URLField({ name: "photo_url", max: 500 }))
  collection.createRule = "(@request.auth.role = 'admin' || @request.auth.role = 'operator') && @request.auth.active = true"

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("locations")

  collection.fields.removeByName("photo_url")
  collection.createRule = "@request.auth.role = 'admin'"

  app.save(collection)
})
