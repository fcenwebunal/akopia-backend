migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "donations",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = operator_id",
    deleteRule: "@request.auth.role = 'admin'"
  })

  collection.fields.add(new TextField({ name: "code", required: true, min: 1, max: 20 }))
  collection.fields.add(new SelectField({ name: "donor_type", required: true, values: ["individual", "empresa", "institucion", "anonimo"] }))
  collection.fields.add(new TextField({ name: "donor_name", max: 200 }))
  collection.fields.add(new TextField({ name: "donor_phone", max: 20 }))
  collection.fields.add(new TextField({ name: "donor_email", max: 200 }))
  collection.fields.add(new TextField({ name: "donor_rfc", max: 20 }))
  collection.fields.add(new DateField({ name: "receipt_date", required: true }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "notes", max: 1000 }))
  collection.fields.add(new FileField({ name: "photo", maxSelect: 3, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_donations_code ON donations (code)",
    "CREATE INDEX idx_donations_receipt_date ON donations (receipt_date)",
 "CREATE INDEX idx_donations_operator_id ON donations (operator_id)",
    "CREATE INDEX idx_donations_donor_name ON donations (donor_name)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("donations")
    app.delete(collection)
  } catch (_) {}
})
