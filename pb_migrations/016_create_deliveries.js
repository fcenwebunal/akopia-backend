migrate((app) => {
  const dispatchesCollection = app.findCollectionByNameOrId("dispatches")
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "deliveries",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = operator_id",
    deleteRule: "@request.auth.role = 'admin'"
  })

  collection.fields.add(new RelationField({ name: "dispatch_id", required: true, collectionId: dispatchesCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "receiver_name", required: true, min: 2, max: 200 }))
  collection.fields.add(new TextField({ name: "receiver_phone", max: 20 }))
  collection.fields.add(new SelectField({ name: "receiver_id_type", values: ["ine", "pasaporte", "credencial", "otro"] }))
  collection.fields.add(new DateField({ name: "delivery_date", required: true }))
  collection.fields.add(new SelectField({ name: "status", required: true, values: ["entregado", "parcial", "no_entregado"] }))
  collection.fields.add(new FileField({ name: "signature", maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png"] }))
  collection.fields.add(new FileField({ name: "photo", maxSelect: 3, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "notes", max: 500 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_deliveries_dispatch_id ON deliveries (dispatch_id)",
    "CREATE INDEX idx_deliveries_status ON deliveries (status)",
    "CREATE INDEX idx_deliveries_delivery_date ON deliveries (delivery_date)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("deliveries")
    app.delete(collection)
  } catch (_) {}
})
