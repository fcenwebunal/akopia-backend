// Sin esto, un admin (rol de la aplicación, no superusuario real de
// PocketBase) ve el correo de los DEMÁS usuarios en blanco al listar
// `users`. No es un bug: PocketBase oculta `email` de terceros por
// `emailVisibility` a cualquiera que no sea el propio dueño del
// registro o alguien con `manageRule` — un admin con solo `updateRule`
// no basta. Se descubrió probando /panel/usuarios de verdad: el correo
// de las cuentas pendientes de activar aparecía vacío.
//
// `manageRule` es la vía que da PocketBase para esto exactamente: un rol
// de la aplicación que administra por completo la colección de usuarios,
// sin ser superusuario. Con ella también se puede fijar `verified` desde
// la interfaz si algún día hace falta, cosa que `updateRule` solo no
// permite en los campos internos de una colección de autenticación.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("users")

  collection.manageRule = "@request.auth.role = 'admin' && @request.auth.active = true"

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("users")

  collection.manageRule = null

  app.save(collection)
})
