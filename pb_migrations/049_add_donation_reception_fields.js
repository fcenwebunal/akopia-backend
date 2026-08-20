// Recepción rápida de remesas (ver PROPUESTA-RECEPCION-REMESAS.md, raíz
// del proyecto): permite registrar una donación al llegar —donante,
// peso total, transportista, observaciones— sin tener que clasificar
// sus artículos en el mismo momento. Los artículos se agregan después,
// desde una pantalla de clasificación nueva; el modelo de
// `donation_items` no cambia en absoluto, ya soportaba una donación
// con cero renglones.
//
// `status` es explícito, lo cambia una persona al terminar de abrir la
// remesa — nunca se infiere solo de cuántos `donation_items` tenga.
// Dos valores, no tres: "recepción" (recién llegada, se le puede
// seguir agregando/clasificando artículos) y "clasificada" (alguien
// confirmó que ya terminó). No existe un tercer valor "en cuarentena"
// a nivel de remesa — cuarentena ya es un estado de CADA artículo
// (`donation_items.classification_status`), y una remesa real casi
// siempre termina mixta (algo apto, algo en revisión, algo
// rechazado); ponerle esa etiqueta a la remesa completa sería
// engañoso en cuanto el primer artículo se clasificara.
//
// `total_weight_kg`/`classified_weight_kg` sin `required: true` a
// propósito, aunque la recepción rápida los exige en la práctica: un
// NumberField obligatorio en una colección con filas ya existentes
// puede bloquear la edición futura de un registro viejo que nunca
// tuvo ese dato (el mismo problema que ya corrigió la migración
// `025` sobre `inventory`). La obligatoriedad real vive en la
// pantalla de recepción rápida, no en el esquema.

const KIT_LIKE_OWNER_RULE =
  '(@request.auth.role:each = "admin" || @request.auth.role:each = "coordinacion" || @request.auth.id = operator_id) && @request.auth.active = true'

migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users")
  const collection = app.findCollectionByNameOrId("donations")

  collection.fields.add(new SelectField({
    name: "status",
    required: true,
    values: ["recepcion", "clasificada"],
    maxSelect: 1,
  }))
  collection.fields.add(new NumberField({ name: "total_weight_kg", min: 0.01, max: 5000 }))
  collection.fields.add(new NumberField({ name: "classified_weight_kg", min: 0, max: 5000 }))
  collection.fields.add(new TextField({ name: "carrier_name", max: 200 }))
  collection.fields.add(new DateField({ name: "classification_closed_at" }))
  collection.fields.add(new RelationField({ name: "classification_closed_by", collectionId: usersCollection.id, cascadeDelete: false, maxSelect: 1 }))

  // Se amplía a Coordinación, además de admin/dueño — la clasificación
  // (fase 2) suele hacerla "personal interno" distinto de quien
  // recibió la remesa (fase 1), así que cerrarla no puede depender de
  // ser el mismo operador que la creó. Mismo criterio que ya se usó
  // hoy para `donation_items` (ver migración `045` + ajuste del mismo
  // día, `adminCoordOrOwner`).
  collection.updateRule = KIT_LIKE_OWNER_RULE

  app.save(collection)

  // Las donaciones que ya existen no tienen `status` — se marcan
  // `clasificada` de una vez: son, sin excepción, remesas creadas
  // antes de este cambio, cuando todo se clasificaba en el mismo
  // instante de recibirlas.
  const existing = app.findRecordsByFilter("donations", "", "", 0, 0)
  for (const record of existing) {
    record.set("status", "clasificada")
    app.save(record)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("donations")

  collection.fields.removeByName("status")
  collection.fields.removeByName("total_weight_kg")
  collection.fields.removeByName("classified_weight_kg")
  collection.fields.removeByName("carrier_name")
  collection.fields.removeByName("classification_closed_at")
  collection.fields.removeByName("classification_closed_by")

  collection.updateRule =
    '(@request.auth.role:each = "admin" || @request.auth.id = operator_id) && @request.auth.active = true'

  app.save(collection)
})
