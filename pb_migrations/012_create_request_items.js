migrate((app) => {
  const requestsCollection = app.findCollectionByNameOrId("requests")
  const productsCollection = app.findCollectionByNameOrId("products")
  const unitsCollection = app.findCollectionByNameOrId("units")

  const collection = new Collection({
    name: "request_items",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = request_id.operator_id",
    deleteRule: "@request.auth.role = 'admin'"
  })

  collection.fields.add(new RelationField({ name: "request_id", required: true, collectionId: requestsCollection.id, cascadeDelete: true, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "product_id", required: true, collectionId: productsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "unit_id", required: true, collectionId: unitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity_requested", required: true, min: 0.01 }))
  collection.fields.add(new NumberField({ name: "quantity_fulfilled", min: 0 }))
  collection.fields.add(new SelectField({ name: "status", required: true, values: ["pendiente", "reservado", "preparado", "despachado", "entregado", "no_disponible"] }))
  collection.fields.add(new TextField({ name: "notes", max: 300 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_request_items_request_id ON request_items (request_id)",
    "CREATE INDEX idx_request_items_product_id ON request_items (product_id)",
    "CREATE INDEX idx_request_items_status ON request_items (status)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("request_items")
    app.delete(collection)
  } catch (_) {}
})
