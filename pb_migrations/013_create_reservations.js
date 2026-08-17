migrate((app) => {
  const requestItemsCollection = app.findCollectionByNameOrId("request_items")
  const inventoryCollection = app.findCollectionByNameOrId("inventory")
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "reservations",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = operator_id",
    deleteRule: null
  })

  collection.fields.add(new RelationField({ name: "request_item_id", required: true, collectionId: requestItemsCollection.id, cascadeDelete: true, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "inventory_id", required: true, collectionId: inventoryCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity_reserved", required: true, min: 0.01 }))
  collection.fields.add(new SelectField({ name: "status", required: true, values: ["activa", "liberada", "consumida"] }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "notes", max: 300 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_reservations_request_item_id ON reservations (request_item_id)",
    "CREATE INDEX idx_reservations_inventory_id ON reservations (inventory_id)",
    "CREATE INDEX idx_reservations_status ON reservations (status)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("reservations")
    app.delete(collection)
  } catch (_) {}
})
