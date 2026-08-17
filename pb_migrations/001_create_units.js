migrate((app) => {
  const collection = new Collection({
    name: "units",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null
  })

  collection.fields.add(new TextField({ name: "code", required: true, min: 1, max: 20 }))
  collection.fields.add(new TextField({ name: "name", required: true, min: 1, max: 50 }))
  collection.fields.add(new TextField({ name: "description", max: 200 }))
  collection.fields.add(new BoolField({ name: "is_countable" }))
  collection.fields.add(new BoolField({ name: "active" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_units_code ON units (code)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("units")
    app.delete(collection)
  } catch (_) {}
})
