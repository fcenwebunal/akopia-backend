// Coordenadas del destino de un despacho — para que el conductor pueda
// copiarlas o abrir el punto exacto en Google Maps, y para el mapa de
// impacto del panel de inicio (dónde se ha entregado ayuda en
// Manizales). Opcionales: los despachos que ya existían no las tienen,
// y no todos los nuevos van a marcarse en el mapa si quien despacha no
// sabe el punto exacto todavía.
//
// `min`/`max` acotan a un rango razonable alrededor de Manizales (no a
// sus límites exactos — la ciudad no es un rectángulo) solo para
// atrapar un clic fuera del mapa o un valor pegado a mano por error,
// no para impedir un despacho a la vereda de al lado.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("dispatches")

  collection.fields.add(new NumberField({
    name: "destination_lat",
    min: 4.9,
    max: 5.2,
  }))
  collection.fields.add(new NumberField({
    name: "destination_lng",
    min: -75.7,
    max: -75.3,
  }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("dispatches")
  collection.fields.removeByName("destination_lat")
  collection.fields.removeByName("destination_lng")
  app.save(collection)
})
