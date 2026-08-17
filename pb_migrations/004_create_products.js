migrate((app) => {
  const categoriesCollection = app.findCollectionByNameOrId("categories")
  const unitsCollection = app.findCollectionByNameOrId("units")

  const collection = new Collection({
    name: "products",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null
  })

  collection.fields.add(new TextField({ name: "name", required: true, min: 1, max: 200 }))
  collection.fields.add(new RelationField({ name: "category_id", required: true, collectionId: categoriesCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "default_unit_id", required: true, collectionId: unitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "description", max: 500 }))
  collection.fields.add(new NumberField({ name: "min_stock_alert", noDecimal: true, min: 0 }))
  collection.fields.add(new BoolField({ name: "requires_batch" }))
  collection.fields.add(new BoolField({ name: "requires_expiry" }))
  collection.fields.add(new BoolField({ name: "requires_quarantine" }))
  collection.fields.add(new BoolField({ name: "is_fragile" }))
  collection.fields.add(new BoolField({ name: "is_hazardous" }))
  collection.fields.add(new BoolField({ name: "active" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_products_name_category ON products (name, category_id)",
    "CREATE INDEX idx_products_category_id ON products (category_id)",
    "CREATE INDEX idx_products_active ON products (active)",
    "CREATE INDEX idx_products_requires_quarantine ON products (requires_quarantine)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("products")
    app.delete(collection)
  } catch (_) {}
})
