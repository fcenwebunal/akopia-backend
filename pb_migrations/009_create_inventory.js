migrate((app) => {
  const productsCollection = app.findCollectionByNameOrId("products")
  const locationsCollection = app.findCollectionByNameOrId("locations")
  const unitsCollection = app.findCollectionByNameOrId("units")

  const collection = new Collection({
    name: "inventory",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null,
    updateRule: null,
    deleteRule: null
  })

  collection.fields.add(new RelationField({ name: "product_id", required: true, collectionId: productsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "location_id", collectionId: locationsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "unit_id", required: true, collectionId: unitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "available_qty", required: true, min: 0 }))
  collection.fields.add(new NumberField({ name: "reserved_qty", required: true, min: 0 }))
  collection.fields.add(new NumberField({ name: "quarantine_qty", required: true, min: 0 }))
  collection.fields.add(new NumberField({ name: "total_qty", required: true, min: 0 }))
  collection.fields.add(new DateField({ name: "last_movement_at" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_inventory_product_location ON inventory (product_id, location_id)",
    "CREATE INDEX idx_inventory_product_id ON inventory (product_id)",
    "CREATE INDEX idx_inventory_available ON inventory (available_qty) WHERE available_qty > 0"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("inventory")
    app.delete(collection)
  } catch (_) {}
})
