migrate((app) => {
  const inventoryCollection = app.findCollectionByNameOrId("inventory")
  const productsCollection = app.findCollectionByNameOrId("products")
  const locationsCollection = app.findCollectionByNameOrId("locations")
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "adjustments",
    type: "base",
    listRule: "@request.auth.role = 'admin'",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null
  })

  collection.fields.add(new RelationField({ name: "inventory_id", required: true, collectionId: inventoryCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "product_id", required: true, collectionId: productsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "location_id", collectionId: locationsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity_before", required: true, min: 0 }))
  collection.fields.add(new NumberField({ name: "quantity_after", required: true, min: 0 }))
  collection.fields.add(new NumberField({ name: "difference", required: true }))
  collection.fields.add(new TextField({ name: "reason", required: true, min: 5, max: 500 }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "approved_by", collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_adjustments_inventory_id ON adjustments (inventory_id)",
    "CREATE INDEX idx_adjustments_product_id ON adjustments (product_id)",
    "CREATE INDEX idx_adjustments_operator_id ON adjustments (operator_id)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("adjustments")
    app.delete(collection)
  } catch (_) {}
})
