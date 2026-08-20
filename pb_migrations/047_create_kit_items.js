// `kit_items` — los renglones de un kit: producto, unidad y la
// cantidad "por unidad de kit" (se multiplica por N al usarlo en una
// solicitud, en el frontend — ver PROPUESTA-KITS-SOLICITUDES.md).
//
// `unit_id` es solo el registro de en qué unidad se pensó el kit al
// guardarlo — al usarlo, la solicitud siempre resuelve contra la
// unidad ACTUAL por defecto del producto (igual que ya hace el
// constructor de renglones de `solicitudes/nueva`), así que un cambio
// de unidad en el catálogo después de guardar el kit no rompe nada.
//
// Mismos roles que `kits` — es su tabla de detalle, mismo criterio que
// `donation_items`/`request_items` frente a sus cabeceras.

const KIT_ROLES =
  '(@request.auth.role:each = "admin" || @request.auth.role:each = "coordinacion" || @request.auth.role:each = "salida") && @request.auth.active = true'

migrate((app) => {
  const kitsCollection = app.findCollectionByNameOrId("kits")
  const productsCollection = app.findCollectionByNameOrId("products")
  const unitsCollection = app.findCollectionByNameOrId("units")

  const collection = new Collection({
    name: "kit_items",
    type: "base",
    listRule: KIT_ROLES,
    viewRule: KIT_ROLES,
    createRule: KIT_ROLES,
    updateRule: KIT_ROLES,
    deleteRule: KIT_ROLES,
  })

  collection.fields.add(new RelationField({ name: "kit_id", required: true, collectionId: kitsCollection.id, cascadeDelete: true, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "product_id", required: true, collectionId: productsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new RelationField({ name: "unit_id", required: true, collectionId: unitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "quantity", required: true, min: 0.01 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_kit_items_kit_id ON kit_items (kit_id)",
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("kit_items")
    app.delete(collection)
  } catch (_) {}
})
