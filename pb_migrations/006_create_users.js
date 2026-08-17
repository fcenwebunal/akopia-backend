migrate((app) => {
  const collection = app.findCollectionByNameOrId("users")

  collection.listRule = "@request.auth.role = 'admin'"
  collection.viewRule = "@request.auth.role = 'admin' || @request.auth.id = id"
  collection.createRule = "@request.auth.role = 'admin'"
  collection.updateRule = "@request.auth.role = 'admin'"
  collection.deleteRule = null

  collection.fields.add(new TextField({ name: "full_name", required: true, min: 2, max: 200 }))
  collection.fields.add(new SelectField({ name: "role", required: true, values: ["admin", "operator"] }))
  collection.fields.add(new TextField({ name: "phone", max: 20 }))
  collection.fields.add(new BoolField({ name: "active" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_users_role ON users (role)",
    "CREATE INDEX idx_users_active ON users (active)"
  ]

  collection.passwordAuth = { enabled: true }
  collection.mfa = { enabled: false }
  collection.otp = { enabled: false }

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("users")
    collection.fields.removeByName("full_name")
    collection.fields.removeByName("role")
    collection.fields.removeByName("phone")
    collection.fields.removeByName("active")
    collection.fields.removeByName("created")
    collection.fields.removeByName("updated")
    collection.listRule = ""
    collection.viewRule = ""
    collection.createRule = ""
    collection.updateRule = ""
    collection.deleteRule = null
    collection.indexes = []
    app.save(collection)
  } catch (_) {}
})
