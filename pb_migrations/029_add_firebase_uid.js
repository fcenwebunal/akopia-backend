// El puente con Firebase Authentication necesita identificar de forma
// estable a qué registro de `users` corresponde una sesión de Firebase.
// El correo no basta por sí solo — alguien podría cambiarlo en Firebase y
// dejar de coincidir — así que se guarda también el `uid` de Firebase,
// que no cambia nunca.
//
// El campo es opcional: las cuentas creadas directamente por un admin
// (sin pasar por Firebase) simplemente no lo tienen.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("users")

  collection.fields.add(new TextField({ name: "firebase_uid", max: 128 }))

  collection.indexes.push(
    "CREATE UNIQUE INDEX idx_users_firebase_uid ON users (firebase_uid) WHERE firebase_uid != ''"
  )

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("users")

  collection.indexes = collection.indexes.filter(
    (index) => !index.includes("idx_users_firebase_uid")
  )
  collection.fields.removeByName("firebase_uid")

  app.save(collection)
})
