migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "requests",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = operator_id",
    deleteRule: "@request.auth.role = 'admin'"
  })

  collection.fields.add(new TextField({ name: "code", required: true, min: 1, max: 20 }))
  collection.fields.add(new TextField({ name: "requester_name", required: true, min: 2, max: 200 }))
  collection.fields.add(new TextField({ name: "requester_phone", max: 20 }))
  collection.fields.add(new TextField({ name: "requester_institution", max: 200 }))
  collection.fields.add(new TextField({ name: "destination", required: true, min: 2, max: 300 }))
  collection.fields.add(new NumberField({ name: "beneficiary_count", min: 1, noDecimal: true }))
  collection.fields.add(new SelectField({ name: "priority", required: true, values: ["baja", "media", "alta", "critica"] }))
  collection.fields.add(new SelectField({ name: "status", required: true, values: ["pendiente", "aprobada", "rechazada", "en_preparacion", "despachada", "entregada", "cancelada"] }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "approved_by", collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new DateField({ name: "approved_at" }))
  collection.fields.add(new TextField({ name: "rejection_reason", max: 500 }))
  collection.fields.add(new TextField({ name: "notes", max: 1000 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_requests_code ON requests (code)",
    "CREATE INDEX idx_requests_status ON requests (status)",
    "CREATE INDEX idx_requests_priority ON requests (priority)",
    "CREATE INDEX idx_requests_operator_id ON requests (operator_id)",
    "CREATE INDEX idx_requests_created ON requests (created)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("requests")
    app.delete(collection)
  } catch (_) {}
})
