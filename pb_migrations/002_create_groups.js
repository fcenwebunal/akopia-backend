migrate((app) => {
  const collection = new Collection({
    name: "groups",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null
  })

  collection.fields.add(new TextField({ name: "name", required: true, min: 1, max: 100 }))
  collection.fields.add(new TextField({ name: "description", max: 500 }))
  collection.fields.add(new NumberField({ name: "sort_order", noDecimal: true }))
  collection.fields.add(new BoolField({ name: "active" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_groups_name ON groups (name)",
    "CREATE INDEX idx_groups_active ON groups (active)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("groups")
    app.delete(collection)
  } catch (_) {}
})
