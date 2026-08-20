// `kits` — plantillas reutilizables de productos+cantidades para no
// repetir la misma combinación cada vez que se registra una solicitud
// (ver PROPUESTA-KITS-SOLICITUDES.md en la raíz del proyecto).
//
// Permiso: los mismos roles que ya pueden crear solicitudes — decisión
// explícita de Juan Manuel ("la creación de kits debe hacerla cualquiera
// que hayamos dicho que puede hacer solicitudes, en esencia es eso, una
// solicitud"). No hay una capa de "solo admin/coordinación edita la
// plantilla oficial": quien puede pedir ayuda puede definir y ajustar
// sus propios kits.
//
// `active` sigue el mismo criterio que todo el catálogo: nunca se
// borra, se desactiva. Un kit desactivado desaparece del selector pero
// las solicitudes que ya generó no se tocan (no guardan un enlace vivo
// a sus renglones, ver `requests.source_kit_id` en la migración 048).

const KIT_ROLES =
  '(@request.auth.role:each = "admin" || @request.auth.role:each = "coordinacion" || @request.auth.role:each = "salida") && @request.auth.active = true'

migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    name: "kits",
    type: "base",
    listRule: KIT_ROLES,
    viewRule: KIT_ROLES,
    createRule: KIT_ROLES,
    updateRule: KIT_ROLES,
    deleteRule: null,
  })

  collection.fields.add(new TextField({ name: "name", required: true, min: 2, max: 200 }))
  collection.fields.add(new TextField({ name: "description", max: 500 }))
  collection.fields.add(new RelationField({ name: "created_by", required: true, collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new BoolField({ name: "active" }))
  // No `required: true` — PocketBase trata 0 como vacío en un
  // NumberField (ver migración 025), y un kit recién creado empieza en
  // 0 usos.
  collection.fields.add(new NumberField({ name: "use_count", min: 0, noDecimal: true }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = [
    "CREATE INDEX idx_kits_active ON kits (active)",
  ]

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("kits")
    app.delete(collection)
  } catch (_) {}
})
