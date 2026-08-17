migrate((app) => {
  const groupsCollection = app.findCollectionByNameOrId("groups")

  const collection = new Collection({
    name: "categories",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null
  })

  collection.fields.add(new TextField({ name: "name", required: true, min: 1, max: 100 }))
  collection.fields.add(new RelationField({ name: "group_id", required: true, collectionId: groupsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "description", max: 500 }))
  collection.fields.add(new NumberField({ name: "sort_order", noDecimal: true }))
  collection.fields.add(new BoolField({ name: "active" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_categories_name_group ON categories (name, group_id)",
    "CREATE INDEX idx_categories_group_id ON categories (group_id)",
    "CREATE INDEX idx_categories_active ON categories (active)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("categories")
    app.delete(collection)
  } catch (_) {}
})
