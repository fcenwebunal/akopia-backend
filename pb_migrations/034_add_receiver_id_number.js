// `deliveries` guardaba el TIPO de documento de quien recibe
// (`receiver_id_type`) pero nunca su NÚMERO — el formulario de
// "Confirmar entrega" pedía el tipo y no tenía dónde poner el número,
// así que se descartaba en silencio. Sin el número, el tipo de
// documento no sirve para identificar a nadie.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("deliveries")
  collection.fields.add(new TextField({ name: "receiver_id_number", max: 50 }))
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("deliveries")
  collection.fields.removeByName("receiver_id_number")
  app.save(collection)
})
