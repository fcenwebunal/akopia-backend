migrate((app) => {
  const password = $os.getenv("AKOPIA_INITIAL_ADMIN_PASSWORD")
  if (!password || password === "") {
    throw new Error("La variable de entorno AKOPIA_INITIAL_ADMIN_PASSWORD es obligatoria para crear el usuario administrador inicial.")
  }

  const collection = app.findCollectionByNameOrId("users")

  const record = new Record(collection)
  record.set("email", "admin@akopia.org")
  record.set("full_name", "Administrador General")
  record.set("role", "admin")
  record.set("active", true)
  record.set("verified", true)
  record.setPassword(password)

  app.save(record)
}, (app) => {
  try {
    const record = app.findAuthRecordByEmail("users", "admin@akopia.org")
    app.delete(record)
  } catch (_) {}
})
