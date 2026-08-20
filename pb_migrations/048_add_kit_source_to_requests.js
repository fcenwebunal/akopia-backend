// `requests.source_kit_id`/`source_kit_multiplier` — trazabilidad de
// qué kit (y con qué multiplicador N) originó una solicitud, nada más.
// Las cantidades ya se copiaron a `request_items` al crearla (mismo
// principio que el resto del esquema: un registro no depende en vivo
// de su origen) — si el kit se edita o se desactiva después, esta
// solicitud no cambia. Sirve para reportar uso ("el kit X se usó N
// veces") y para que el operador vea de un vistazo de dónde salió.
//
// Ninguno de los dos es obligatorio: la inmensa mayoría de las
// solicitudes van a seguir armándose a mano, sin kit de por medio.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("requests")
  const kitsCollection = app.findCollectionByNameOrId("kits")

  collection.fields.add(new RelationField({ name: "source_kit_id", collectionId: kitsCollection.id, cascadeDelete: false, maxSelect: 1 }))
  collection.fields.add(new NumberField({ name: "source_kit_multiplier", min: 1, noDecimal: true }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("requests")
  collection.fields.removeByName("source_kit_id")
  collection.fields.removeByName("source_kit_multiplier")
  app.save(collection)
})
