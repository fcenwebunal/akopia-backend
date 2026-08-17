migrate((app) => {
  const donationsCollection = app.findCollectionByNameOrId("donations")
  const productsCollection = app.findCollectionByNameOrId("products")
  const unitsCollection = app.findCollectionByNameOrId("units")
  const locationsCollection = app.findCollectionByNameOrId("locations")

  const collection = new Collection({
    name: "donation_items",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'admin' || @request.auth.id = donation_id.operator_id",
    deleteRule: "@request.auth.role = 'admin'"
  })

  collection.fields.add(new RelationField({ name: "donation_id", required: true, collectionId: donationsCollection.id, cascadeDelete: true, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "product_id", required: true, collectionId: productsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "unit_id", required: true, collectionId: unitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity", required: true, min: 0.01 }))
  collection.fields.add(new SelectField({ name: "classification_status", required: true, values: ["pending", "available", "quarantine", "rejected"] }))
  collection.fields.add(new RelationField({ name: "location_id", collectionId: locationsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "batch_code", max: 50 }))
  collection.fields.add(new DateField({ name: "expiry_date" }))
  collection.fields.add(new TextField({ name: "rejection_reason", max: 500 }))
  collection.fields.add(new FileField({ name: "photo", maxSelect: 2, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }))
  collection.fields.add(new TextField({ name: "notes", max: 500 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_donation_items_donation_id ON donation_items (donation_id)",
    "CREATE INDEX idx_donation_items_product_id ON donation_items (product_id)",
    "CREATE INDEX idx_donation_items_status ON donation_items (classification_status)",
    "CREATE INDEX idx_donation_items_location_id ON donation_items (location_id)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("donation_items")
    app.delete(collection)
  } catch (_) {}
})
