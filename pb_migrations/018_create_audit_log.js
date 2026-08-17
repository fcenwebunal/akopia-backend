migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "audit_log",
    type: "base",
    listRule: "@request.auth.role = 'admin'",
    viewRule: "@request.auth.role = 'admin'",
    createRule: null,
    updateRule: null,
    deleteRule: null
  })

  collection.fields.add(new TextField({ name: "entity_type", required: true, max: 50 }))
  collection.fields.add(new TextField({ name: "entity_id", required: true, max: 20 }))
  collection.fields.add(new SelectField({ name: "action", required: true, values: ["create", "update", "delete", "status_change", "login", "logout"] }))
  collection.fields.add(new JSONField({ name: "changes" }))
  collection.fields.add(new RelationField({ name: "operator_id", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new TextField({ name: "ip_address", max: 45 }))
  collection.fields.add(new TextField({ name: "notes", max: 500 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))

  collection.indexes = [
    "CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id)",
    "CREATE INDEX idx_audit_operator_id ON audit_log (operator_id)",
    "CREATE INDEX idx_audit_action ON audit_log (action)",
    "CREATE INDEX idx_audit_created ON audit_log (created)"
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("audit_log")
    app.delete(collection)
  } catch (_) {}
})
