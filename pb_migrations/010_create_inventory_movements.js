migrate((app) => {
  const productsCollection = app.findCollectionByNameOrId("products")
  const locationsCollection = app.findCollectionByNameOrId("locations")
  const unitsCollection = app.findCollectionByNameOrId("units")
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "inventory_movements",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null,
    deleteRule: null
  })

  collection.fields.add(new SelectField({ name: "movement_type", required: true, values: ["entrada", "salida", "reserva", "liberacion", "devolucion", "ajuste_positivo", "ajuste_negativo", "cuarentena", "liberar_cuarentena"] }))
  collection.fields.add(new RelationField({ name: "product_id", required: true, collectionId: productsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "location_id", collectionId: locationsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "unit_id", required: true, collectionId: unitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity", required: true, min: 0.01 }))
  collection.fields.add(new SelectField({ name: "reference_type", required: true, values: ["donation", "request", "adjustment", "manual"] }))
  collection.fields.add(new TextField({ name: "reference_id", max: 20 }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "notes", max: 500 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))

  collection.indexes = [
    "CREATE INDEX idx_movements_product_id ON inventory_movements (product_id)",
    "CREATE INDEX idx_movements_type ON inventory_movements (movement_type)",
    "CREATE INDEX idx_movements_reference ON inventory_movements (reference_type, reference_id)",
    "CREATE INDEX idx_movements_operator_id ON inventory_movements (operator_id)",
    "CREATE INDEX idx_movements_created ON inventory_movements (created)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("inventory_movements")
    app.delete(collection)
  } catch (_) {}
})
