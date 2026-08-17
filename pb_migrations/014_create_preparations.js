migrate((app) => {
  const requestsCollection = app.findCollectionByNameOrId("requests")
  const requestItemsCollection = app.findCollectionByNameOrId("request_items")
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "preparations",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = operator_id",
    deleteRule: null
  })

  collection.fields.add(new RelationField({ name: "request_id", required: true, collectionId: requestsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "request_item_id", required: true, collectionId: requestItemsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity_prepared", required: true, min: 0.01 }))
  collection.fields.add(new SelectField({ name: "status", required: true, values: ["en_proceso", "completado", "incompleto"] }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "notes", max: 300 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_preparations_request_id ON preparations (request_id)",
    "CREATE INDEX idx_preparations_request_item_id ON preparations (request_item_id)",
    "CREATE INDEX idx_preparations_status ON preparations (status)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("preparations")
    app.delete(collection)
  } catch (_) {}
})
