migrate((app) => {
  const requestsCollection = app.findCollectionByNameOrId("requests")
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "dispatches",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = operator_id",
    deleteRule: "@request.auth.role = 'admin'"
  })

  collection.fields.add(new TextField({ name: "code", required: true, min: 1, max: 20 }))
  collection.fields.add(new RelationField({ name: "request_id", required: true, collectionId: requestsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "vehicle_plate", max: 20 }))
  collection.fields.add(new TextField({ name: "driver_name", required: true, min: 2, max: 200 }))
  collection.fields.add(new TextField({ name: "driver_phone", max: 20 }))
  collection.fields.add(new TextField({ name: "brigade", max: 200 }))
  collection.fields.add(new TextField({ name: "destination", required: true, min: 2, max: 300 }))
  collection.fields.add(new DateField({ name: "dispatch_date", required: true }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "notes", max: 500 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_dispatches_code ON dispatches (code)",
    "CREATE INDEX idx_dispatches_request_id ON dispatches (request_id)",
    "CREATE INDEX idx_dispatches_dispatch_date ON dispatches (dispatch_date)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("dispatches")
    app.delete(collection)
  } catch (_) {}
})
