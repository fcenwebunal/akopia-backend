migrate((app) => {
  const collection = new Collection({
    name: "locations",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'admin'",
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: null
  })

  collection.fields.add(new TextField({ name: "zone", required: true, min: 1, max: 50 }))
  collection.fields.add(new TextField({ name: "shelf", max: 20 }))
  collection.fields.add(new TextField({ name: "position", max: 20 }))
  collection.fields.add(new TextField({ name: "description", max: 200 }))
  collection.fields.add(new NumberField({ name: "capacity_m3", min: 0 }))
  collection.fields.add(new BoolField({ name: "is_cold_chain" }))
  collection.fields.add(new BoolField({ name: "active" }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE UNIQUE INDEX idx_locations_zone_shelf_position ON locations (zone, shelf, position)",
    "CREATE INDEX idx_locations_active ON locations (active)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("locations")
    app.delete(collection)
  } catch (_) {}
})
